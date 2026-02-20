export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { OrganizationMemberRole, OrganizationModule } from "@prisma/client";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromParams } from "@/lib/organizationId";
import { ensureMemberModuleAccess } from "@/lib/organizationMemberAccess";
import { recordOrganizationAuditSafe } from "@/lib/organizationAudit";
import { applyMatchSlotUpdate } from "@/domain/padel/matchSlots/commands";
import { isPadelLockedForReschedule } from "@/domain/padel/liveStatus";

const ROLE_ALLOWLIST: OrganizationMemberRole[] = ["OWNER", "CO_OWNER", "ADMIN"];

const sameDate = (a: Date | null, b: Date | null) => {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return Math.abs(a.getTime() - b.getTime()) <= 1000;
};

const incrementReason = (bucket: Record<string, number>, reason: string) => {
  const key = reason.trim() || "UNDO_FAILED";
  bucket[key] = (bucket[key] ?? 0) + 1;
};

async function ensureOrganization(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "UNAUTHENTICATED" as const, status: 401 };

  const parsedOrgId = resolveOrganizationIdFromParams(req.nextUrl.searchParams);
  const { organization, membership } = await getActiveOrganizationForUser(user.id, {
    organizationId: Number.isFinite(parsedOrgId) ? parsedOrgId : undefined,
    roles: ROLE_ALLOWLIST,
  });
  if (!organization || !membership) return { error: "NO_ORGANIZATION" as const, status: 403 };

  const permission = await ensureMemberModuleAccess({
    organizationId: organization.id,
    userId: user.id,
    role: membership.role,
    rolePack: membership.rolePack,
    moduleKey: OrganizationModule.TORNEIOS,
    required: "EDIT",
  });
  if (!permission.ok) return { error: "FORBIDDEN" as const, status: 403 };

  return { organization, userId: user.id };
}

async function _POST(req: NextRequest) {
  const check = await ensureOrganization(req);
  if ("error" in check) {
    return jsonWrap({ ok: false, error: check.error }, { status: check.status });
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return jsonWrap({ ok: false, error: "INVALID_BODY" }, { status: 400 });

  const runId = typeof body.runId === "string" ? body.runId.trim() : "";
  if (!runId) return jsonWrap({ ok: false, error: "RUN_ID_REQUIRED" }, { status: 400 });

  const eventIdBody =
    typeof body.eventId === "number" ? body.eventId : typeof body.eventId === "string" ? Number(body.eventId) : null;

  const run = await prisma.padelScheduleRun.findFirst({
    where: { id: runId, organizationId: check.organization.id },
    select: {
      id: true,
      eventId: true,
      status: true,
      dryRun: true,
      applied: true,
      scheduledCount: true,
      skippedCount: true,
    },
  });
  if (!run) return jsonWrap({ ok: false, error: "RUN_NOT_FOUND" }, { status: 404 });

  if (Number.isFinite(eventIdBody) && eventIdBody !== run.eventId) {
    return jsonWrap({ ok: false, error: "RUN_EVENT_MISMATCH" }, { status: 409 });
  }

  if (run.dryRun || !run.applied) {
    return jsonWrap({ ok: false, error: "RUN_NOT_APPLIED" }, { status: 409 });
  }
  if (run.status === "QUEUED" || run.status === "RUNNING") {
    return jsonWrap({ ok: false, error: "RUN_NOT_FINALIZED" }, { status: 409 });
  }

  const decisions = await prisma.padelScheduleRunDecision.findMany({
    where: {
      runId: run.id,
      decisionType: "SCHEDULED",
      matchId: { not: null },
    },
    select: {
      id: true,
      matchId: true,
      courtId: true,
      startsAt: true,
      endsAt: true,
    },
    orderBy: [{ id: "asc" }],
  });

  if (decisions.length === 0) {
    return jsonWrap(
      {
        ok: true,
        runId: run.id,
        eventId: run.eventId,
        requestedCount: 0,
        undoneCount: 0,
        skippedByReason: {},
        status: "UNDO_SKIPPED",
      },
      { status: 200 },
    );
  }

  const matchIds = Array.from(new Set(decisions.map((item) => item.matchId).filter((id): id is number => Number.isFinite(id))));

  const matches = await prisma.eventMatchSlot.findMany({
    where: {
      id: { in: matchIds },
      eventId: run.eventId,
      event: { organizationId: check.organization.id },
    },
    select: {
      id: true,
      status: true,
      plannedStartAt: true,
      plannedEndAt: true,
      courtId: true,
    },
  });
  const matchById = new Map(matches.map((match) => [match.id, match]));

  let undoneCount = 0;
  const skippedByReason: Record<string, number> = {};

  for (const decision of decisions) {
    const matchId = decision.matchId;
    if (!matchId) {
      incrementReason(skippedByReason, "MATCH_NOT_FOUND");
      continue;
    }

    const match = matchById.get(matchId);
    if (!match) {
      incrementReason(skippedByReason, "MATCH_NOT_FOUND");
      continue;
    }

    if (isPadelLockedForReschedule(match.status)) {
      incrementReason(skippedByReason, "MATCH_LOCKED");
      continue;
    }

    const expectedStart = decision.startsAt ?? null;
    const expectedEnd = decision.endsAt ?? null;
    const expectedCourtId = decision.courtId ?? null;
    const matchesDecisionSnapshot =
      sameDate(match.plannedStartAt ?? null, expectedStart) &&
      sameDate(match.plannedEndAt ?? null, expectedEnd) &&
      (match.courtId ?? null) === expectedCourtId;

    if (!matchesDecisionSnapshot) {
      incrementReason(skippedByReason, "MATCH_CHANGED");
      continue;
    }

    const update = await applyMatchSlotUpdate({
      matchId,
      organizationId: check.organization.id,
      actorUserId: check.userId,
      correlationId: run.id,
      eventType: "PADEL_AUTO_SCHEDULE_UNDO",
      schedule: {
        plannedStartAt: null,
        plannedEndAt: null,
        plannedDurationMinutes: null,
        courtId: null,
      },
    });

    if (!update.ok) {
      incrementReason(skippedByReason, update.error || "UNDO_FAILED");
      continue;
    }

    undoneCount += 1;
  }

  const requestedCount = decisions.length;
  const status =
    undoneCount === requestedCount ? "UNDONE" : undoneCount > 0 ? "UNDONE_PARTIAL" : "UNDO_SKIPPED";

  await prisma.padelScheduleRun.update({
    where: { id: run.id },
    data: {
      status,
      queued: false,
      applied: undoneCount === requestedCount ? false : true,
      finishedAt: new Date(),
    },
  });

  await recordOrganizationAuditSafe({
    organizationId: check.organization.id,
    actorUserId: check.userId,
    action: "PADEL_CALENDAR_AUTO_SCHEDULE_UNDO",
    metadata: {
      runId: run.id,
      eventId: run.eventId,
      requestedCount,
      undoneCount,
      skippedByReason,
      previous: {
        status: run.status,
        applied: run.applied,
        scheduledCount: run.scheduledCount,
        skippedCount: run.skippedCount,
      },
      next: {
        status,
        applied: undoneCount === requestedCount ? false : true,
      },
    },
    ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
    userAgent: req.headers.get("user-agent") || null,
  });

  return jsonWrap(
    {
      ok: true,
      runId: run.id,
      eventId: run.eventId,
      requestedCount,
      undoneCount,
      skippedByReason,
      status,
    },
    { status: 200 },
  );
}

export const POST = withApiEnvelope(_POST);
