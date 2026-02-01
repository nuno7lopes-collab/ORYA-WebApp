export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { OrganizationMemberRole, PadelTournamentLifecycleStatus, SourceType } from "@prisma/client";
import {
  canTransitionLifecycle,
  getAllowedLifecycleTransitions,
  resolveEventStatusForLifecycle,
} from "@/domain/padel/tournamentLifecycle";
import { appendEventLog } from "@/domain/eventLog/append";
import { recordOrganizationAuditSafe } from "@/lib/organizationAudit";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

const READ_ROLES: OrganizationMemberRole[] = ["OWNER", "CO_OWNER", "ADMIN", "STAFF"];
const WRITE_ROLES: OrganizationMemberRole[] = ["OWNER", "CO_OWNER", "ADMIN"];

const parseLifecycle = (value: unknown) => {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  return Object.values(PadelTournamentLifecycleStatus).includes(normalized as PadelTournamentLifecycleStatus)
    ? (normalized as PadelTournamentLifecycleStatus)
    : null;
};

const getRequestMeta = (req: NextRequest) => {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  const userAgent = req.headers.get("user-agent") || null;
  return { ip, userAgent };
};

async function _GET(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const eventId = Number(req.nextUrl.searchParams.get("eventId"));
  if (!Number.isFinite(eventId)) return jsonWrap({ ok: false, error: "INVALID_EVENT" }, { status: 400 });

  const event = await prisma.event.findUnique({
    where: { id: eventId, isDeleted: false },
    select: {
      id: true,
      status: true,
      templateType: true,
      organizationId: true,
      padelTournamentConfig: {
        select: {
          id: true,
          lifecycleStatus: true,
          publishedAt: true,
          lockedAt: true,
          liveAt: true,
          completedAt: true,
          cancelledAt: true,
          lifecycleUpdatedAt: true,
        },
      },
    },
  });

  if (!event?.organizationId || event.templateType !== "PADEL" || !event.padelTournamentConfig) {
    return jsonWrap({ ok: false, error: "EVENT_NOT_FOUND" }, { status: 404 });
  }

  const { organization, membership } = await getActiveOrganizationForUser(user.id, {
    organizationId: event.organizationId,
    roles: READ_ROLES,
  });
  if (!organization || !membership) return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });

  const lifecycle = event.padelTournamentConfig;
  const transitions = getAllowedLifecycleTransitions(lifecycle.lifecycleStatus);

  return jsonWrap(
    {
      ok: true,
      event: {
        id: event.id,
        status: event.status,
      },
      lifecycle: lifecycle,
      transitions,
      canManage: WRITE_ROLES.includes(membership.role),
    },
    { status: 200 },
  );
}

async function _POST(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return jsonWrap({ ok: false, error: "INVALID_BODY" }, { status: 400 });

  const eventId = typeof body.eventId === "number" ? body.eventId : Number(body.eventId);
  if (!Number.isFinite(eventId)) return jsonWrap({ ok: false, error: "INVALID_EVENT" }, { status: 400 });

  const nextStatus = parseLifecycle(body.nextStatus);
  if (!nextStatus) return jsonWrap({ ok: false, error: "INVALID_STATUS" }, { status: 400 });

  const event = await prisma.event.findUnique({
    where: { id: eventId, isDeleted: false },
    select: {
      id: true,
      status: true,
      templateType: true,
      organizationId: true,
      padelTournamentConfig: {
        select: {
          id: true,
          lifecycleStatus: true,
          publishedAt: true,
          lockedAt: true,
          liveAt: true,
          completedAt: true,
          cancelledAt: true,
        },
      },
    },
  });
  if (!event?.organizationId || event.templateType !== "PADEL" || !event.padelTournamentConfig) {
    return jsonWrap({ ok: false, error: "EVENT_NOT_FOUND" }, { status: 404 });
  }

  const { organization, membership } = await getActiveOrganizationForUser(user.id, {
    organizationId: event.organizationId,
    roles: WRITE_ROLES,
  });
  if (!organization || !membership) return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });

  const current = event.padelTournamentConfig.lifecycleStatus;
  if (current === nextStatus) {
    return jsonWrap({ ok: true, lifecycle: event.padelTournamentConfig, eventStatus: event.status }, { status: 200 });
  }
  if (!canTransitionLifecycle(current, nextStatus)) {
    return jsonWrap({ ok: false, error: "TRANSITION_NOT_ALLOWED" }, { status: 409 });
  }

  const now = new Date();
  const lifecycleUpdate: Record<string, unknown> = {
    lifecycleStatus: nextStatus,
    lifecycleUpdatedAt: now,
  };
  const ensureAt = (field: string, shouldSet: boolean) => {
    if (!shouldSet) return;
    if ((event.padelTournamentConfig as Record<string, unknown>)[field]) return;
    lifecycleUpdate[field] = now;
  };
  ensureAt("publishedAt", ["PUBLISHED", "LOCKED", "LIVE", "COMPLETED"].includes(nextStatus));
  ensureAt("lockedAt", ["LOCKED", "LIVE", "COMPLETED"].includes(nextStatus));
  ensureAt("liveAt", ["LIVE", "COMPLETED"].includes(nextStatus));
  ensureAt("completedAt", nextStatus === "COMPLETED");
  ensureAt("cancelledAt", nextStatus === "CANCELLED");

  const nextEventStatus = resolveEventStatusForLifecycle(nextStatus);

  const { ip, userAgent } = getRequestMeta(req);

  const updated = await prisma.$transaction(async (tx) => {
    const updatedConfig = await tx.padelTournamentConfig.update({
      where: { id: event.padelTournamentConfig!.id },
      data: lifecycleUpdate,
      select: {
        id: true,
        lifecycleStatus: true,
        publishedAt: true,
        lockedAt: true,
        liveAt: true,
        completedAt: true,
        cancelledAt: true,
        lifecycleUpdatedAt: true,
      },
    });

    if (event.status !== nextEventStatus) {
      await tx.event.update({
        where: { id: event.id },
        data: { status: nextEventStatus },
      });
    }

    await appendEventLog(
      {
        organizationId: event.organizationId,
        eventType: "padel_tournament.lifecycle_updated",
        actorUserId: user.id,
        sourceType: SourceType.TOURNAMENT,
        sourceId: String(event.id),
        payload: {
          eventId: event.id,
          fromStatus: current,
          toStatus: nextStatus,
          eventStatus: nextEventStatus,
        },
      },
      tx,
    );

    return updatedConfig;
  });

  await recordOrganizationAuditSafe({
    organizationId: event.organizationId,
    actorUserId: user.id,
    action: "padel_tournament.lifecycle",
    entityType: "event",
    entityId: String(event.id),
    metadata: { fromStatus: current, toStatus: nextStatus, eventStatus: nextEventStatus },
    ip,
    userAgent,
  });

  return jsonWrap({ ok: true, lifecycle: updated, eventStatus: nextEventStatus }, { status: 200 });
}

export const GET = withApiEnvelope(_GET);
export const POST = withApiEnvelope(_POST);
