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
import { syncPadelCompetitiveCore } from "@/domain/padel/competitiveCoreSync";
import { normalizePadelScoreRules, resolvePadelMatchStats } from "@/domain/padel/score";
import { enforcePublicRateLimit } from "@/lib/padel/publicRateLimit";
import { updatePadelMatch } from "@/domain/padel/matches/commands";
import { isPublicAccessMode, resolveEventAccessMode } from "@/lib/events/accessPolicy";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { getRequestContext, type RequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { enforceMobileVersionGate } from "@/lib/http/mobileVersionGate";

const ROLE_ALLOWLIST: OrganizationMemberRole[] = ["OWNER", "CO_OWNER", "ADMIN", "STAFF"];
const adminRoles = new Set<OrganizationMemberRole>(["OWNER", "CO_OWNER", "ADMIN"]);
const SPECIAL_RESULT_TYPES = new Set(["WALKOVER", "RETIREMENT", "INJURY"]);

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
  const mobileGate = enforceMobileVersionGate(req);
  if (mobileGate) return mobileGate;

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
  const mobileGate = enforceMobileVersionGate(req);
  if (mobileGate) return mobileGate;

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
  let mergedScore =
    scoreObj && typeof scoreObj === "object"
      ? ({ ...existingScore, ...scoreObj } as Record<string, unknown>)
      : (existingScore as Record<string, unknown>);

  const resultTypeRaw = typeof mergedScore?.resultType === "string" ? mergedScore.resultType.trim().toUpperCase() : null;
  const isSpecialResult =
    mergedScore?.walkover === true || (resultTypeRaw ? SPECIAL_RESULT_TYPES.has(resultTypeRaw) : false);
  if (isSpecialResult) {
    return fail(ctx, 409, "SPECIAL_RESULT_REQUIRES_INCIDENT_ENDPOINT");
  }

  const hasIncomingSets = scoreObj && Object.prototype.hasOwnProperty.call(scoreObj, "sets");
  const hasTimedPayload =
    !!scoreObj &&
    (scoreObj.mode === "TIMED_GAMES" ||
      Object.prototype.hasOwnProperty.call(scoreObj, "gamesA") ||
      Object.prototype.hasOwnProperty.call(scoreObj, "gamesB") ||
      Object.prototype.hasOwnProperty.call(scoreObj, "endedByBuzzer") ||
      Object.prototype.hasOwnProperty.call(scoreObj, "endedAt"));
  const incomingSets = hasIncomingSets ? (scoreObj as { sets?: unknown }).sets : undefined;
  const fallbackSets = Array.isArray(match.scoreSets)
    ? match.scoreSets
    : Array.isArray((existingScore as { sets?: unknown }).sets)
      ? (existingScore as { sets?: unknown }).sets
      : null;
  const rawSets = hasIncomingSets ? incomingSets : fallbackSets;
  const isWalkover = false;
  const shouldApplyScoreRules = hasIncomingSets || hasTimedPayload || isWalkover;
  const configForScore = shouldApplyScoreRules
    ? await prisma.padelTournamentConfig.findUnique({
        where: { eventId: match.eventId },
        select: { advancedSettings: true, ruleSetId: true, ruleSetVersionId: true },
      })
    : null;
  const scoreRules = shouldApplyScoreRules
    ? normalizePadelScoreRules((configForScore?.advancedSettings as Record<string, unknown> | null)?.scoreRules)
    : null;
  const stats = resolvePadelMatchStats(rawSets, mergedScore, shouldApplyScoreRules ? scoreRules ?? undefined : undefined);

  if (Array.isArray(rawSets) && rawSets.length > 0 && nextStatus === "DONE" && !stats) {
    return fail(ctx, 400, "INVALID_SCORE");
  }

  if (shouldApplyScoreRules) {
    mergedScore = {
      ...mergedScore,
      ruleSnapshot: {
        source:
          configForScore?.ruleSetVersionId != null
            ? "VERSION"
            : configForScore?.ruleSetId != null
              ? "RULESET"
              : "DEFAULT",
        ruleSetId: configForScore?.ruleSetId ?? null,
        ruleSetVersionId: configForScore?.ruleSetVersionId ?? null,
        capturedAt: new Date().toISOString(),
      },
    };
  }

  const isDrawResult = stats?.isDraw === true;
  const isByeNeutral = stats?.resultType === "BYE_NEUTRAL";
  let winnerPairingId: number | null = null;
  const winnerSideRaw = mergedScore?.winnerSide;
  const winnerSide =
    stats?.winner ?? (winnerSideRaw === "A" || winnerSideRaw === "B" ? winnerSideRaw : null);
  if (winnerSide === "A" && match.pairingAId) winnerPairingId = match.pairingAId;
  if (winnerSide === "B" && match.pairingBId) winnerPairingId = match.pairingBId;

  const shouldSetWinner = nextStatus === "DONE";
  if (shouldSetWinner && !winnerPairingId && !isDrawResult && !isByeNeutral) {
    if (match.pairingAId && !match.pairingBId) winnerPairingId = match.pairingAId;
    if (!match.pairingAId && match.pairingBId) winnerPairingId = match.pairingBId;
  }
  if (shouldSetWinner && !winnerPairingId && !isDrawResult && !isByeNeutral) {
    return fail(ctx, 400, "INVALID_SCORE");
  }

  const scoreValue = (scoreObj ? mergedScore : existingScore) as Prisma.InputJsonValue;
  const shouldSetScoreSetsFromStats =
    !hasIncomingSets &&
    nextStatus === "DONE" &&
    stats?.mode === "SETS" &&
    Array.isArray(stats?.sets) &&
    stats.sets.length > 0 &&
    !Array.isArray(match.scoreSets);
  const shouldResetScoreSetsForTimed =
    !hasIncomingSets && nextStatus === "DONE" && stats?.mode === "TIMED_GAMES";
  const scoreSetsValue = hasIncomingSets
    ? ((stats?.sets ?? incomingSets) as Prisma.InputJsonValue)
    : shouldResetScoreSetsForTimed
      ? ([] as Prisma.InputJsonValue)
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
      return fail(ctx, 400, "INVALID_COURT_ID");
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
      winnerPairingId: shouldSetWinner
        ? isDrawResult || isByeNeutral
          ? null
          : winnerPairingId ?? match.winnerPairingId
        : match.winnerPairingId,
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

  try {
    const syncResult = await syncPadelCompetitiveCore({
      eventId: match.eventId,
      categoryId: (updated as { categoryId?: number | null }).categoryId ?? null,
    });
    if (!syncResult.ok) {
      console.warn("[padel/matches] competitive core sync skipped", {
        eventId: match.eventId,
        categoryId: (updated as { categoryId?: number | null }).categoryId ?? null,
      });
    }
  } catch (syncError) {
    console.warn("[padel/matches] competitive core sync failed (non-blocking)", syncError);
  }

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
