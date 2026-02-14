export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { OrganizationMemberRole, OrganizationModule, padel_match_status } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { ensureMemberModuleAccess } from "@/lib/organizationMemberAccess";
import { recordOrganizationAuditSafe } from "@/lib/organizationAudit";
import { updatePadelMatch } from "@/domain/padel/matches/commands";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import {
  listTournamentDirectorUserIds,
  normalizeConfirmationSource,
  resolveIncidentAuthority,
} from "@/domain/padel/incidentGovernance";
import { reconcilePadelDisputeAntiFraud } from "@/domain/padel/ratingAntiFraud";
import { createNotification, shouldNotify } from "@/lib/notifications";

const ROLE_ALLOWLIST: OrganizationMemberRole[] = ["OWNER", "CO_OWNER", "ADMIN", "STAFF"];
const SYSTEM_MATCH_EVENT = "PADEL_MATCH_SYSTEM_UPDATED";
const RESOLUTION_STATUSES = new Set(["CONFIRMED", "CORRECTED", "VOIDED"]);

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
  if (body?.confirmationSource === undefined || body?.confirmationSource === null) {
    return jsonWrap({ ok: false, error: "MISSING_CONFIRMATION_SOURCE" }, { status: 400 });
  }
  const parsedOpenSource =
    body?.confirmationSource === undefined || body?.confirmationSource === null
      ? null
      : normalizeConfirmationSource(body?.confirmationSource);
  if (!parsedOpenSource) {
    return jsonWrap({ ok: false, error: "INVALID_CONFIRMATION_SOURCE" }, { status: 400 });
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
  const organizationId = match.event.organizationId;

  const participant = isParticipant(match, user.id);
  if (!participant) {
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
  const disputeOpenedSource = parsedOpenSource ?? (participant ? "WEB_PUBLIC" : "WEB_ORGANIZATION");
  const { match: updated } = await updatePadelMatch({
    matchId: match.id,
    eventId: match.event.id,
    organizationId,
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
        disputeOpenedSource,
        disputeResolvedAt: null,
        disputeResolvedBy: null,
        disputeResolutionNote: null,
      },
    },
  });

  await recordOrganizationAuditSafe({
    organizationId,
    actorUserId: user.id,
    action: "PADEL_MATCH_DISPUTE_OPEN",
    metadata: {
      matchId: match.id,
      eventId: match.event.id,
      reason,
      disputeOpenedSource,
    },
  });

  const openActions = await prisma.$transaction((tx) =>
    reconcilePadelDisputeAntiFraud({
      tx,
      organizationId,
      userId: user.id,
      actorUserId: user.id,
    }),
  );
  for (const action of openActions) {
    await recordOrganizationAuditSafe({
      organizationId,
      actorUserId: user.id,
      action: action.kind === "APPLIED" ? "PADEL_RATING_SANCTION_AUTO_APPLIED" : "PADEL_RATING_SANCTION_AUTO_RESOLVED",
      metadata: {
        matchId: match.id,
        eventId: match.event.id,
        playerId: action.playerId,
        sanctionType: action.sanctionType,
        reasonCode: action.reasonCode,
        openDisputesCount: action.openDisputesCount,
        invalidDisputesCount: action.invalidDisputesCount,
        ...(action.kind === "APPLIED" ? { sanctionId: action.sanctionId } : { resolvedCount: action.resolvedCount }),
      },
    });
  }

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
      roundType: true,
      roundLabel: true,
      event: { select: { id: true, organizationId: true } },
    },
  });
  if (!match || !match.event?.organizationId) {
    return jsonWrap({ ok: false, error: "MATCH_NOT_FOUND" }, { status: 404 });
  }
  const organizationId = match.event.organizationId;

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
  if (body?.confirmationSource === undefined || body?.confirmationSource === null) {
    return jsonWrap({ ok: false, error: "MISSING_CONFIRMATION_SOURCE" }, { status: 400 });
  }
  if (body?.resolutionStatus === undefined || body?.resolutionStatus === null) {
    return jsonWrap({ ok: false, error: "MISSING_RESOLUTION_STATUS" }, { status: 400 });
  }
  const resolutionStatusRaw =
    typeof body?.resolutionStatus === "string" ? body.resolutionStatus.trim().toUpperCase() : "";
  const resolutionStatus = RESOLUTION_STATUSES.has(resolutionStatusRaw) ? resolutionStatusRaw : null;
  if (!resolutionStatus) {
    return jsonWrap({ ok: false, error: "INVALID_RESOLUTION_STATUS" }, { status: 400 });
  }

  const authority = await resolveIncidentAuthority({
    eventId: match.event.id,
    organizationId: match.event.organizationId,
    actorUserId: user.id,
    membershipRole: membership.role,
    roundType: match.roundType,
    roundLabel: match.roundLabel,
    requestedConfirmedByRole: body?.confirmedByRole,
    requestedConfirmationSource: body?.confirmationSource,
  });
  if (!authority.ok) {
    return jsonWrap({ ok: false, error: authority.error }, { status: authority.status });
  }

  const nowIso = new Date().toISOString();
  const { match: updated } = await updatePadelMatch({
    matchId: match.id,
    eventId: match.event.id,
    organizationId,
    actorUserId: user.id,
    beforeStatus: match.status ?? null,
    eventType: SYSTEM_MATCH_EVENT,
    data: {
      score: {
        ...score,
        ruleSnapshot,
        disputeStatus: "RESOLVED",
        disputeResolutionStatus: resolutionStatus,
        disputeResolvedAt: nowIso,
        disputeResolvedBy: user.id,
        disputeResolvedRole: authority.confirmedByRole,
        disputeResolutionSource: authority.confirmationSource,
        ...(resolutionNote ? { disputeResolutionNote: resolutionNote } : {}),
      },
    },
  });

  await recordOrganizationAuditSafe({
    organizationId,
    actorUserId: user.id,
    action: "PADEL_MATCH_DISPUTE_RESOLVE",
    metadata: {
      matchId: match.id,
      eventId: match.event.id,
      resolutionStatus,
      resolutionNote: resolutionNote || null,
      confirmedByRole: authority.confirmedByRole,
      confirmationSource: authority.confirmationSource,
    },
  });

  const disputedByUserId = typeof score.disputedBy === "string" ? score.disputedBy : null;
  if (disputedByUserId) {
    const resolveActions = await prisma.$transaction((tx) =>
      reconcilePadelDisputeAntiFraud({
        tx,
        organizationId,
        userId: disputedByUserId,
        actorUserId: user.id,
      }),
    );
    for (const action of resolveActions) {
      await recordOrganizationAuditSafe({
        organizationId,
        actorUserId: user.id,
        action: action.kind === "APPLIED" ? "PADEL_RATING_SANCTION_AUTO_APPLIED" : "PADEL_RATING_SANCTION_AUTO_RESOLVED",
        metadata: {
          matchId: match.id,
          eventId: match.event.id,
          disputedBy: disputedByUserId,
          playerId: action.playerId,
          sanctionType: action.sanctionType,
          reasonCode: action.reasonCode,
          openDisputesCount: action.openDisputesCount,
          invalidDisputesCount: action.invalidDisputesCount,
          ...(action.kind === "APPLIED" ? { sanctionId: action.sanctionId } : { resolvedCount: action.resolvedCount }),
        },
      });
    }
  }

  if (authority.confirmedByRole === "REFEREE") {
    const directorUserIds = await listTournamentDirectorUserIds({
      eventId: match.event.id,
      organizationId: match.event.organizationId,
      excludeUserId: user.id,
    });
    for (const directorUserId of directorUserIds) {
      const allow = await shouldNotify(directorUserId, "SYSTEM_ANNOUNCE");
      if (!allow) continue;
      await createNotification({
        userId: directorUserId,
        type: "SYSTEM_ANNOUNCE",
        title: "Disputa resolvida por árbitro",
        body: `Jogo #${match.id}: disputa resolvida (${resolutionStatus}).`,
        organizationId: match.event.organizationId,
        eventId: match.event.id,
        ctaUrl: `/org/${match.event.organizationId}/events/${match.event.id}`,
        dedupeKey: `padel_dispute_referee_notify:${match.id}:${resolutionStatus}`,
        payload: {
          kind: "PADEL_DISPUTE_REFEREE_RESOLVED",
          matchId: match.id,
          eventId: match.event.id,
          resolutionStatus,
          confirmedByRole: authority.confirmedByRole,
          confirmationSource: authority.confirmationSource,
        },
      });
    }
  }

  return jsonWrap({ ok: true, match: updated }, { status: 200 });
}
export const POST = withApiEnvelope(_POST);
export const PATCH = withApiEnvelope(_PATCH);
