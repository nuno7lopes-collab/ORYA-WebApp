export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { OrganizationMemberRole, OrganizationModule, SoftBlockScope } from "@prisma/client";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { ensureMemberModuleAccess } from "@/lib/organizationMemberAccess";
import { recordOrganizationAuditSafe } from "@/lib/organizationAudit";
import { buildAgendaConflictPayload } from "@/domain/agenda/conflictResponse";
import { buildExistingByCourt, buildMatchWindow, evaluateMatchBatchAgainstAgenda } from "@/domain/agenda/scheduleWriteGateway";
import { applyMatchSlotUpdate } from "@/domain/padel/matchSlots/commands";
import { isPadelLockedForReschedule } from "@/domain/padel/liveStatus";

import { getUserWithPolicy } from "@/lib/auth/getUserWithPolicy";

const ROLE_ALLOWLIST: OrganizationMemberRole[] = ["OWNER", "CO_OWNER", "ADMIN"];
const MATCH_BULK_EVENT_TYPE = "padel.calendar.bulk_reschedule";

type BulkMode = "PREVIEW" | "APPLY";
type BulkPartialMode = "ALLOW_PARTIAL" | "REQUIRE_FULL";

type ParsedUpdate = {
  matchId: number;
  courtId: number;
  startAt: Date;
  endAt: Date;
  durationMinutes: number;
  version: string | null;
};

type MatchSnapshot = {
  id: number;
  status: string;
  updatedAt: Date;
  courtId: number | null;
  plannedStartAt: Date | null;
  plannedEndAt: Date | null;
  plannedDurationMinutes: number | null;
  startTime: Date | null;
};

const parsePositiveInt = (value: unknown) => {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return null;
  const normalized = Math.floor(parsed);
  return normalized > 0 ? normalized : null;
};

