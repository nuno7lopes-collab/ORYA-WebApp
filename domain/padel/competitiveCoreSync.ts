import {
  PadelMatchSide,
  PadelRoundPhase,
  PadelRoundState,
  PadelRoundTimerState,
  PadelScoreMode,
  PadelTournamentParticipantStatus,
  Prisma,
  padel_format,
  padel_match_status,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";

type SyncParams = {
  eventId: number;
  categoryId?: number | null;
};

type SyncResult = {
  ok: boolean;
  participants: number;
  rounds: number;
  matchParticipants: number;
  matchesUpdated: number;
};

function categoryKey(value: number | null | undefined) {
  return value == null ? "null" : String(value);
}

function toRoundNumber(roundLabel: string | null) {
  if (!roundLabel) return 1;
  const match = roundLabel.match(/(\d+)/);
  if (!match) return 1;
  const value = Number(match[1]);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 1;
}

function parseScoreMode(score: Prisma.JsonValue | null | undefined) {
  if (!score || typeof score !== "object" || Array.isArray(score)) return PadelScoreMode.SETS;
  const mode = (score as Record<string, unknown>).mode;
  if (typeof mode === "string" && mode.toUpperCase() === "TIMED_GAMES") return PadelScoreMode.TIMED_GAMES;
  return PadelScoreMode.SETS;
}

function resolvePhase(format: padel_format | null, roundType: string | null): PadelRoundPhase {
  if (roundType === "KNOCKOUT") return PadelRoundPhase.PLAYOFF;
  if (format === "NON_STOP") return PadelRoundPhase.NON_STOP;
  if (format === "AMERICANO" || format === "MEXICANO") return PadelRoundPhase.ROUND_ROBIN;
  return PadelRoundPhase.GROUPS;
}

function resolveRoundState(statuses: padel_match_status[]): PadelRoundState {
  if (statuses.some((status) => status === "IN_PROGRESS")) return PadelRoundState.LIVE;
  if (statuses.length > 0 && statuses.every((status) => status === "DONE" || status === "CANCELLED")) {
    return PadelRoundState.CLOSED;
  }
  return PadelRoundState.PENDING;
}

function resolveTimerState(phase: PadelRoundPhase, state: PadelRoundState) {
  if (phase !== PadelRoundPhase.NON_STOP) return PadelRoundTimerState.IDLE;
  return state === PadelRoundState.LIVE ? PadelRoundTimerState.RUNNING : PadelRoundTimerState.STOPPED;
}

function buildRoundKey(params: {
  eventId: number;
  categoryId: number | null;
  roundType: string | null;
  groupLabel: string | null;
  roundLabel: string | null;
}) {
  const { eventId, categoryId, roundType, groupLabel, roundLabel } = params;
  return `${eventId}:${categoryKey(categoryId)}:${roundType ?? "GROUPS"}:${groupLabel ?? "-"}:${roundLabel ?? "-"}`;
}

export async function syncPadelCompetitiveCore(params: SyncParams): Promise<SyncResult> {
  const event = await prisma.event.findUnique({
    where: { id: params.eventId, isDeleted: false },
    select: {
      id: true,
      organizationId: true,
      padelTournamentConfig: { select: { format: true } },
    },
  });
  if (!event?.organizationId) {
    return { ok: false, participants: 0, rounds: 0, matchParticipants: 0, matchesUpdated: 0 };
  }
  const organizationId = event.organizationId;

  const categoryFilter = Number.isFinite(params.categoryId as number) ? { categoryId: params.categoryId as number } : {};
  const matches = await prisma.eventMatchSlot.findMany({
    where: { eventId: event.id, ...categoryFilter },
    select: {
      id: true,
      categoryId: true,
      roundType: true,
      groupLabel: true,
      roundLabel: true,
      status: true,
      score: true,
      pairingAId: true,
      pairingBId: true,
      winnerPairingId: true,
    },
  });
  const matchIds = matches.map((match) => match.id);

  const pairingIds = Array.from(
    new Set(
      matches
        .flatMap((match) => [match.pairingAId, match.pairingBId, match.winnerPairingId])
        .filter((id): id is number => typeof id === "number" && Number.isFinite(id)),
    ),
  );
  const pairings = pairingIds.length
    ? await prisma.padelPairing.findMany({
        where: { id: { in: pairingIds } },
        select: {
          id: true,
          categoryId: true,
          slots: {
            select: { playerProfileId: true },
            orderBy: { id: "asc" },
          },
        },
      })
    : [];

  const pairingMap = new Map<number, { categoryId: number | null; playerProfileIds: number[] }>();
  const participantSeeds: Array<{
    eventId: number;
    categoryId: number | null;
    organizationId: number;
    playerProfileId: number;
    sourcePairingId: number | null;
    status: PadelTournamentParticipantStatus;
  }> = [];
  for (const pairing of pairings) {
    const playerProfileIds = pairing.slots
      .map((slot) => slot.playerProfileId)
      .filter((id): id is number => typeof id === "number" && Number.isFinite(id));
    pairingMap.set(pairing.id, {
      categoryId: pairing.categoryId ?? null,
      playerProfileIds,
    });
    for (const playerProfileId of playerProfileIds) {
      participantSeeds.push({
        eventId: event.id,
        categoryId: pairing.categoryId ?? null,
        organizationId,
        playerProfileId,
        sourcePairingId: pairing.id,
        status: PadelTournamentParticipantStatus.ACTIVE,
      });
    }
  }

  const uniqueParticipantSeeds = Array.from(
    new Map(
      participantSeeds.map((seed) => [
        `${seed.eventId}:${categoryKey(seed.categoryId)}:${seed.playerProfileId}`,
        seed,
      ]),
    ).values(),
  );

  const roundRowsByKey = new Map<
    string,
    {
      key: string;
      categoryId: number | null;
      phase: PadelRoundPhase;
      roundNumber: number;
      groupLabel: string | null;
      scoreMode: PadelScoreMode;
      statuses: padel_match_status[];
    }
  >();

  for (const match of matches) {
    const key = buildRoundKey({
      eventId: event.id,
      categoryId: match.categoryId ?? null,
      roundType: match.roundType,
      groupLabel: match.groupLabel,
      roundLabel: match.roundLabel,
    });
    const existing = roundRowsByKey.get(key);
    if (existing) {
      existing.statuses.push(match.status);
      if (existing.scoreMode !== PadelScoreMode.TIMED_GAMES) {
        existing.scoreMode = parseScoreMode(match.score as Prisma.JsonValue);
      }
      continue;
    }
    roundRowsByKey.set(key, {
      key,
      categoryId: match.categoryId ?? null,
      phase: resolvePhase(event.padelTournamentConfig?.format ?? null, match.roundType),
      roundNumber: toRoundNumber(match.roundLabel),
      groupLabel: match.groupLabel ?? null,
      scoreMode: parseScoreMode(match.score as Prisma.JsonValue),
      statuses: [match.status],
    });
  }

  return prisma.$transaction(async (tx) => {
    if (uniqueParticipantSeeds.length > 0) {
      await tx.padelTournamentParticipant.createMany({
        data: uniqueParticipantSeeds,
        skipDuplicates: true,
      });
    }

    const participants = await tx.padelTournamentParticipant.findMany({
      where: {
        eventId: event.id,
        ...(Number.isFinite(params.categoryId as number) ? { categoryId: params.categoryId as number } : {}),
      },
      select: { id: true, categoryId: true, playerProfileId: true },
    });
    const participantByKey = new Map<string, number>();
    for (const participant of participants) {
      participantByKey.set(
        `${categoryKey(participant.categoryId)}:${participant.playerProfileId}`,
        participant.id,
      );
    }
    const getParticipantId = (categoryId: number | null, playerProfileId: number) => {
      const direct = participantByKey.get(`${categoryKey(categoryId)}:${playerProfileId}`);
      if (direct) return direct;
      return participantByKey.get(`${categoryKey(null)}:${playerProfileId}`) ?? null;
    };

    for (const round of roundRowsByKey.values()) {
      const state = resolveRoundState(round.statuses);
      await tx.padelRound.upsert({
        where: { roundKey: round.key },
        update: {
          phase: round.phase,
          roundNumber: round.roundNumber,
          groupLabel: round.groupLabel,
          state,
          scoreMode: round.scoreMode,
          timerState: resolveTimerState(round.phase, state),
        },
        create: {
          eventId: event.id,
          categoryId: round.categoryId,
          organizationId,
          roundKey: round.key,
          phase: round.phase,
          roundNumber: round.roundNumber,
          groupLabel: round.groupLabel,
          state,
          scoreMode: round.scoreMode,
          timerState: resolveTimerState(round.phase, state),
        },
      });
    }

    const rounds = await tx.padelRound.findMany({
      where: { eventId: event.id, ...(Number.isFinite(params.categoryId as number) ? { categoryId: params.categoryId as number } : {}) },
      select: { id: true, roundKey: true },
    });
    const roundIdByKey = new Map(rounds.map((round) => [round.roundKey, round.id]));

    if (matchIds.length > 0) {
      await tx.padelMatchParticipant.deleteMany({
        where: { matchId: { in: matchIds } },
      });
    }

    const matchParticipantRows: Array<{
      matchId: number;
      participantId: number;
      side: PadelMatchSide;
      slotOrder: number;
    }> = [];
    let matchesUpdated = 0;
    for (const match of matches) {
      const roundKey = buildRoundKey({
        eventId: event.id,
        categoryId: match.categoryId ?? null,
        roundType: match.roundType,
        groupLabel: match.groupLabel,
        roundLabel: match.roundLabel,
      });
      const roundId = roundIdByKey.get(roundKey) ?? null;
      const sideAPlayers = (typeof match.pairingAId === "number" ? pairingMap.get(match.pairingAId)?.playerProfileIds : []) ?? [];
      const sideBPlayers = (typeof match.pairingBId === "number" ? pairingMap.get(match.pairingBId)?.playerProfileIds : []) ?? [];

      const sideAParticipants = sideAPlayers
        .map((playerProfileId) =>
          getParticipantId(
            match.categoryId ?? (typeof match.pairingAId === "number" ? pairingMap.get(match.pairingAId)?.categoryId ?? null : null),
            playerProfileId,
          ),
        )
        .filter((id): id is number => typeof id === "number" && Number.isFinite(id));
      const sideBParticipants = sideBPlayers
        .map((playerProfileId) =>
          getParticipantId(
            match.categoryId ?? (typeof match.pairingBId === "number" ? pairingMap.get(match.pairingBId)?.categoryId ?? null : null),
            playerProfileId,
          ),
        )
        .filter((id): id is number => typeof id === "number" && Number.isFinite(id));

      sideAParticipants.forEach((participantId, idx) => {
        matchParticipantRows.push({
          matchId: match.id,
          participantId,
          side: PadelMatchSide.A,
          slotOrder: idx,
        });
      });
      sideBParticipants.forEach((participantId, idx) => {
        matchParticipantRows.push({
          matchId: match.id,
          participantId,
          side: PadelMatchSide.B,
          slotOrder: idx,
        });
      });

      let winnerParticipantId: number | null = null;
      if (typeof match.winnerPairingId === "number") {
        if (match.winnerPairingId === match.pairingAId) winnerParticipantId = sideAParticipants[0] ?? null;
        if (match.winnerPairingId === match.pairingBId) winnerParticipantId = sideBParticipants[0] ?? null;
      }

      await tx.eventMatchSlot.update({
        where: { id: match.id },
        data: {
          roundId,
          winnerParticipantId,
          scoreMode: parseScoreMode(match.score as Prisma.JsonValue),
        },
      });
      matchesUpdated += 1;
    }

    if (matchParticipantRows.length > 0) {
      await tx.padelMatchParticipant.createMany({
        data: matchParticipantRows,
        skipDuplicates: true,
      });
    }

    return {
      ok: true,
      participants: uniqueParticipantSeeds.length,
      rounds: roundRowsByKey.size,
      matchParticipants: matchParticipantRows.length,
      matchesUpdated,
    };
  });
}
