export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { OrganizationMemberRole, OrganizationModule, padel_match_status } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { ensureMemberModuleAccess } from "@/lib/organizationMemberAccess";
import { recordOrganizationAuditSafe } from "@/lib/organizationAudit";
import { updatePadelMatch } from "@/domain/padel/matches/commands";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

const ROLE_ALLOWLIST: OrganizationMemberRole[] = ["OWNER", "CO_OWNER", "ADMIN", "STAFF"];
const adminRoles = new Set<OrganizationMemberRole>(["OWNER", "CO_OWNER", "ADMIN"]);
const SYSTEM_MATCH_EVENT = "PADEL_MATCH_SYSTEM_UPDATED";

const asScoreObject = (value: unknown) =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const normalizeReason = (value: unknown) => (typeof value === "string" ? value.trim() : "");

const buildRuleSnapshot = (config: { ruleSetId: number | null; ruleSetVersionId: number | null } | null) => ({
  source:
    config?.ruleSetVersionId != null
      ? "VERSION"
      : config?.ruleSetId != null
        ? "RULESET"
        : "DEFAULT",
  ruleSetId: config?.ruleSetId ?? null,
  ruleSetVersionId: config?.ruleSetVersionId ?? null,
  capturedAt: new Date().toISOString(),
});

const isParticipant = (match: {
  pairingA?: { slots?: Array<{ profileId: string | null }> | null } | null;
  pairingB?: { slots?: Array<{ profileId: string | null }> | null } | null;
}, userId: string) => {
  const inA = match.pairingA?.slots?.some((slot) => slot.profileId === userId) ?? false;
  const inB = match.pairingB?.slots?.some((slot) => slot.profileId === userId) ?? false;
  return inA || inB;
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
  if (!reason || reason.length < 5) {
    return jsonWrap({ ok: false, error: "INVALID_REASON" }, { status: 400 });
  }

  const match = await prisma.eventMatchSlot.findUnique({
    where: { id: matchId },
    select: {
      id: true,
      status: true,
      score: true,
      event: { select: { id: true, organizationId: true } },
      pairingA: { select: { slots: { select: { profileId: true } } } },
      pairingB: { select: { slots: { select: { profileId: true } } } },
    },
  });
  if (!match || !match.event?.organizationId) {
    return jsonWrap({ ok: false, error: "MATCH_NOT_FOUND" }, { status: 404 });
  }

  const participant = isParticipant(match, user.id);
  if (!participant) {
    const { organization, membership } = await getActiveOrganizationForUser(user.id, {
      organizationId: match.event.organizationId,
      roles: ROLE_ALLOWLIST,
    });
    if (!organization || !membership) return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    const permission = await ensureMemberModuleAccess({
      organizationId: match.event.organizationId,
      userId: user.id,
      role: membership.role,
      rolePack: membership.rolePack,
      moduleKey: OrganizationModule.TORNEIOS,
      required: "EDIT",
    });
    if (!permission.ok) return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  if (match.status !== padel_match_status.DONE) {
    return jsonWrap({ ok: false, error: "MATCH_NOT_DONE" }, { status: 409 });
  }

  const score = asScoreObject(match.score);
  if (score.disputeStatus === "OPEN") {
    return jsonWrap({ ok: false, error: "DISPUTE_ALREADY_OPEN" }, { status: 409 });
  }
  const config = await prisma.padelTournamentConfig.findUnique({
    where: { eventId: match.event.id },
    select: { ruleSetId: true, ruleSetVersionId: true },
  });
  const ruleSnapshot =
    score.ruleSnapshot && typeof score.ruleSnapshot === "object"
      ? score.ruleSnapshot
      : buildRuleSnapshot(config ? { ruleSetId: config.ruleSetId ?? null, ruleSetVersionId: config.ruleSetVersionId ?? null } : null);

  const nowIso = new Date().toISOString();
  const { match: updated } = await updatePadelMatch({
    matchId: match.id,
    eventId: match.event.id,
    organizationId: match.event.organizationId,
    actorUserId: user.id,
    beforeStatus: match.status ?? null,
    eventType: SYSTEM_MATCH_EVENT,
    data: {
      score: {
        ...score,
        ruleSnapshot,
        disputeStatus: "OPEN",
        disputeReason: reason,
        disputedAt: nowIso,
        disputedBy: user.id,
        disputeResolvedAt: null,
        disputeResolvedBy: null,
        disputeResolutionNote: null,
      },
    },
  });

  await recordOrganizationAuditSafe({
    organizationId: match.event.organizationId,
    actorUserId: user.id,
    action: "PADEL_MATCH_DISPUTE_OPEN",
    metadata: {
      matchId: match.id,
      eventId: match.event.id,
      reason,
    },
  });

  return jsonWrap({ ok: true, match: updated }, { status: 200 });
}

async function _PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  const match = await prisma.eventMatchSlot.findUnique({
    where: { id: matchId },
    select: {
      id: true,
      status: true,
      score: true,
      event: { select: { id: true, organizationId: true } },
    },
  });
  if (!match || !match.event?.organizationId) {
    return jsonWrap({ ok: false, error: "MATCH_NOT_FOUND" }, { status: 404 });
  }

  const { organization, membership } = await getActiveOrganizationForUser(user.id, {
    organizationId: match.event.organizationId,
    roles: ROLE_ALLOWLIST,
  });
  if (!organization || !membership) return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  const permission = await ensureMemberModuleAccess({
    organizationId: match.event.organizationId,
    userId: user.id,
    role: membership.role,
    rolePack: membership.rolePack,
    moduleKey: OrganizationModule.TORNEIOS,
    required: "EDIT",
  });
  if (!permission.ok) return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  if (!adminRoles.has(membership.role)) {
    return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const score = asScoreObject(match.score);
  if (score.disputeStatus !== "OPEN") {
    return jsonWrap({ ok: false, error: "DISPUTE_NOT_OPEN" }, { status: 409 });
  }
  const config = await prisma.padelTournamentConfig.findUnique({
    where: { eventId: match.event.id },
    select: { ruleSetId: true, ruleSetVersionId: true },
  });
  const ruleSnapshot =
    score.ruleSnapshot && typeof score.ruleSnapshot === "object"
      ? score.ruleSnapshot
      : buildRuleSnapshot(config ? { ruleSetId: config.ruleSetId ?? null, ruleSetVersionId: config.ruleSetVersionId ?? null } : null);

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const resolutionNote = normalizeReason(body?.resolutionNote ?? body?.note);

  const nowIso = new Date().toISOString();
  const { match: updated } = await updatePadelMatch({
    matchId: match.id,
    eventId: match.event.id,
    organizationId: match.event.organizationId,
    actorUserId: user.id,
    beforeStatus: match.status ?? null,
    eventType: SYSTEM_MATCH_EVENT,
    data: {
      score: {
        ...score,
        ruleSnapshot,
        disputeStatus: "RESOLVED",
        disputeResolvedAt: nowIso,
        disputeResolvedBy: user.id,
        ...(resolutionNote ? { disputeResolutionNote: resolutionNote } : {}),
      },
    },
  });

  await recordOrganizationAuditSafe({
    organizationId: match.event.organizationId,
    actorUserId: user.id,
    action: "PADEL_MATCH_DISPUTE_RESOLVE",
    metadata: {
      matchId: match.id,
      eventId: match.event.id,
      resolutionNote: resolutionNote || null,
    },
  });

  return jsonWrap({ ok: true, match: updated }, { status: 200 });
}
export const POST = withApiEnvelope(_POST);
export const PATCH = withApiEnvelope(_PATCH);
