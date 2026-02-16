export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { Prisma, padel_match_status } from "@prisma/client";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { updatePadelMatch } from "@/domain/padel/matches/commands";
import {
  buildConfirmTransition,
  buildIdempotencyScope,
  readIdempotencyReplay,
  writeIdempotencyRecord,
} from "@/domain/padel/resultWorkflow";
import {
  applyPendingExpiryIfNeeded,
  parseReasonCode,
  parseReasonText,
  parseResultBody,
  parseResultWinner,
  requireAuthenticatedUser,
  resolveClientRequestId,
  resolveResultRouteContext,
} from "@/app/api/padel/matches/[id]/result/_shared";
import { resolveIncidentAuthority } from "@/domain/padel/incidentGovernance";
import { recordOrganizationAuditSafe } from "@/lib/organizationAudit";
import { queueMatchResult } from "@/domain/notifications/tournament";

function resolveWinnerParticipantId(params: {
  winnerSide: "A" | "B" | null;
  participants: Array<{ side: "A" | "B"; participantId: number; slotOrder: number }>;
}) {
  if (!params.winnerSide) return null;
  const winnerRows = params.participants
    .filter((row) => row.side === params.winnerSide)
    .sort((a, b) => a.slotOrder - b.slotOrder || a.participantId - b.participantId);
  return winnerRows[0]?.participantId ?? null;
}

function parseEvidenceAttachments(value: unknown) {
  if (!Array.isArray(value)) return [] as string[];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0);
}

