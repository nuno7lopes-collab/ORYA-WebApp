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
  parseResultBody,
  requireAuthenticatedUser,
  resolveClientRequestId,
  resolveResultScoreRulesContext,
  resolveResultRouteContext,
} from "@/app/api/padel/matches/[id]/result/_shared";
import { recordOrganizationAuditSafe } from "@/lib/organizationAudit";
import { queueMatchResult } from "@/domain/notifications/tournament";
import { resolveIncidentAuthority } from "@/domain/padel/incidentGovernance";
import { resolveLiveResultScore } from "@/domain/padel/liveResultScore";

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

async function _POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuthenticatedUser();
  if (!auth.ok) return jsonWrap({ ok: false, error: auth.error }, { status: auth.status });

  const resolved = await params;
  const matchId = Number(resolved?.id);
  if (!Number.isInteger(matchId) || matchId <= 0) {
    return jsonWrap({ ok: false, error: "INVALID_MATCH" }, { status: 400 });
  }

  const body = parseResultBody(await req.json().catch(() => null));
  if (!body) return jsonWrap({ ok: false, error: "INVALID_BODY" }, { status: 400 });

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

  const clientRequestId = resolveClientRequestId(req, body);
  if (!clientRequestId) {
    return jsonWrap({ ok: false, error: "MISSING_CLIENT_REQUEST_ID" }, { status: 400 });
  }

  const scopeKey = buildIdempotencyScope({
    tournamentId: context.match.eventId,
    matchId: context.match.id,
    action: "confirm_result",
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
          winnerSide: context.match.winnerSide,
          winnerParticipantId: context.match.winnerParticipantId,
        },
      },
      { status: 200 },
    );
  }

  const transition = buildConfirmTransition({
    currentStatus: context.match.status,
    currentScore: {
      ...context.match.score,
      resultConfirmedBy: auth.user.id,
      resultConfirmedByRole: authority.confirmedByRole,
      resultConfirmationSource: authority.confirmationSource,
      resultConfirmedAt: new Date().toISOString(),
    },
    actorId: auth.user.id,
    actorKind: "STAFF",
    resolutionType: "CONFIRM",
  });

  if (transition.noop) {
    return jsonWrap(
      {
        ok: true,
        noop: true,
        match: {
          id: context.match.id,
          eventId: context.match.eventId,
          status: context.match.status,
          score: context.match.score,
          scoreSets: context.match.scoreSets,
          winnerSide: context.match.winnerSide,
          winnerParticipantId: context.match.winnerParticipantId,
        },
      },
      { status: 200 },
    );
  }

  const { scoreRules } = await resolveResultScoreRulesContext(context.match.eventId);
  const scoreEvaluation = resolveLiveResultScore({
    incomingScore: transition.score as Record<string, unknown>,
    currentScoreSets: context.match.scoreSets,
    fallbackWinnerSide: context.match.winnerSide,
    scoreRules,
  });
  if (scoreEvaluation.hasScoreEvidence && !scoreEvaluation.stats) {
    return jsonWrap({ ok: false, error: "INVALID_SCORE" }, { status: 400 });
  }
  const winnerSide = scoreEvaluation.winnerSide;
  const winnerParticipantId = resolveWinnerParticipantId({
    winnerSide,
    participants: context.match.participants,
  });

  if (
    transition.status === padel_match_status.OFFICIAL ||
    transition.status === padel_match_status.WALKOVER ||
    transition.status === padel_match_status.RETIRED
  ) {
    if (
      !scoreEvaluation.isDrawResult &&
      !scoreEvaluation.isByeNeutral &&
      (!winnerSide || !winnerParticipantId)
    ) {
      return jsonWrap({ ok: false, error: "INVALID_SCORE" }, { status: 400 });
    }
  }

  const persistedScore = writeIdempotencyRecord({
    score: transition.score,
    scopeKey,
    action: "confirm_result",
    actorId: auth.user.id,
    status: transition.status,
  });

  const { match: updated, outboxEventId } = await updatePadelMatch({
    matchId: context.match.id,
    eventId: context.match.eventId,
    organizationId: context.match.organizationId,
    actorUserId: auth.user.id,
    beforeStatus: context.match.status,
    eventType: "PADEL_MATCH_RESULT_CONFIRMED",
    outboxEventType: "PADEL_MATCH_RESULT_CONFIRMED",
    data: {
      status: transition.status,
      score: persistedScore as Prisma.InputJsonValue,
      scoreSets: scoreEvaluation.nextScoreSets,
      winnerSide: scoreEvaluation.isDrawResult || scoreEvaluation.isByeNeutral ? null : winnerSide,
      winnerParticipantId:
        scoreEvaluation.isDrawResult || scoreEvaluation.isByeNeutral ? null : winnerParticipantId,
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
    await queueMatchResult(participantUserIds, context.match.id, context.match.eventId, {
      eventType: "RESULT_CONFIRMED",
      priority: "CRITICAL",
    });
  }

  await recordOrganizationAuditSafe({
    organizationId: context.match.organizationId,
    actorUserId: auth.user.id,
    action: "PADEL_MATCH_RESULT_CONFIRM",
    metadata: {
      matchId: context.match.id,
      eventId: context.match.eventId,
      fromStatus: context.match.status,
      toStatus: transition.status,
      clientRequestId,
      confirmedByRole: authority.confirmedByRole,
      confirmationSource: authority.confirmationSource,
      outboxEventId,
    },
  });

  return jsonWrap({ ok: true, match: updated, outboxEventId }, { status: 200 });
}

export const POST = withApiEnvelope(_POST);
