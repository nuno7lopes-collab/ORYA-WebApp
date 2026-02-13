export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { OrganizationMemberRole, OrganizationModule, Prisma } from "@prisma/client";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { ensureMemberModuleAccess } from "@/lib/organizationMemberAccess";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { recordOrganizationAuditSafe } from "@/lib/organizationAudit";
import { enforceMobileVersionGate } from "@/lib/http/mobileVersionGate";
import {
  computePadelStandingsByGroupForPlayers,
  normalizePadelPointsTable,
  normalizePadelTieBreakRules,
} from "@/domain/padel/standings";
import {
  buildMexicanoRoundRelations,
  deriveMexicanoRoundEntries,
} from "@/domain/padel/mexicanoRecomposition";

const WRITE_ROLES: OrganizationMemberRole[] = ["OWNER", "CO_OWNER", "ADMIN", "STAFF"];

type TimerState = {
  status: "IDLE" | "RUNNING" | "STOPPED";
  roundNumber: number;
  durationSeconds: number;
  startedAt: string | null;
  stoppedAt: string | null;
  updatedAt: string;
};

type MexicanoRecompositionSummary = {
  categories: Array<{
    categoryId: number | null;
    targetMatches: number;
    reassignedMatches: number;
    byeMatches: number;
    clearedMatches: number;
    droppedEntries: number;
  }>;
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

function parseRoundNumber(label: string | null) {
  if (!label) return null;
  const match = label.match(/(\d+)/);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

async function recomposeMexicanoForNextRound(
  tx: Prisma.TransactionClient,
  params: {
    eventId: number;
    organizationId: number;
    roundNumber: number;
  },
): Promise<MexicanoRecompositionSummary> {
  const pointsTable = normalizePadelPointsTable({ WIN: 3, DRAW: 1, LOSS: 0, BYE_NEUTRAL: 1 });
  const tieBreakRules = normalizePadelTieBreakRules([
    "POINTS",
    "GAME_DIFFERENCE",
    "GAMES_FOR",
    "HEAD_TO_HEAD",
    "COIN_TOSS",
  ]);
  const matches = await tx.eventMatchSlot.findMany({
    where: { eventId: params.eventId, roundType: "GROUPS" },
    select: {
      id: true,
      categoryId: true,
      roundLabel: true,
      status: true,
      score: true,
      scoreSets: true,
      participants: {
        orderBy: [{ side: "asc" }, { slotOrder: "asc" }, { id: "asc" }],
        select: {
          side: true,
          participantId: true,
          participant: {
            select: {
              playerProfileId: true,
            },
          },
        },
      },
    },
    orderBy: [{ categoryId: "asc" }, { id: "asc" }],
  });

  const resolveSidePlayerIds = (
    match: (typeof matches)[number],
    side: "A" | "B",
  ) =>
    match.participants
      .filter((row) => row.side === side)
      .map((row) => row.participant?.playerProfileId)
      .filter((id): id is number => typeof id === "number" && Number.isFinite(id));

  const matchesByCategory = new Map<number | null, typeof matches>();
  for (const match of matches) {
    const key = match.categoryId ?? null;
    const bucket = matchesByCategory.get(key) ?? [];
    bucket.push(match);
    matchesByCategory.set(key, bucket);
  }

  const tournamentParticipants = await tx.padelTournamentParticipant.findMany({
    where: { eventId: params.eventId },
    select: { id: true, categoryId: true, playerProfileId: true },
  });
  const participantMap = new Map<string, number>();
  for (const participant of tournamentParticipants) {
    const key = `${participant.categoryId ?? "null"}:${participant.playerProfileId}`;
    participantMap.set(key, participant.id);
  }

  const ensureTournamentParticipant = async (categoryId: number | null, playerProfileId: number) => {
    const key = `${categoryId ?? "null"}:${playerProfileId}`;
    const existing = participantMap.get(key);
    if (typeof existing === "number") return existing;
    try {
      const created = await tx.padelTournamentParticipant.create({
        data: {
          eventId: params.eventId,
          categoryId,
          organizationId: params.organizationId,
          playerProfileId,
          status: "ACTIVE",
        },
        select: { id: true },
      });
      participantMap.set(key, created.id);
      return created.id;
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
        throw error;
      }
      const recovered = await tx.padelTournamentParticipant.findFirst({
        where: { eventId: params.eventId, categoryId, playerProfileId },
        select: { id: true },
      });
      if (!recovered?.id) throw error;
      participantMap.set(key, recovered.id);
      return recovered.id;
    }
  };

  const replaceMatchParticipants = async (
    matchId: number,
    sideAParticipantIds: number[],
    sideBParticipantIds: number[],
  ) => {
    await tx.padelMatchParticipant.deleteMany({ where: { matchId } });
    const rows = [
      ...sideAParticipantIds.map((participantId, idx) => ({
        matchId,
        participantId,
        side: "A" as const,
        slotOrder: idx + 1,
      })),
      ...sideBParticipantIds.map((participantId, idx) => ({
        matchId,
        participantId,
        side: "B" as const,
        slotOrder: idx + 1,
      })),
    ];
    if (rows.length === 0) return;
    await tx.padelMatchParticipant.createMany({ data: rows });
  };

  const categories: MexicanoRecompositionSummary["categories"] = [];

  for (const [categoryId, categoryMatches] of matchesByCategory.entries()) {
    const targetMatches = categoryMatches
      .filter((match) => parseRoundNumber(match.roundLabel) === params.roundNumber)
      .filter((match) => match.status !== "DONE" && match.status !== "CANCELLED")
      .sort((a, b) => a.id - b.id);
    if (targetMatches.length === 0) continue;

    const doneBeforeRound = categoryMatches
      .filter((match) => {
        const round = parseRoundNumber(match.roundLabel);
        return round != null && round < params.roundNumber && match.status === "DONE";
      })
      .map((match) => ({
        id: match.id,
        pairingAId: null,
        pairingBId: null,
        sideAEntityIds: resolveSidePlayerIds(match, "A"),
        sideBEntityIds: resolveSidePlayerIds(match, "B"),
        score: match.score,
        scoreSets: match.scoreSets,
        status: match.status,
        groupLabel: "MX",
      }));

    const standingsByGroup = computePadelStandingsByGroupForPlayers(
      doneBeforeRound,
      new Map<number, number[]>(),
      pointsTable,
      tieBreakRules,
      { drawOrderSeed: `mexicano:${params.eventId}:${categoryId ?? "all"}:${params.roundNumber}` },
    );

    const orderedFromStandings = Object.values(standingsByGroup).flat().map((row) => row.entityId);
    const playerPool = new Set<number>();
    targetMatches.forEach((match) => {
      resolveSidePlayerIds(match, "A").forEach((playerId) => playerPool.add(playerId));
      resolveSidePlayerIds(match, "B").forEach((playerId) => playerPool.add(playerId));
    });
    const orderedPlayerIds: number[] = [];
    const orderedSeen = new Set<number>();
    orderedFromStandings.forEach((playerId) => {
      if (!orderedSeen.has(playerId)) {
        orderedPlayerIds.push(playerId);
        orderedSeen.add(playerId);
      }
    });
    Array.from(playerPool)
      .sort((a, b) => a - b)
      .forEach((playerId) => {
        if (!orderedSeen.has(playerId)) {
          orderedPlayerIds.push(playerId);
          orderedSeen.add(playerId);
        }
      });
    if (orderedPlayerIds.length === 0) {
      continue;
    }

    const previousRoundMatches = categoryMatches
      .filter((match) => parseRoundNumber(match.roundLabel) === params.roundNumber - 1 && match.status === "DONE")
      .map((match) => ({
        sideA: resolveSidePlayerIds(match, "A"),
        sideB: resolveSidePlayerIds(match, "B"),
      }))
      .filter((entry) => entry.sideA.length === 2 && entry.sideB.length === 2);
    const previousRoundRelations = buildMexicanoRoundRelations(previousRoundMatches);
    const nextEntries = deriveMexicanoRoundEntries(orderedPlayerIds, { previousRoundRelations });

    let reassignedMatches = 0;
    let byeMatches = 0;
    let clearedMatches = 0;
    let droppedEntries = 0;

    for (let idx = 0; idx < targetMatches.length; idx += 1) {
      const match = targetMatches[idx];
      const entry = nextEntries[idx];
      if (!entry) {
        await tx.eventMatchSlot.update({
          where: { id: match.id },
          data: {
            pairingAId: null,
            pairingBId: null,
            winnerPairingId: null,
            winnerParticipantId: null,
            winnerSide: null,
            status: "PENDING",
            scoreMode: "TIMED_GAMES",
            score: { mode: "TIMED_GAMES" } as Prisma.InputJsonValue,
            scoreSets: Prisma.DbNull,
          },
        });
        await replaceMatchParticipants(match.id, [], []);
        clearedMatches += 1;
        continue;
      }

      if (entry.kind === "BYE") {
        const byeParticipantId = await ensureTournamentParticipant(categoryId, entry.playerId);
        await tx.eventMatchSlot.update({
          where: { id: match.id },
          data: {
            pairingAId: null,
            pairingBId: null,
            winnerPairingId: null,
            winnerParticipantId: null,
            winnerSide: null,
            status: "DONE",
            scoreMode: "TIMED_GAMES",
            score: {
              mode: "TIMED_GAMES",
              resultType: "BYE_NEUTRAL",
              gamesA: 0,
              gamesB: 0,
              endedByBuzzer: false,
              endedAt: new Date().toISOString(),
            } as Prisma.InputJsonValue,
            scoreSets: [] as Prisma.InputJsonValue,
          },
        });
        await replaceMatchParticipants(match.id, [byeParticipantId], []);
        byeMatches += 1;
        continue;
      }

      const sideAParticipantIds = await Promise.all(
        entry.sideA.map((playerProfileId) => ensureTournamentParticipant(categoryId, playerProfileId)),
      );
      const sideBParticipantIds = await Promise.all(
        entry.sideB.map((playerProfileId) => ensureTournamentParticipant(categoryId, playerProfileId)),
      );
      await tx.eventMatchSlot.update({
        where: { id: match.id },
        data: {
          pairingAId: null,
          pairingBId: null,
          winnerPairingId: null,
          winnerParticipantId: null,
          winnerSide: null,
          status: "PENDING",
          scoreMode: "TIMED_GAMES",
          score: { mode: "TIMED_GAMES" } as Prisma.InputJsonValue,
          scoreSets: Prisma.DbNull,
        },
      });
      await replaceMatchParticipants(match.id, sideAParticipantIds, sideBParticipantIds);
      reassignedMatches += 1;
    }

    if (nextEntries.length > targetMatches.length) {
      droppedEntries = nextEntries.length - targetMatches.length;
    }

    categories.push({
      categoryId,
      targetMatches: targetMatches.length,
      reassignedMatches,
      byeMatches,
      clearedMatches,
      droppedEntries,
    });
  }

  return { categories };
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
  const durationRaw = typeof body.durationSeconds === "number" ? body.durationSeconds : Number(body.durationSeconds);
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
  const organizationId = event.organizationId;
  const tournamentConfigId = event.padelTournamentConfig.id;

  const { organization, membership } = await getActiveOrganizationForUser(user.id, {
    organizationId,
    roles: WRITE_ROLES,
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

  const format = event.padelTournamentConfig.format;
  if (format !== "NON_STOP" && format !== "MEXICANO" && format !== "AMERICANO") {
    return jsonWrap({ ok: false, error: "TIMER_NOT_SUPPORTED_FOR_FORMAT" }, { status: 409 });
  }

  const advanced = (event.padelTournamentConfig.advancedSettings ?? {}) as Record<string, unknown>;
  const previous = normalizeTimerState(advanced.nonStopTimerState);
  const durationSeconds =
    Number.isFinite(durationRaw) && durationRaw >= 60 ? Math.floor(durationRaw) : previous.durationSeconds || 20 * 60;
  const nowIso = new Date().toISOString();
  const nextTimerState: TimerState = {
    status: "RUNNING",
    roundNumber: Math.max(1, previous.roundNumber + 1),
    durationSeconds,
    startedAt: nowIso,
    stoppedAt: null,
    updatedAt: nowIso,
  };

  const txResult = await prisma.$transaction(async (tx) => {
    const mexicanoSummary =
      format === "MEXICANO"
        ? await recomposeMexicanoForNextRound(tx, {
            eventId: event.id,
            organizationId,
            roundNumber: nextTimerState.roundNumber,
          })
        : null;

    const updated = await tx.padelTournamentConfig.update({
      where: { id: tournamentConfigId },
      data: {
        advancedSettings: {
          ...advanced,
          nonStopTimerState: nextTimerState,
        },
      },
      select: { id: true, advancedSettings: true },
    });

    return { updated, mexicanoSummary };
  });

  await recordOrganizationAuditSafe({
    organizationId,
    actorUserId: user.id,
    action: "PADEL_LIVE_TIMER_NEXT_ROUND",
    entityType: "event",
    entityId: String(event.id),
    metadata: {
      format,
      previousRound: previous.roundNumber,
      nextRound: nextTimerState.roundNumber,
      durationSeconds: nextTimerState.durationSeconds,
      startedAt: nextTimerState.startedAt,
      mexicanoRecomposition: txResult.mexicanoSummary,
    },
    ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
    userAgent: req.headers.get("user-agent") || null,
  });

  return jsonWrap({
    ok: true,
    timerState: (txResult.updated.advancedSettings as Record<string, unknown>).nonStopTimerState,
    mexicanoRecomposition: txResult.mexicanoSummary,
  });
}

export const POST = withApiEnvelope(_POST);