const parseDate = (value: unknown) => {
  if (typeof value !== "string") return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const parseOptionalDuration = (value: unknown) => {
  if (value == null) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return null;
  const normalized = Math.round(parsed);
  return normalized > 0 ? normalized : null;
};

const incrementReason = (target: Record<string, number>, reason: string) => {
  target[reason] = (target[reason] ?? 0) + 1;
};

const getRequestMeta = (req: NextRequest) => ({
  ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
  userAgent: req.headers.get("user-agent") || null,
});

const isActiveBooking = (booking: { status: string; pendingExpiresAt: Date | null }) => {
  if (["CONFIRMED", "DISPUTED", "NO_SHOW"].includes(booking.status)) return true;
  if (["PENDING_CONFIRMATION", "PENDING"].includes(booking.status)) {
    return booking.pendingExpiresAt ? booking.pendingExpiresAt > new Date() : false;
  }
  return false;
};

function agendaConflictResponse() {
  return {
    ok: false,
    ...buildAgendaConflictPayload({ decision: null, fallbackReason: "MISSING_EXISTING_DATA" }),
  };
}

async function _POST(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
    error,
  } = await getUserWithPolicy("required_verified", { supabaseOverride: supabase });
  if (error || !user) return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return jsonWrap({ ok: false, error: "INVALID_BODY" }, { status: 400 });

  const eventId = parsePositiveInt(body.eventId);
  if (!eventId) return jsonWrap({ ok: false, error: "INVALID_EVENT" }, { status: 400 });

  const mode: BulkMode = body.mode === "PREVIEW" ? "PREVIEW" : body.mode === "APPLY" ? "APPLY" : "APPLY";
  const partialMode: BulkPartialMode = body.partialMode === "REQUIRE_FULL" ? "REQUIRE_FULL" : "ALLOW_PARTIAL";

  const updatesRaw = Array.isArray(body.updates) ? (body.updates as Array<Record<string, unknown>>) : [];
  if (updatesRaw.length === 0) {
    return jsonWrap({ ok: false, error: "UPDATES_REQUIRED" }, { status: 400 });
  }

  const event = await prisma.event.findUnique({
    where: { id: eventId, isDeleted: false },
    select: { id: true, organizationId: true, templateType: true },
  });
  if (!event?.organizationId || event.templateType !== "PADEL") {
    return jsonWrap({ ok: false, error: "EVENT_NOT_FOUND" }, { status: 404 });
  }

  const { organization, membership } = await getActiveOrganizationForUser(user.id, {
    organizationId: event.organizationId,
    roles: ROLE_ALLOWLIST,
  });
  if (!organization || !membership) return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });

  const permission = await ensureMemberModuleAccess({
    organizationId: event.organizationId,
    userId: user.id,
    role: membership.role,
    rolePack: membership.rolePack,
    moduleKey: OrganizationModule.TORNEIOS,
    required: "EDIT",
  });
  if (!permission.ok) return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });

  const parsedUpdates = updatesRaw
    .map<ParsedUpdate | null>((row) => {
      const matchId = parsePositiveInt(row.matchId);
      const courtId = parsePositiveInt(row.courtId);
      const startAt = parseDate(row.startAt);
      const endAt = parseDate(row.endAt);
      if (!matchId || !courtId || !startAt || !endAt || endAt <= startAt) return null;
      const durationMinutes = parseOptionalDuration(row.durationMinutes) ?? Math.max(1, Math.round((endAt.getTime() - startAt.getTime()) / 60_000));
      return {
        matchId,
        courtId,
        startAt,
        endAt,
        durationMinutes,
        version: typeof row.version === "string" ? row.version : null,
      };
    })
    .filter((row): row is ParsedUpdate => Boolean(row));

  if (parsedUpdates.length === 0) {
    return jsonWrap({ ok: false, error: "INVALID_UPDATES" }, { status: 400 });
  }

  const requestedMatchIds = Array.from(new Set(parsedUpdates.map((update) => update.matchId)));
  const targetCourtIds = Array.from(new Set(parsedUpdates.map((update) => update.courtId)));

  const [matches, courts] = await Promise.all([
    prisma.eventMatchSlot.findMany({
      where: { eventId: event.id, id: { in: requestedMatchIds } },
      select: {
        id: true,
        status: true,
        updatedAt: true,
        courtId: true,
        plannedStartAt: true,
        plannedEndAt: true,
        plannedDurationMinutes: true,
        startTime: true,
      },
    }),
    prisma.padelClubCourt.findMany({
      where: {
        id: { in: targetCourtIds },
        deletedAt: null,
        club: { organizationId: event.organizationId, deletedAt: null },
      },
      select: {
        id: true,
        name: true,
        displayOrder: true,
      },
    }),
  ]);

  const matchById = new Map(matches.map((match) => [match.id, match as MatchSnapshot]));
  const courtById = new Map(courts.map((court) => [court.id, court]));

  const skippedByMatch: Array<{
    matchId: number;
    reason: string;
    blockedByType?: string | null;
    blockedBySourceId?: string | null;
  }> = [];
  const unscheduledByReason: Record<string, number> = {};
  const normalizedUpdates: ParsedUpdate[] = [];
  const seenMatchIds = new Set<number>();

  for (const update of parsedUpdates) {
    if (seenMatchIds.has(update.matchId)) {
      incrementReason(unscheduledByReason, "DUPLICATE_MATCH_ID");
      skippedByMatch.push({ matchId: update.matchId, reason: "DUPLICATE_MATCH_ID" });
      continue;
    }
    seenMatchIds.add(update.matchId);

    const match = matchById.get(update.matchId);
    if (!match) {
      incrementReason(unscheduledByReason, "MATCH_NOT_FOUND");
      skippedByMatch.push({ matchId: update.matchId, reason: "MATCH_NOT_FOUND" });
      continue;
    }
    if (isPadelLockedForReschedule(match.status)) {
      incrementReason(unscheduledByReason, "MATCH_LOCKED");
      skippedByMatch.push({ matchId: update.matchId, reason: "MATCH_LOCKED" });
      continue;
    }

    const court = courtById.get(update.courtId);
    if (!court) {
      incrementReason(unscheduledByReason, "COURT_NOT_FOUND");
      skippedByMatch.push({ matchId: update.matchId, reason: "COURT_NOT_FOUND" });
      continue;
    }

    if (update.version) {
      const versionDate = new Date(update.version);
      if (Number.isNaN(versionDate.getTime())) {
        incrementReason(unscheduledByReason, "INVALID_VERSION");
        skippedByMatch.push({ matchId: update.matchId, reason: "INVALID_VERSION" });
        continue;
      }
      if (Math.abs(match.updatedAt.getTime() - versionDate.getTime()) > 1000) {
        incrementReason(unscheduledByReason, "STALE_VERSION");
        skippedByMatch.push({ matchId: update.matchId, reason: "STALE_VERSION" });
        continue;
      }
    }

    const currentWindow = buildMatchWindow(match);
    const noChanges =
      match.courtId === update.courtId &&
      currentWindow.start &&
      currentWindow.end &&
      currentWindow.start.getTime() === update.startAt.getTime() &&
      currentWindow.end.getTime() === update.endAt.getTime();
    if (noChanges) {
      incrementReason(unscheduledByReason, "NO_CHANGES");
      skippedByMatch.push({ matchId: update.matchId, reason: "NO_CHANGES" });
      continue;
    }

    normalizedUpdates.push(update);
  }

  if (normalizedUpdates.length === 0) {
    return jsonWrap(
      {
        ok: true,
        mode,
        partialMode,
        requestedCount: parsedUpdates.length,
        scheduledCount: 0,
        skippedCount: skippedByMatch.length,
        scheduled: [],
        skippedByMatch,
        unscheduledByReason,
        applied: false,
      },
      { status: 200 },
    );
  }

  const scheduleWindowStart = new Date(Math.min(...normalizedUpdates.map((update) => update.startAt.getTime())));
  const scheduleWindowEnd = new Date(Math.max(...normalizedUpdates.map((update) => update.endAt.getTime())));
  const normalizedMatchIds = normalizedUpdates.map((update) => update.matchId);
  const courtIds = Array.from(new Set(normalizedUpdates.map((update) => update.courtId)));

  const now = new Date();
  const [hardBlocks, scheduledMatches, bookings, softBlocks, classSessions] = await Promise.all([
    prisma.calendarBlock.findMany({
      where: {
        organizationId: event.organizationId,
        eventId: event.id,
        courtId: { in: courtIds },
        startAt: { lt: scheduleWindowEnd },
        endAt: { gt: scheduleWindowStart },
      },
      select: { id: true, courtId: true, startAt: true, endAt: true },
    }),
    prisma.eventMatchSlot.findMany({
      where: {
        eventId: event.id,
        id: { notIn: normalizedMatchIds },
        courtId: { in: courtIds },
        OR: [{ plannedStartAt: { not: null } }, { startTime: { not: null } }],
      },
      select: {
        id: true,
        plannedStartAt: true,
        plannedEndAt: true,
        plannedDurationMinutes: true,
        startTime: true,
        courtId: true,
      },
    }),
    prisma.booking.findMany({
      where: {
        organizationId: event.organizationId,
        courtId: { in: courtIds },
        startsAt: { lt: scheduleWindowEnd },
        OR: [
          { status: { in: ["CONFIRMED", "DISPUTED", "NO_SHOW"] } },
          { status: { in: ["PENDING_CONFIRMATION", "PENDING"] }, pendingExpiresAt: { gt: now } },
        ],
      },
      select: {
        id: true,
        courtId: true,
        startsAt: true,
        durationMinutes: true,
        status: true,
        pendingExpiresAt: true,
        updatedAt: true,
      },
    }),
    prisma.softBlock.findMany({
      where: {
        organizationId: event.organizationId,
        startsAt: { lt: scheduleWindowEnd },
        endsAt: { gt: scheduleWindowStart },
        OR: [
          { scopeType: SoftBlockScope.ORGANIZATION },
          { scopeType: SoftBlockScope.COURT, scopeId: { in: courtIds } },
        ],
      },
      select: { id: true, scopeType: true, scopeId: true, startsAt: true, endsAt: true },
    }),
    prisma.classSession.findMany({
      where: {
        organizationId: event.organizationId,
        courtId: { in: courtIds },
        startsAt: { lt: scheduleWindowEnd },
        endsAt: { gt: scheduleWindowStart },
        status: { not: "CANCELLED" },
      },
      select: { id: true, courtId: true, startsAt: true, endsAt: true },
    }),
  ]);

  const { existingByCourt, missingExisting } = buildExistingByCourt({
    courtIds,
    hardBlocks,
    scheduledMatches,
    bookings: bookings.filter((booking) => isActiveBooking(booking)),
    softBlocks,
    classSessions,
  });
  if (missingExisting) {
    return jsonWrap(agendaConflictResponse(), { status: 503 });
  }

  const arbitration = evaluateMatchBatchAgainstAgenda({
    updates: normalizedUpdates.map((update) => ({
      matchId: update.matchId,
      courtId: update.courtId,
      start: update.startAt,
      end: update.endAt,
    })),
    existingByCourt,
    partialMode,
  });
  if (arbitration.missingExisting) {
    return jsonWrap(agendaConflictResponse(), { status: 503 });
  }

  arbitration.rejectedUpdates.forEach((rejected) => {
    incrementReason(unscheduledByReason, rejected.reason);
    skippedByMatch.push({
      matchId: rejected.matchId,
      reason: rejected.reason,
      blockedByType: rejected.blockedByType ?? null,
      blockedBySourceId: rejected.blockedBySourceId ?? null,
    });
  });

  const acceptedIds = new Set(arbitration.acceptedUpdates.map((update) => update.matchId));
  const acceptedUpdates = normalizedUpdates.filter((update) => acceptedIds.has(update.matchId));

  if (mode === "PREVIEW") {
    return jsonWrap(
      {
        ok: true,
        mode,
        partialMode,
        requestedCount: parsedUpdates.length,
        evaluatedCount: normalizedUpdates.length,
        scheduledCount: acceptedUpdates.length,
        skippedCount: skippedByMatch.length,
        scheduled: acceptedUpdates.map((update) => ({
          matchId: update.matchId,
          courtId: update.courtId,
          startAt: update.startAt.toISOString(),
          endAt: update.endAt.toISOString(),
          durationMinutes: update.durationMinutes,
        })),
        skippedByMatch,
        unscheduledByReason,
        applied: false,
      },
      { status: 200 },
    );
  }

  if (partialMode === "REQUIRE_FULL" && skippedByMatch.length > 0) {
    return jsonWrap(
      {
        ok: false,
        error: "BULK_RESCHEDULE_INFEASIBLE",
        mode,
        partialMode,
        requestedCount: parsedUpdates.length,
        evaluatedCount: normalizedUpdates.length,
        scheduledCount: 0,
        skippedCount: skippedByMatch.length,
        scheduled: [],
        skippedByMatch,
        unscheduledByReason,
      },
      { status: 409 },
    );
  }

  const skippedAfterApply = [...skippedByMatch];
  const applied: Array<{
    matchId: number;
    courtId: number;
    startAt: string;
    endAt: string;
    durationMinutes: number;
  }> = [];

  for (const update of acceptedUpdates) {
    const court = courtById.get(update.courtId);
    const result = await applyMatchSlotUpdate({
      matchId: update.matchId,
      organizationId: event.organizationId,
      actorUserId: user.id,
      correlationId: String(event.id),
      eventType: MATCH_BULK_EVENT_TYPE,
      schedule: {
        courtId: update.courtId,
        plannedStartAt: update.startAt,
        plannedEndAt: update.endAt,
        plannedDurationMinutes: update.durationMinutes,
      },
      data: {
        courtName: court?.name ?? null,
        courtNumber:
          typeof court?.displayOrder === "number" && Number.isFinite(court.displayOrder)
            ? court.displayOrder + 1
            : null,
      },
    });
    if (!result.ok) {
      incrementReason(unscheduledByReason, "AGENDA_WRITE_FAILED");
      skippedAfterApply.push({ matchId: update.matchId, reason: "AGENDA_WRITE_FAILED" });
      continue;
    }
    applied.push({
      matchId: update.matchId,
      courtId: update.courtId,
      startAt: update.startAt.toISOString(),
      endAt: update.endAt.toISOString(),
      durationMinutes: update.durationMinutes,
    });
  }

  await recordOrganizationAuditSafe({
    organizationId: event.organizationId,
    actorUserId: user.id,
    action: "PADEL_CALENDAR_MATCH_BULK_RESCHEDULE",
    metadata: {
      eventId: event.id,
      mode,
      partialMode,
      requestedCount: parsedUpdates.length,
      evaluatedCount: normalizedUpdates.length,
      scheduledCount: applied.length,
      skippedCount: skippedAfterApply.length,
      unscheduledByReason,
    },
    ...getRequestMeta(req),
  });

  return jsonWrap(
    {
      ok: true,
      mode,
      partialMode,
      requestedCount: parsedUpdates.length,
      evaluatedCount: normalizedUpdates.length,
      scheduledCount: applied.length,
      skippedCount: skippedAfterApply.length,
      scheduled: applied,
      skippedByMatch: skippedAfterApply,
      unscheduledByReason,
      applied: true,
    },
    { status: 200 },
  );
}

export const POST = withApiEnvelope(_POST);
