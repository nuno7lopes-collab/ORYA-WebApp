export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { OrganizationMemberRole, OrganizationModule, SourceType, padel_match_status } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { ensureMemberModuleAccess } from "@/lib/organizationMemberAccess";
import { recordOutboxEvent } from "@/domain/outbox/producer";
import { appendEventLog } from "@/domain/eventLog/append";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { recordOrganizationAuditSafe } from "@/lib/organizationAudit";

const ROLE_ALLOWLIST: OrganizationMemberRole[] = ["OWNER", "CO_OWNER", "ADMIN", "STAFF"];
type DelayPolicy = "SINGLE_MATCH" | "CASCADE_SAME_COURT" | "GLOBAL_REPLAN";
const DEFAULT_DELAY_POLICY: DelayPolicy = "CASCADE_SAME_COURT";
const normalizeReason = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const normalizeDelayPolicy = (value: unknown, fallback: DelayPolicy = DEFAULT_DELAY_POLICY): DelayPolicy => {
  if (value === "SINGLE_MATCH" || value === "CASCADE_SAME_COURT" || value === "GLOBAL_REPLAN") {
    return value;
  }
  return fallback;
};
const parseDate = (value: unknown) => {
  if (typeof value !== "string") return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

async function _POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolved = await params;
  const matchId = Number(resolved?.id);
  if (!Number.isFinite(matchId)) {
    return jsonWrap({ ok: false, error: "INVALID_MATCH" }, { status: 400 });
  }

  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const reason = normalizeReason(body?.reason);
  const clearSchedule = body?.clearSchedule !== false;
  const autoReschedule = body?.autoReschedule !== false;
  const windowStartOverride = parseDate(body?.windowStart);
  const windowEndOverride = parseDate(body?.windowEnd);

  if (reason && reason.length < 3) {
    return jsonWrap({ ok: false, error: "INVALID_REASON" }, { status: 400 });
  }

  const match = await prisma.eventMatchSlot.findUnique({
    where: { id: matchId },
    select: {
      id: true,
      status: true,
      event: {
        select: {
          id: true,
          organizationId: true,
          startsAt: true,
          endsAt: true,
          padelTournamentConfig: {
            select: {
              padelClubId: true,
              partnerClubIds: true,
              advancedSettings: true,
            },
          },
        },
      },
    },
  });
  if (!match || !match.event?.organizationId) {
    return jsonWrap({ ok: false, error: "MATCH_NOT_FOUND" }, { status: 404 });
  }
  const organizationId = match.event.organizationId;
  const advanced = (match.event.padelTournamentConfig?.advancedSettings || {}) as {
    scheduleDefaults?: { delayPolicy?: DelayPolicy };
  };
  const defaultDelayPolicy = normalizeDelayPolicy(advanced.scheduleDefaults?.delayPolicy, DEFAULT_DELAY_POLICY);
  const delayPolicy = normalizeDelayPolicy(body?.delayPolicy, defaultDelayPolicy);

  const { organization, membership } = await getActiveOrganizationForUser(user.id, {
    organizationId,
    roles: ROLE_ALLOWLIST,
  });
  if (!organization || !membership) return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  const permission = await ensureMemberModuleAccess({
    organizationId,
    userId: user.id,
    role: membership.role,
    rolePack: membership.rolePack,
    moduleKey: OrganizationModule.TORNEIOS,
    required: "EDIT",
  });
  if (!permission.ok) return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });

  if (match.status !== padel_match_status.PENDING) {
    return jsonWrap({ ok: false, error: "MATCH_LOCKED" }, { status: 409 });
  }

  const outbox = await prisma.$transaction(async (tx) => {
    const outbox = await recordOutboxEvent(
      {
        eventType: "PADEL_MATCH_DELAY_REQUESTED",
        dedupeKey: `padel_match_delay:${match.id}:${clearSchedule ? "clear" : "keep"}:${autoReschedule ? "auto" : "manual"}:${delayPolicy}:${windowStartOverride ? windowStartOverride.toISOString() : "none"}:${windowEndOverride ? windowEndOverride.toISOString() : "none"}`,
        payload: {
          matchId: match.id,
          eventId: match.event.id,
          organizationId,
          actorUserId: user.id,
          reason: reason || null,
          clearSchedule,
          autoReschedule,
          delayPolicy,
          windowStart: windowStartOverride ? windowStartOverride.toISOString() : null,
          windowEnd: windowEndOverride ? windowEndOverride.toISOString() : null,
        },
      },
      tx,
    );
    await appendEventLog(
      {
        eventId: outbox.eventId,
        organizationId,
        eventType: "PADEL_MATCH_DELAY_REQUESTED",
        idempotencyKey: outbox.eventId,
        actorUserId: user.id,
        sourceType: SourceType.MATCH,
        sourceId: String(match.id),
        correlationId: outbox.eventId,
        payload: {
          matchId: match.id,
          eventId: match.event.id,
          reason: reason || null,
          clearSchedule,
          autoReschedule,
          delayPolicy,
        },
      },
      tx,
    );
    return outbox;
  });

  await recordOrganizationAuditSafe({
    organizationId,
    actorUserId: user.id,
    action: "PADEL_MATCH_DELAY",
    metadata: {
      matchId: match.id,
      eventId: match.event.id,
      reason: reason || null,
      clearSchedule,
      autoReschedule,
      delayPolicy,
      windowStart: windowStartOverride ? windowStartOverride.toISOString() : null,
      windowEnd: windowEndOverride ? windowEndOverride.toISOString() : null,
    },
    ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
    userAgent: req.headers.get("user-agent") || null,
  });

  return jsonWrap({ ok: true, queued: true, eventId: outbox.eventId }, { status: 202 });
}
export const POST = withApiEnvelope(_POST);
