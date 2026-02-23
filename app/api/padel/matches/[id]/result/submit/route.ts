export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { Prisma, padel_match_status } from "@prisma/client";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { updatePadelMatch } from "@/domain/padel/matches/commands";
import {
  buildIdempotencyScope,
  buildSubmitTransition,
  readIdempotencyReplay,
  writeIdempotencyRecord,
} from "@/domain/padel/resultWorkflow";
import {
  applyPendingExpiryIfNeeded,
  parseResultBody,
  parseResultType,
  requireAuthenticatedUser,
  resolveClientRequestId,
  resolveResultScoreRulesContext,
  resolveResultRouteContext,
} from "@/app/api/padel/matches/[id]/result/_shared";
import { recordOrganizationAuditSafe } from "@/lib/organizationAudit";
import { queueMatchResult } from "@/domain/notifications/tournament";
import { resolveLiveResultScore } from "@/domain/padel/liveResultScore";

const FINAL_STATUSES = new Set<padel_match_status>([
  padel_match_status.OFFICIAL,
  padel_match_status.WALKOVER,
  padel_match_status.RETIRED,
]);

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

  const actorKind =
    context.actor.canEditTournamentModule && context.actor.isOrgMember
      ? "STAFF"
      : context.actor.isParticipant
        ? "PLAYER"
        : null;

  if (!actorKind) {
    return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  if (actorKind === "PLAYER" && !context.match.playerResultSubmissionEnabled) {
    return jsonWrap({ ok: false, error: "PLAYER_SUBMISSION_DISABLED" }, { status: 403 });
  }

  if (
    context.match.status === padel_match_status.PENDING_CONFIRMATION ||
    context.match.status === padel_match_status.PENDING_REVIEW_EXPIRED ||
    context.match.status === padel_match_status.DISPUTED
  ) {
    return jsonWrap({ ok: false, error: "RESULT_REVIEW_IN_PROGRESS" }, { status: 409 });
  }

  if (
    context.match.status === padel_match_status.OFFICIAL ||
    context.match.status === padel_match_status.WALKOVER ||
    context.match.status === padel_match_status.RETIRED ||
    context.match.status === padel_match_status.CANCELLED
  ) {
    return jsonWrap({ ok: false, error: "MATCH_FINALIZED_USE_RESULT_WORKFLOW" }, { status: 409 });
  }

  const clientRequestId = resolveClientRequestId(req, body);
  if (!clientRequestId) {
    return jsonWrap({ ok: false, error: "MISSING_CLIENT_REQUEST_ID" }, { status: 400 });
  }

  const scopeKey = buildIdempotencyScope({
    tournamentId: context.match.eventId,
    matchId: context.match.id,
    action: "submit_result",
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

  const scoreInput = body.score && typeof body.score === "object" && !Array.isArray(body.score)
    ? (body.score as Record<string, unknown>)
    : null;
  if (!scoreInput) {
    return jsonWrap({ ok: false, error: "INVALID_SCORE" }, { status: 400 });
  }

  const resultType = parseResultType(scoreInput.resultType);
  if (resultType !== "NORMAL") {
    return jsonWrap({ ok: false, error: "SPECIAL_RESULT_REQUIRES_INCIDENT_ENDPOINT" }, { status: 409 });
  }

  const { scoreRules, ruleSnapshot } = await resolveResultScoreRulesContext(context.match.eventId);
  const scoreEvaluation = resolveLiveResultScore({
    incomingScore: {
      ...context.match.score,
      ...scoreInput,
      resultType,
    },
    currentScoreSets: context.match.scoreSets,
    fallbackWinnerSide: context.match.winnerSide,
    scoreRules,
  });
  if (scoreEvaluation.hasScoreEvidence && !scoreEvaluation.stats) {
    return jsonWrap({ ok: false, error: "INVALID_SCORE" }, { status: 400 });
  }
  const winnerSide = scoreEvaluation.winnerSide;
  const mergedScore = {
    ...context.match.score,
    ...scoreInput,
    resultType,
    ...(winnerSide ? { winnerSide } : {}),
    ...(scoreEvaluation.stats?.mode === "TIMED_GAMES"
      ? {
          mode: "TIMED_GAMES",
          gamesA: scoreEvaluation.stats.aGames,
          gamesB: scoreEvaluation.stats.bGames,
        }
      : {}),
    ruleSnapshot,
    resultSubmittedBy: auth.user.id,
    resultSubmittedByActorKind: actorKind,
    resultSubmittedAt: new Date().toISOString(),
  } as Record<string, unknown>;

  const transition = buildSubmitTransition({
    config: {
      resultValidationMode: context.match.resultValidationMode,
      pendingConfirmationWindowMinutes: context.match.pendingConfirmationWindowMinutes,
      playerResultSubmissionEnabled: context.match.playerResultSubmissionEnabled,
    },
    actorKind,
    currentStatus: context.match.status,
    currentScore: context.match.score,
    incomingScorePatch: mergedScore,
    actorId: auth.user.id,
  });

  const transitionStatus = transition.status;
  const persistedScore = writeIdempotencyRecord({
    score: transition.score,
    scopeKey,
    action: "submit_result",
    actorId: auth.user.id,
    status: transitionStatus,
  });

  const winnerParticipantId = resolveWinnerParticipantId({
    winnerSide,
    participants: context.match.participants,
  });

  if (
    FINAL_STATUSES.has(transitionStatus) &&
    !scoreEvaluation.isDrawResult &&
    !scoreEvaluation.isByeNeutral &&
    (!winnerSide || !winnerParticipantId)
  ) {
    return jsonWrap({ ok: false, error: "INVALID_SCORE" }, { status: 400 });
  }

  const nextScoreSets = scoreEvaluation.nextScoreSets;

  const { match: updated, outboxEventId } = await updatePadelMatch({
    matchId: context.match.id,
    eventId: context.match.eventId,
    organizationId: context.match.organizationId,
    actorUserId: auth.user.id,
    beforeStatus: context.match.status,
    eventType: "PADEL_MATCH_RESULT_SUBMITTED",
    outboxEventType: "PADEL_MATCH_RESULT_SUBMITTED",
    data: {
      status: transitionStatus,
      score: persistedScore as Prisma.InputJsonValue,
      scoreSets: nextScoreSets,
      winnerSide:
        FINAL_STATUSES.has(transitionStatus) && !scoreEvaluation.isDrawResult && !scoreEvaluation.isByeNeutral
          ? winnerSide
          : null,
      winnerParticipantId:
        FINAL_STATUSES.has(transitionStatus) && !scoreEvaluation.isDrawResult && !scoreEvaluation.isByeNeutral
          ? winnerParticipantId
          : null,
    },
  });

  const participantUserIds = Array.from(
    new Set(
      context.match.participants
        .map((row) => row.userId)
        .filter((userId): userId is string => typeof userId === "string" && userId.length > 0),
    ),
  );

  if (FINAL_STATUSES.has(transitionStatus) && participantUserIds.length > 0) {
    await queueMatchResult(participantUserIds, context.match.id, context.match.eventId);
  }

  await recordOrganizationAuditSafe({
    organizationId: context.match.organizationId,
    actorUserId: auth.user.id,
    action: "PADEL_MATCH_RESULT_SUBMIT",
    metadata: {
      matchId: context.match.id,
      eventId: context.match.eventId,
      actorKind,
      fromStatus: context.match.status,
      toStatus: transitionStatus,
      clientRequestId,
      resultType,
      outboxEventId,
    },
  });

  return jsonWrap(
    {
      ok: true,
      match: updated,
      outboxEventId,
    },
    { status: 200 },
  );
}

export const POST = withApiEnvelope(_POST);
