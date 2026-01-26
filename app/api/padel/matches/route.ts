export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { OrganizationMemberRole, padel_match_status, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { isValidScore } from "@/lib/padel/validation";
import { resolvePadelCompetitionState } from "@/domain/padelCompetitionState";
import { recordOrganizationAuditSafe } from "@/lib/organizationAudit";
import { normalizePadelScoreRules, resolvePadelMatchStats } from "@/domain/padel/score";
import { enforcePublicRateLimit } from "@/lib/padel/publicRateLimit";
import { updatePadelMatch } from "@/domain/padel/matches/commands";

const ROLE_ALLOWLIST: OrganizationMemberRole[] = ["OWNER", "CO_OWNER", "ADMIN", "STAFF"];
const adminRoles = new Set<OrganizationMemberRole>(["OWNER", "CO_OWNER", "ADMIN"]);

export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const eventId = Number(req.nextUrl.searchParams.get("eventId"));
  const categoryId = Number(req.nextUrl.searchParams.get("categoryId"));
  if (!Number.isFinite(eventId)) return NextResponse.json({ ok: false, error: "INVALID_EVENT" }, { status: 400 });
  const matchCategoryFilter = Number.isFinite(categoryId) ? { categoryId } : {};

  const event = await prisma.event.findUnique({
    where: { id: eventId, isDeleted: false },
    select: {
      organizationId: true,
      status: true,
      publicAccessMode: true,
      inviteOnly: true,
      padelTournamentConfig: { select: { advancedSettings: true } },
    },
  });
  if (!event?.organizationId) return NextResponse.json({ ok: false, error: "EVENT_NOT_FOUND" }, { status: 404 });

  const rateLimited = await enforcePublicRateLimit(req, {
    keyPrefix: "padel_matches",
    identifier: user?.id ?? String(eventId),
    max: 240,
  });
  if (rateLimited) return rateLimited;

  const competitionState = resolvePadelCompetitionState({
    eventStatus: event.status,
    competitionState: (event.padelTournamentConfig?.advancedSettings as any)?.competitionState ?? null,
  });
  const isPublicEvent =
    event.publicAccessMode !== "INVITE" &&
    !event.inviteOnly &&
    ["PUBLISHED", "DATE_CHANGED", "FINISHED", "CANCELLED"].includes(event.status) &&
    competitionState === "PUBLIC";

  if (!user && !isPublicEvent) {
    return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
  }

  if (user && !isPublicEvent) {
    const { organization } = await getActiveOrganizationForUser(user.id, {
      organizationId: event.organizationId,
      roles: ROLE_ALLOWLIST,
    });
    if (!organization) return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const matches = await prisma.padelMatch.findMany({
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

  return NextResponse.json({ ok: true, items: matches }, { status: 200 });
}

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });

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

  if (!Number.isFinite(matchId)) return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400 });
  if (startAtRaw && Number.isNaN(startAtRaw.getTime())) {
    return NextResponse.json({ ok: false, error: "INVALID_START_AT" }, { status: 400 });
  }

  const match = await prisma.padelMatch.findUnique({
    where: { id: matchId },
    include: { event: { select: { organizationId: true } } },
  });
  if (!match || !match.event?.organizationId) return NextResponse.json({ ok: false, error: "MATCH_NOT_FOUND" }, { status: 404 });

  const { organization, membership } = await getActiveOrganizationForUser(user.id, {
    organizationId: match.event.organizationId,
    roles: ROLE_ALLOWLIST,
  });
  if (!organization || !membership) {
    return NextResponse.json({ ok: false, error: "NO_ORGANIZATION" }, { status: 403 });
  }

  const isAdmin = adminRoles.has(membership.role);

  if (scoreRaw && !isValidScore(scoreRaw)) {
    return NextResponse.json({ ok: false, error: "INVALID_SCORE" }, { status: 400 });
  }

  const scoreObj = scoreRaw && typeof scoreRaw === "object" ? (scoreRaw as Record<string, unknown>) : null;
  const nextStatus = statusRaw ?? match.status;

  const existingScore =
    match.score && typeof match.score === "object" ? (match.score as Record<string, unknown>) : {};
  if (existingScore.disputeStatus === "OPEN" && !isAdmin) {
    return NextResponse.json({ ok: false, error: "MATCH_DISPUTED" }, { status: 423 });
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
    return NextResponse.json({ ok: false, error: "INVALID_SCORE" }, { status: 400 });
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
    return NextResponse.json({ ok: false, error: "INVALID_SCORE" }, { status: 400 });
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

  return NextResponse.json({ ok: true, match: updated, outboxEventId }, { status: 200 });
}
