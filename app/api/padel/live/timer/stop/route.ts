export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { OrganizationMemberRole, OrganizationModule } from "@prisma/client";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { ensureMemberModuleAccess } from "@/lib/organizationMemberAccess";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { recordOrganizationAuditSafe } from "@/lib/organizationAudit";
import { enforceMobileVersionGate } from "@/lib/http/mobileVersionGate";

const WRITE_ROLES: OrganizationMemberRole[] = ["OWNER", "CO_OWNER", "ADMIN", "STAFF"];

type TimerState = {
  status: "IDLE" | "RUNNING" | "STOPPED";
  roundNumber: number;
  durationSeconds: number;
  startedAt: string | null;
  stoppedAt: string | null;
  updatedAt: string;
};

function normalizeTimerState(raw: unknown): TimerState {
  const source =
    raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const statusRaw = typeof source.status === "string" ? source.status.trim().toUpperCase() : "IDLE";
  const status: TimerState["status"] =
    statusRaw === "RUNNING" || statusRaw === "STOPPED" ? statusRaw : "IDLE";
  const roundRaw = typeof source.roundNumber === "number" ? source.roundNumber : Number(source.roundNumber);
  const durationRaw =
    typeof source.durationSeconds === "number" ? source.durationSeconds : Number(source.durationSeconds);
  return {
    status,
    roundNumber: Number.isFinite(roundRaw) && roundRaw > 0 ? Math.floor(roundRaw) : 1,
    durationSeconds: Number.isFinite(durationRaw) && durationRaw > 0 ? Math.floor(durationRaw) : 20 * 60,
    startedAt: typeof source.startedAt === "string" ? source.startedAt : null,
    stoppedAt: typeof source.stoppedAt === "string" ? source.stoppedAt : null,
    updatedAt: typeof source.updatedAt === "string" ? source.updatedAt : new Date().toISOString(),
  };
}

async function _POST(req: NextRequest) {
  const mobileGate = enforceMobileVersionGate(req);
  if (mobileGate) return mobileGate;

  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return jsonWrap({ ok: false, error: "INVALID_BODY" }, { status: 400 });
  const eventId = typeof body.eventId === "number" ? body.eventId : Number(body.eventId);
  if (!Number.isFinite(eventId) || eventId <= 0) {
    return jsonWrap({ ok: false, error: "INVALID_EVENT" }, { status: 400 });
  }

  const event = await prisma.event.findUnique({
    where: { id: Math.floor(eventId), isDeleted: false },
    select: {
      id: true,
      organizationId: true,
      templateType: true,
      padelTournamentConfig: {
        select: { id: true, format: true, advancedSettings: true },
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
  const permission = await ensureMemberModuleAccess({
    organizationId: event.organizationId,
    userId: user.id,
    role: membership.role,
    rolePack: membership.rolePack,
    moduleKey: OrganizationModule.TORNEIOS,
    required: "EDIT",
  });
  if (!permission.ok) return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });

  const format = event.padelTournamentConfig.format;
  if (format !== "NON_STOP" && format !== "MEXICANO" && format !== "AMERICANO") {
    return jsonWrap({ ok: false, error: "TIMER_NOT_SUPPORTED_FOR_FORMAT" }, { status: 409 });
  }

  const advanced = (event.padelTournamentConfig.advancedSettings ?? {}) as Record<string, unknown>;
  const previous = normalizeTimerState(advanced.nonStopTimerState);
  const nowIso = new Date().toISOString();
  const nextTimerState: TimerState = {
    ...previous,
    status: "STOPPED",
    stoppedAt: nowIso,
    updatedAt: nowIso,
  };

  const updated = await prisma.padelTournamentConfig.update({
    where: { id: event.padelTournamentConfig.id },
    data: {
      advancedSettings: {
        ...advanced,
        nonStopTimerState: nextTimerState,
      },
    },
    select: { id: true, advancedSettings: true },
  });

  await recordOrganizationAuditSafe({
    organizationId: event.organizationId,
    actorUserId: user.id,
    action: "PADEL_LIVE_TIMER_STOP",
    entityType: "event",
    entityId: String(event.id),
    metadata: {
      format,
      roundNumber: nextTimerState.roundNumber,
      durationSeconds: nextTimerState.durationSeconds,
      stoppedAt: nextTimerState.stoppedAt,
      previousState: previous,
    },
    ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
    userAgent: req.headers.get("user-agent") || null,
  });

  return jsonWrap({ ok: true, timerState: (updated.advancedSettings as Record<string, unknown>).nonStopTimerState });
}

export const POST = withApiEnvelope(_POST);
