export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { updatePadelMatch } from "@/domain/padel/matches/commands";
import {
  buildIdempotencyScope,
  buildRejectTransition,
  readIdempotencyReplay,
  writeIdempotencyRecord,
} from "@/domain/padel/resultWorkflow";
import {
  applyPendingExpiryIfNeeded,
  parseReasonText,
  parseResultBody,
  requireAuthenticatedUser,
  resolveClientRequestId,
  resolveResultRouteContext,
} from "@/app/api/padel/matches/[id]/result/_shared";
import { resolveIncidentAuthority } from "@/domain/padel/incidentGovernance";
import { recordOrganizationAuditSafe } from "@/lib/organizationAudit";

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

  const reasonText = parseReasonText(body.reasonText ?? body.reason);
  if (!reasonText || reasonText.length < 5) {
    return jsonWrap({ ok: false, error: "INVALID_REASON_TEXT" }, { status: 400 });
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

  const clientRequestId = resolveClientRequestId(req, body);
  if (!clientRequestId) {
    return jsonWrap({ ok: false, error: "MISSING_CLIENT_REQUEST_ID" }, { status: 400 });
  }

  const scopeKey = buildIdempotencyScope({
    tournamentId: context.match.eventId,
    matchId: context.match.id,
    action: "reject_result",
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

  const transition = buildRejectTransition({
    currentStatus: context.match.status,
    currentScore: context.match.score,
    actorId: auth.user.id,
    actorKind: "STAFF",
    reasonText,
  });

  const persistedScore = writeIdempotencyRecord({
    score: transition.score,
    scopeKey,
    action: "reject_result",
    actorId: auth.user.id,
    status: transition.status,
  });

  const { match: updated, outboxEventId } = await updatePadelMatch({
    matchId: context.match.id,
    eventId: context.match.eventId,
    organizationId: context.match.organizationId,
    actorUserId: auth.user.id,
    beforeStatus: context.match.status,
    eventType: "PADEL_MATCH_RESULT_REJECTED",
    outboxEventType: "PADEL_MATCH_RESULT_REJECTED",
    data: {
      status: transition.status,
      score: persistedScore as Prisma.InputJsonValue,
      winnerSide: null,
      winnerParticipantId: null,
    },
  });

  await recordOrganizationAuditSafe({
    organizationId: context.match.organizationId,
    actorUserId: auth.user.id,
    action: "PADEL_MATCH_RESULT_REJECT",
    metadata: {
      matchId: context.match.id,
      eventId: context.match.eventId,
      fromStatus: context.match.status,
      toStatus: transition.status,
      reasonText,
      clientRequestId,
      confirmedByRole: authority.confirmedByRole,
      confirmationSource: authority.confirmationSource,
      outboxEventId,
    },
  });

  return jsonWrap({ ok: true, match: updated, outboxEventId }, { status: 200 });
}

export const POST = withApiEnvelope(_POST);
