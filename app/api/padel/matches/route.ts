export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { OrganizationMemberRole, OrganizationModule, padel_match_status, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { ensureMemberModuleAccess } from "@/lib/organizationMemberAccess";
import { isValidScore } from "@/lib/padel/validation";
import { resolvePadelCompetitionState } from "@/domain/padelCompetitionState";
import { recordOrganizationAuditSafe } from "@/lib/organizationAudit";
import { normalizePadelScoreRules, resolvePadelMatchStats } from "@/domain/padel/score";
import { enforcePublicRateLimit } from "@/lib/padel/publicRateLimit";
import { updatePadelMatch } from "@/domain/padel/matches/commands";
import { isPublicAccessMode, resolveEventAccessMode } from "@/lib/events/accessPolicy";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { getRequestContext, type RequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";

const ROLE_ALLOWLIST: OrganizationMemberRole[] = ["OWNER", "CO_OWNER", "ADMIN", "STAFF"];
const adminRoles = new Set<OrganizationMemberRole>(["OWNER", "CO_OWNER", "ADMIN"]);

function fail(
  ctx: RequestContext,
  status: number,
  message: string,
  errorCode = errorCodeForStatus(status),
  retryable = status >= 500,
) {
  const resolvedMessage = typeof message === "string" ? message : String(message);
  const resolvedCode = /^[A-Z0-9_]+$/.test(resolvedMessage) ? resolvedMessage : errorCode;
  return respondError(ctx, { errorCode: resolvedCode, message: resolvedMessage, retryable }, { status });
}

async function _GET(req: NextRequest) {
  const ctx = getRequestContext(req);
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const eventId = Number(req.nextUrl.searchParams.get("eventId"));
  const categoryId = Number(req.nextUrl.searchParams.get("categoryId"));
  if (!Number.isFinite(eventId)) return fail(ctx, 400, "INVALID_EVENT");
  const matchCategoryFilter = Number.isFinite(categoryId) ? { categoryId } : {};

  const event = await prisma.event.findUnique({
    where: { id: eventId, isDeleted: false },
    select: {
      organizationId: true,
      status: true,
      padelTournamentConfig: { select: { advancedSettings: true, lifecycleStatus: true } },
      accessPolicies: {
        orderBy: { policyVersion: "desc" },
        take: 1,
        select: { mode: true },
      },
    },
  });
  if (!event?.organizationId) return fail(ctx, 404, "EVENT_NOT_FOUND");

  const rateLimited = await enforcePublicRateLimit(req, {
    keyPrefix: "padel_matches",
    identifier: user?.id ?? String(eventId),
    max: 240,
  });
  if (rateLimited) return rateLimited;

  const competitionState = resolvePadelCompetitionState({
    eventStatus: event.status,
    competitionState: (event.padelTournamentConfig?.advancedSettings as any)?.competitionState ?? null,
    lifecycleStatus: event.padelTournamentConfig?.lifecycleStatus ?? null,
  });
  const accessMode = resolveEventAccessMode(event.accessPolicies?.[0]);
  const isPublicEvent =
    isPublicAccessMode(accessMode) &&
    ["PUBLISHED", "DATE_CHANGED", "FINISHED", "CANCELLED"].includes(event.status) &&
    competitionState === "PUBLIC";

  if (!user && !isPublicEvent) {
    return fail(ctx, 401, "UNAUTHENTICATED");
  }

  if (user && !isPublicEvent) {
    const { organization } = await getActiveOrganizationForUser(user.id, {
      organizationId: event.organizationId,
      roles: ROLE_ALLOWLIST,
    });
    if (!organization) return fail(ctx, 403, "FORBIDDEN");
  }

  const matches = await prisma.eventMatchSlot.findMany({
    where: { eventId, ...matchCategoryFilter },
    include: {
      pairingA: { include: { slots: { include: { playerProfile: true } } } },
      pairingB: { include: { slots: { include: { playerProfile: true } } } },
    },
    orderBy: [
      { roundType: "asc" },
      { groupLabel: "asc" },
      { startTime: "asc" },
      { id: "asc" },
    ],
  });

  return respondOk(ctx, { items: matches }, { status: 200 });
}

async function _POST(req: NextRequest) {
  const ctx = getRequestContext(req);
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return fail(ctx, 401, "UNAUTHENTICATED");

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return fail(ctx, 400, "INVALID_BODY");

  const matchId = typeof body.id === "number" ? body.id : Number(body.id);
  const statusRaw =
    typeof body.status === "string" && Object.values(padel_match_status).includes(body.status as padel_match_status)
      ? (body.status as padel_match_status)
      : undefined;
  const scoreRaw = body.score;
  const startAtRaw = body.startAt ? new Date(String(body.startAt)) : undefined;
  const courtIdRaw =
    typeof body.courtId === "number"
      ? body.courtId
      : typeof body.courtId === "string"
        ? Number(body.courtId)
        : undefined;
  const courtNumberRaw =
    typeof body.courtNumber === "number"
      ? body.courtNumber
      : typeof body.courtNumber === "string"
        ? Number(body.courtNumber)
        : undefined;

  if (!Number.isFinite(matchId)) return fail(ctx, 400, "INVALID_ID");
  if (startAtRaw && Number.isNaN(startAtRaw.getTime())) {
    return fail(ctx, 400, "INVALID_START_AT");
  }

  const match = await prisma.eventMatchSlot.findUnique({
    where: { id: matchId },
    select: {
      id: true,
      eventId: true,
      status: true,
      score: true,
      scoreSets: true,
      pairingAId: true,
      pairingBId: true,
      winnerPairingId: true,
      startTime: true,
      courtId: true,
      courtNumber: true,
      event: { select: { organizationId: true } },
    },
  });
  if (!match || !match.event?.organizationId) return fail(ctx, 404, "MATCH_NOT_FOUND");

  const { organization, membership } = await getActiveOrganizationForUser(user.id, {
    organizationId: match.event.organizationId,
    roles: ROLE_ALLOWLIST,
  });
  if (!organization || !membership) {
    return fail(ctx, 403, "NO_ORGANIZATION");
  }
  const permission = await ensureMemberModuleAccess({
    organizationId: match.event.organizationId,
    userId: user.id,
    role: membership.role,
    rolePack: membership.rolePack,
    moduleKey: OrganizationModule.TORNEIOS,
    required: "EDIT",
  });
  if (!permission.ok) {
    return fail(ctx, 403, "FORBIDDEN");
  }

  const isAdmin = adminRoles.has(membership.role);

  if (scoreRaw && !isValidScore(scoreRaw)) {
    return fail(ctx, 400, "INVALID_SCORE");
  }

  const scoreObj = scoreRaw && typeof scoreRaw === "object" ? (scoreRaw as Record<string, unknown>) : null;
  const nextStatus = statusRaw ?? match.status;

  const existingScore =
    match.score && typeof match.score === "object" ? (match.score as Record<string, unknown>) : {};
  if (existingScore.disputeStatus === "OPEN" && !isAdmin) {
    return fail(ctx, 423, "MATCH_DISPUTED");
  }
  const mergedScore =
    scoreObj && typeof scoreObj === "object"
      ? ({ ...existingScore, ...scoreObj } as Record<string, unknown>)
      : (existingScore as Record<string, unknown>);

  const hasIncomingSets = scoreObj && Object.prototype.hasOwnProperty.call(scoreObj, "sets");
  const incomingSets = hasIncomingSets ? (scoreObj as { sets?: unknown }).sets : undefined;
  const fallbackSets = Array.isArray(match.scoreSets)
    ? match.scoreSets
    : Array.isArray((existingScore as { sets?: unknown }).sets)
      ? (existingScore as { sets?: unknown }).sets
      : null;
  const rawSets = hasIncomingSets ? incomingSets : fallbackSets;
  const resultType = mergedScore?.resultType;
  const isWalkover =
    mergedScore?.walkover === true ||
    resultType === "WALKOVER" ||
    resultType === "RETIREMENT" ||
    resultType === "INJURY";
  const shouldApplyScoreRules = hasIncomingSets || isWalkover;
  const configForScore = shouldApplyScoreRules
    ? await prisma.padelTournamentConfig.findUnique({
        where: { eventId: match.eventId },
        select: { advancedSettings: true },
      })
    : null;
  const scoreRules = shouldApplyScoreRules
    ? normalizePadelScoreRules((configForScore?.advancedSettings as Record<string, unknown> | null)?.scoreRules)
    : null;
  const stats = resolvePadelMatchStats(rawSets, mergedScore, shouldApplyScoreRules ? scoreRules ?? undefined : undefined);

  if (Array.isArray(rawSets) && rawSets.length > 0 && nextStatus === "DONE" && !stats) {
    return fail(ctx, 400, "INVALID_SCORE");
  }

  let winnerPairingId: number | null = null;
  const winnerSideRaw = mergedScore?.winnerSide;
  const winnerSide =
    stats?.winner ?? (winnerSideRaw === "A" || winnerSideRaw === "B" ? winnerSideRaw : null);
  if (winnerSide === "A" && match.pairingAId) winnerPairingId = match.pairingAId;
  if (winnerSide === "B" && match.pairingBId) winnerPairingId = match.pairingBId;

  const shouldSetWinner = nextStatus === "DONE";
  if (shouldSetWinner && !winnerPairingId) {
    if (match.pairingAId && !match.pairingBId) winnerPairingId = match.pairingAId;
    if (!match.pairingAId && match.pairingBId) winnerPairingId = match.pairingBId;
  }
  if (shouldSetWinner && !winnerPairingId) {
    return fail(ctx, 400, "INVALID_SCORE");
  }

  const scoreValue = (scoreObj ? mergedScore : existingScore) as Prisma.InputJsonValue;
  const shouldSetScoreSetsFromStats =
    !hasIncomingSets && nextStatus === "DONE" && stats?.sets && !Array.isArray(match.scoreSets);
  const scoreSetsValue = hasIncomingSets
    ? ((stats?.sets ?? incomingSets) as Prisma.InputJsonValue)
    : shouldSetScoreSetsFromStats
      ? (stats?.sets as Prisma.InputJsonValue)
      : (match.scoreSets as Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined);
  let courtIdValue: number | undefined;
  let courtNumberValue: number | undefined;
  if (Number.isFinite(courtIdRaw)) {
    const courtIdCandidate = Math.floor(courtIdRaw as number);
    const courtExists = await prisma.padelClubCourt.findFirst({
      where: { id: courtIdCandidate, club: { organizationId: match.event.organizationId } },
      select: { id: true },
    });
    if (courtExists) {
      courtIdValue = courtIdCandidate;
    } else {
      // Backwards compatibility: treat non-matching courtId as display number.
      courtNumberValue = courtIdCandidate;
    }
  }
  if (Number.isFinite(courtNumberRaw)) {
    courtNumberValue = Math.floor(courtNumberRaw as number);
  }

  const { match: updated, outboxEventId } = await updatePadelMatch({
    matchId,
    eventId: match.eventId,
    organizationId: match.event.organizationId,
    actorUserId: user.id,
    beforeStatus: match.status ?? null,
    data: {
      status: nextStatus,
      score: scoreValue,
      scoreSets: scoreSetsValue,
      winnerPairingId: shouldSetWinner ? winnerPairingId ?? match.winnerPairingId : match.winnerPairingId,
      startTime: startAtRaw ?? match.startTime,
      courtId: courtIdValue ?? match.courtId,
      ...(typeof courtNumberValue === "number" ? { courtNumber: courtNumberValue } : {}),
    },
    include: {
      pairingA: { include: { slots: { include: { playerProfile: true } } } },
      pairingB: { include: { slots: { include: { playerProfile: true } } } },
    },
  });

  const beforeScore = match.score && typeof match.score === "object" ? match.score : null;
  const beforeScoreSets = Array.isArray(match.scoreSets) ? match.scoreSets : null;
  const afterScore = scoreValue && typeof scoreValue === "object" ? scoreValue : null;
  const afterScoreSets = Array.isArray(scoreSetsValue) ? scoreSetsValue : null;

  await recordOrganizationAuditSafe({
    organizationId: match.event.organizationId,
    actorUserId: user.id,
    action: "PADEL_MATCH_RESULT",
    metadata: {
      matchId: updated.id,
      eventId: updated.eventId,
      status: updated.status,
      winnerPairingId: updated.winnerPairingId ?? null,
      before: {
        status: match.status,
        winnerPairingId: match.winnerPairingId ?? null,
        score: beforeScore,
        scoreSets: beforeScoreSets,
      },
      after: {
        status: updated.status,
        winnerPairingId: updated.winnerPairingId ?? null,
        score: afterScore,
        scoreSets: afterScoreSets,
      },
    },
  });

  return respondOk(ctx, { match: updated, outboxEventId }, { status: 200 });
}

export const GET = withApiEnvelope(_GET);
export const POST = withApiEnvelope(_POST);

function errorCodeForStatus(status: number) {
  if (status === 401) return "UNAUTHENTICATED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 409) return "CONFLICT";
  if (status === 410) return "GONE";
  if (status === 413) return "PAYLOAD_TOO_LARGE";
  if (status === 422) return "VALIDATION_FAILED";
  if (status === 400) return "BAD_REQUEST";
  return "INTERNAL_ERROR";
}