async function _POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthenticatedUser();
  if (!auth.ok) return jsonWrap({ ok: false, error: auth.error }, { status: auth.status });

  const resolved = await params;
  const matchId = Number(resolved?.id);
  if (!Number.isFinite(matchId)) {
    return jsonWrap({ ok: false, error: "INVALID_MATCH" }, { status: 400 });
  }

  const body = parseResultBody(await req.json().catch(() => null));
  if (!body) return jsonWrap({ ok: false, error: "INVALID_BODY" }, { status: 400 });

  const reasonCode = parseReasonCode(body.reasonCode);
  const reasonText = parseReasonText(body.reasonText);
  const evidenceAttachments = parseEvidenceAttachments(body.evidenceAttachments);

  if (!reasonCode) return jsonWrap({ ok: false, error: "MISSING_REASON_CODE" }, { status: 400 });
  if (!reasonText || reasonText.length < 5) {
    return jsonWrap({ ok: false, error: "INVALID_REASON_TEXT" }, { status: 400 });
  }
  if (evidenceAttachments.length < 1) {
    return jsonWrap({ ok: false, error: "MISSING_EVIDENCE_ATTACHMENTS" }, { status: 400 });
  }

  const contextResult = await resolveResultRouteContext({
    matchId,
    actorUserId: auth.user.id,
  });
  if (!contextResult.ok) {
    return jsonWrap({ ok: false, error: contextResult.error }, { status: contextResult.status });
  }
  const context = contextResult.ctx;

  if (!context.actor.canEditTournamentModule || !context.actor.organizationRole) {
    return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const authority = await resolveIncidentAuthority({
    eventId: context.match.eventId,
    organizationId: context.match.organizationId,
    actorUserId: auth.user.id,
    membershipRole: context.actor.organizationRole,
    roundType: context.match.roundType,
    roundLabel: context.match.roundLabel,
    requestedConfirmedByRole: body.confirmedByRole,
    requestedConfirmationSource: body.confirmationSource,
  });
  if (!authority.ok) {
    return jsonWrap({ ok: false, error: authority.error }, { status: authority.status });
  }

  const expiry = await applyPendingExpiryIfNeeded({
    context,
    actorUserId: auth.user.id,
  });
  if (expiry.changed) {
    context.match.status = expiry.match.status;
    context.match.score = expiry.match.score;
    context.match.scoreSets = expiry.match.scoreSets;
    context.match.winnerSide = expiry.match.winnerSide;
    context.match.winnerParticipantId = expiry.match.winnerParticipantId;
  }

  if (
    context.match.status !== padel_match_status.DISPUTED &&
    context.match.status !== padel_match_status.PENDING_REVIEW_EXPIRED
  ) {
    return jsonWrap({ ok: false, error: "INVALID_OVERRIDE_STATUS" }, { status: 409 });
  }

  const clientRequestId = resolveClientRequestId(req, body);
  if (!clientRequestId) {
    return jsonWrap({ ok: false, error: "MISSING_CLIENT_REQUEST_ID" }, { status: 400 });
  }

  const scopeKey = buildIdempotencyScope({
    tournamentId: context.match.eventId,
    matchId: context.match.id,
    action: "override_result",
    actorId: auth.user.id,
    clientRequestId,
  });

  const idempotencyReplay = readIdempotencyReplay({ score: context.match.score, scopeKey });
  if (idempotencyReplay) {
    return jsonWrap(
      {
        ok: true,
        idempotentReplay: true,
        match: {
          id: context.match.id,
          eventId: context.match.eventId,
          status: context.match.status,
          score: context.match.score,
          scoreSets: context.match.scoreSets,
        },
      },
      { status: 200 },
    );
  }

  const winnerSide = parseResultWinner(body.winnerSide ?? context.match.score.winnerSide ?? context.match.winnerSide);
  const winnerParticipantId = resolveWinnerParticipantId({
    winnerSide,
    participants: context.match.participants,
  });
  if (!winnerSide || !winnerParticipantId) {
    return jsonWrap({ ok: false, error: "INVALID_SCORE" }, { status: 400 });
  }

  const overrideAt = new Date().toISOString();
  const nextScoreBase = {
    ...context.match.score,
    winnerSide,
    overrideReasonCode: reasonCode,
    overrideReasonText: reasonText,
    overrideEvidenceAttachments: evidenceAttachments,
    overrideBy: auth.user.id,
    overrideAt,
    resolutionType: "OVERRIDE",
    disputeStatus:
      context.match.status === padel_match_status.DISPUTED ? "RESOLVED_BY_OVERRIDE" : context.match.score.disputeStatus ?? null,
    disputeResolvedBy: context.match.status === padel_match_status.DISPUTED ? auth.user.id : context.match.score.disputeResolvedBy ?? null,
    disputeResolvedAt: context.match.status === padel_match_status.DISPUTED ? overrideAt : context.match.score.disputeResolvedAt ?? null,
  } as Record<string, unknown>;

  const transition = buildConfirmTransition({
    currentStatus: context.match.status,
    currentScore: nextScoreBase,
    actorId: auth.user.id,
    actorKind: "STAFF",
    resolutionType: "OVERRIDE",
  });

  const persistedScore = writeIdempotencyRecord({
    score: transition.score,
    scopeKey,
    action: "override_result",
    actorId: auth.user.id,
    status: transition.status,
  });

  const { match: updated, outboxEventId } = await updatePadelMatch({
    matchId: context.match.id,
    eventId: context.match.eventId,
    organizationId: context.match.organizationId,
    actorUserId: auth.user.id,
    beforeStatus: context.match.status,
    eventType: "PADEL_MATCH_RESULT_OVERRIDDEN",
    outboxEventType: "PADEL_MATCH_RESULT_OVERRIDDEN",
    data: {
      status: transition.status,
      score: persistedScore as Prisma.InputJsonValue,
      winnerSide,
      winnerParticipantId,
    },
  });

  const participantUserIds = Array.from(
    new Set(
      context.match.participants
        .map((row) => row.userId)
        .filter((userId): userId is string => typeof userId === "string" && userId.length > 0),
    ),
  );
  if (participantUserIds.length > 0) {
    await queueMatchResult(participantUserIds, context.match.id, context.match.eventId);
  }

  await recordOrganizationAuditSafe({
    organizationId: context.match.organizationId,
    actorUserId: auth.user.id,
    action: "PADEL_MATCH_RESULT_OVERRIDE",
    metadata: {
      matchId: context.match.id,
      eventId: context.match.eventId,
      fromStatus: context.match.status,
      toStatus: transition.status,
      reasonCode,
      reasonText,
      evidenceAttachmentsCount: evidenceAttachments.length,
      clientRequestId,
      confirmedByRole: authority.confirmedByRole,
      confirmationSource: authority.confirmationSource,
      outboxEventId,
    },
  });

  return jsonWrap({ ok: true, match: updated, outboxEventId }, { status: 200 });
}

export const POST = withApiEnvelope(_POST);
