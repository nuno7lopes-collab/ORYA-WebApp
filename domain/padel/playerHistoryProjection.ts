import type { Prisma } from "@prisma/client";
import { padel_format } from "@prisma/client";
import {
  computePadelStandingsByGroupForPlayers,
  normalizePadelPointsTable,
  normalizePadelTieBreakRules,
  sortPadelStandingsRows,
} from "@/domain/padel/standings";

type DbClient = Prisma.TransactionClient;

type CategoryProjectionCache = {
  finalPositionByPlayer: Map<number, number>;
  titleWinners: Set<number>;
  standingsRows: Array<Record<string, unknown>>;
};

const KO_FORMATS = new Set<padel_format>([
  padel_format.QUADRO_ELIMINATORIO,
  padel_format.QUADRO_AB,
  padel_format.DUPLA_ELIMINACAO,
  padel_format.GRUPOS_ELIMINATORIAS,
]);

const categoryKeyOf = (categoryId: number | null) => (categoryId === null ? "null" : String(categoryId));

const resolveMatchSidePlayers = (
  participants: Array<{ side: "A" | "B"; participant: { playerProfileId: number } | null }>,
  side: "A" | "B",
) =>
  participants
    .filter((row) => row.side === side)
    .map((row) => row.participant?.playerProfileId)
    .filter((id): id is number => typeof id === "number" && Number.isFinite(id));

const resolveWinnerPlayers = (
  participants: Array<{ side: "A" | "B"; participant: { playerProfileId: number } | null }>,
  winnerSide: "A" | "B" | null,
) => {
  if (!winnerSide) return [] as number[];
  return resolveMatchSidePlayers(participants, winnerSide);
};

const resolveLoserPlayers = (
  participants: Array<{ side: "A" | "B"; participant: { playerProfileId: number } | null }>,
  winnerSide: "A" | "B" | null,
) => {
  if (!winnerSide) return [] as number[];
  const loserSide: "A" | "B" = winnerSide === "A" ? "B" : "A";
  return resolveMatchSidePlayers(participants, loserSide);
};

const resolveFinalPositionForKnockout = (
  doneMatches: Array<{
    id: number;
    roundType: string | null;
    winnerSide: "A" | "B" | null;
    participants: Array<{ side: "A" | "B"; participant: { playerProfileId: number } | null }>;
  }>,
): CategoryProjectionCache => {
  const finalPositionByPlayer = new Map<number, number>();
  const titleWinners = new Set<number>();

  const knockoutMatches = doneMatches.filter((match) => match.roundType === "KNOCKOUT");
  const finalMatch = [...knockoutMatches]
    .reverse()
    .find((match) => match.winnerSide && resolveMatchSidePlayers(match.participants, "A").length > 0 && resolveMatchSidePlayers(match.participants, "B").length > 0);

  if (finalMatch && finalMatch.winnerSide) {
    const winners = resolveWinnerPlayers(finalMatch.participants, finalMatch.winnerSide);
    const losers = resolveLoserPlayers(finalMatch.participants, finalMatch.winnerSide);
    winners.forEach((playerId) => {
      finalPositionByPlayer.set(playerId, 1);
      titleWinners.add(playerId);
    });
    losers.forEach((playerId) => finalPositionByPlayer.set(playerId, 2));
  }

  const involvedPlayers = new Set<number>();
  knockoutMatches.forEach((match) => {
    resolveMatchSidePlayers(match.participants, "A").forEach((playerId) => involvedPlayers.add(playerId));
    resolveMatchSidePlayers(match.participants, "B").forEach((playerId) => involvedPlayers.add(playerId));
  });

  involvedPlayers.forEach((playerId) => {
    if (!finalPositionByPlayer.has(playerId)) {
      finalPositionByPlayer.set(playerId, 3);
    }
  });

  return {
    finalPositionByPlayer,
    titleWinners,
    standingsRows: [],
  };
};

const resolveFinalPositionFromStandings = (params: {
  eventId: number;
  categoryId: number | null;
  doneMatches: Array<{
    id: number;
    groupLabel: string | null;
    status: string;
    scoreSets: unknown;
    score: unknown;
    participants: Array<{ side: "A" | "B"; participant: { playerProfileId: number } | null }>;
  }>;
  tieBreakRules: ReturnType<typeof normalizePadelTieBreakRules>;
  pointsTable: ReturnType<typeof normalizePadelPointsTable>;
}) => {
  const matchInputs = params.doneMatches.map((match) => ({
    id: match.id,
    pairingAId: null,
    pairingBId: null,
    sideAEntityIds: resolveMatchSidePlayers(match.participants, "A"),
    sideBEntityIds: resolveMatchSidePlayers(match.participants, "B"),
    scoreSets: match.scoreSets,
    score: match.score,
    status: match.status,
    groupLabel: match.groupLabel,
  }));

  const standings = computePadelStandingsByGroupForPlayers(
    matchInputs,
    new Map<number, number[]>(),
    params.pointsTable,
    params.tieBreakRules,
    { drawOrderSeed: `history:${params.eventId}:${params.categoryId ?? "null"}` },
  );

  const flattened = Object.entries(standings).flatMap(([groupLabel, rows]) =>
    rows.map((row) => ({
      ...row,
      groupLabel,
    })),
  );
  const sorted = sortPadelStandingsRows(flattened, params.tieBreakRules, {
    drawOrderSeed: `history:${params.eventId}:${params.categoryId ?? "null"}`,
  });

  const finalPositionByPlayer = new Map<number, number>();
  const titleWinners = new Set<number>();
  sorted.forEach((row, index) => {
    finalPositionByPlayer.set(row.entityId, index + 1);
    if (index === 0) titleWinners.add(row.entityId);
  });

  return {
    finalPositionByPlayer,
    titleWinners,
    standingsRows: sorted.map((row) => ({
      entityId: row.entityId,
      points: row.points,
      wins: row.wins,
      losses: row.losses,
      draws: row.draws,
      setDiff: row.setDiff,
      gameDiff: row.gameDiff,
    })),
  } satisfies CategoryProjectionCache;
};

export async function rebuildPadelPlayerHistoryProjectionForEvent(params: {
  tx: DbClient;
  organizationId: number;
  eventId: number;
}) {
  const { tx, organizationId, eventId } = params;

  const event = await tx.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      title: true,
      slug: true,
      startsAt: true,
      endsAt: true,
      templateType: true,
      organizationId: true,
      padelTournamentConfig: {
        select: {
          format: true,
          ruleSet: { select: { pointsTable: true, tieBreakRules: true } },
          ruleSetVersion: { select: { pointsTable: true, tieBreakRules: true } },
        },
      },
    },
  });

  if (!event || event.templateType !== "PADEL" || event.organizationId !== organizationId) {
    return { ok: false as const, error: "EVENT_NOT_FOUND" };
  }

  const participants = await tx.padelTournamentParticipant.findMany({
    where: {
      eventId,
      organizationId,
      status: { in: ["ACTIVE", "INACTIVE", "WITHDRAWN"] },
    },
    select: {
      id: true,
      categoryId: true,
      playerProfileId: true,
      playerProfile: { select: { fullName: true, displayName: true } },
      category: { select: { label: true } },
    },
  });

  const matches = await tx.eventMatchSlot.findMany({
    where: { eventId },
    select: {
      id: true,
      categoryId: true,
      status: true,
      roundType: true,
      roundLabel: true,
      groupLabel: true,
      scoreSets: true,
      score: true,
      winnerSide: true,
      winnerParticipantId: true,
      participants: {
        orderBy: [{ side: "asc" }, { slotOrder: "asc" }, { id: "asc" }],
        select: {
          side: true,
          participant: {
            select: {
              id: true,
              playerProfileId: true,
            },
          },
        },
      },
    },
    orderBy: [{ id: "asc" }],
  });

  const doneMatches = matches.filter((match) => match.status === "DONE");
  const tieBreakRules = normalizePadelTieBreakRules(
    event.padelTournamentConfig?.ruleSetVersion?.tieBreakRules ?? event.padelTournamentConfig?.ruleSet?.tieBreakRules,
  );
  const pointsTable = normalizePadelPointsTable(
    event.padelTournamentConfig?.ruleSetVersion?.pointsTable ?? event.padelTournamentConfig?.ruleSet?.pointsTable,
  );

  const partnerCounts = new Map<number, Map<number, number>>();
  for (const match of doneMatches) {
    const participantRows = (match.participants ?? []).map((row) => ({
      side: row.side,
      participant: row.participant ? { playerProfileId: row.participant.playerProfileId } : null,
    }));
    const sideA = resolveMatchSidePlayers(participantRows, "A");
    const sideB = resolveMatchSidePlayers(participantRows, "B");
    for (const sidePlayers of [sideA, sideB]) {
      for (const playerId of sidePlayers) {
        if (!partnerCounts.has(playerId)) partnerCounts.set(playerId, new Map());
        for (const partnerId of sidePlayers) {
          if (partnerId === playerId) continue;
          const current = partnerCounts.get(playerId)!.get(partnerId) ?? 0;
          partnerCounts.get(playerId)!.set(partnerId, current + 1);
        }
      }
    }
  }

  const categoryCache = new Map<string, CategoryProjectionCache>();

  for (const [key, bucket] of Object.entries(
    participants.reduce<Record<string, typeof participants>>((acc, participant) => {
      const categoryKey = categoryKeyOf(participant.categoryId ?? null);
      if (!acc[categoryKey]) acc[categoryKey] = [];
      acc[categoryKey].push(participant);
      return acc;
    }, {}),
  )) {
    const categoryId = key === "null" ? null : Number(key);
    const categoryDoneMatches = doneMatches
      .filter((match) => {
        if (categoryId === null) return match.categoryId === null;
        return match.categoryId === categoryId;
      })
      .map((match) => ({
        id: match.id,
        groupLabel: match.groupLabel,
        status: match.status,
        scoreSets: match.scoreSets,
        score: match.score,
        roundType: match.roundType,
        winnerSide: match.winnerSide,
        participants: (match.participants ?? []).map((row) => ({
          side: row.side,
          participant: row.participant ? { playerProfileId: row.participant.playerProfileId } : null,
        })),
      }));

    if (categoryDoneMatches.length === 0) {
      categoryCache.set(key, {
        finalPositionByPlayer: new Map(),
        titleWinners: new Set(),
        standingsRows: [],
      });
      continue;
    }

    const hasKnockoutMatches = categoryDoneMatches.some((match) => match.roundType === "KNOCKOUT");
    const format = event.padelTournamentConfig?.format ?? null;
    const shouldUseKnockout = hasKnockoutMatches && format && KO_FORMATS.has(format);

    if (shouldUseKnockout) {
      categoryCache.set(
        key,
        resolveFinalPositionForKnockout(
          categoryDoneMatches.map((match) => ({
            id: match.id,
            roundType: match.roundType,
            winnerSide: match.winnerSide,
            participants: match.participants,
          })),
        ),
      );
      continue;
    }

    categoryCache.set(
      key,
      resolveFinalPositionFromStandings({
        eventId,
        categoryId,
        doneMatches: categoryDoneMatches,
        tieBreakRules,
        pointsTable,
      }),
    );
  }

  const now = new Date();
  const rows = participants.map((participant) => {
    const key = categoryKeyOf(participant.categoryId ?? null);
    const cache = categoryCache.get(key) ?? {
      finalPositionByPlayer: new Map<number, number>(),
      titleWinners: new Set<number>(),
      standingsRows: [],
    };
    const partnerEntries = Array.from(partnerCounts.get(participant.playerProfileId)?.entries() ?? []);
    partnerEntries.sort((a, b) => b[1] - a[1] || a[0] - b[0]);
    const partnerPlayerProfileId = partnerEntries.length > 0 ? partnerEntries[0][0] : null;
    const playerMatches = doneMatches
      .filter((match) => {
        if (participant.categoryId === null && match.categoryId !== null) return false;
        if (participant.categoryId !== null && match.categoryId !== participant.categoryId) return false;
        const sideA = resolveMatchSidePlayers(
          (match.participants ?? []).map((row) => ({
            side: row.side,
            participant: row.participant ? { playerProfileId: row.participant.playerProfileId } : null,
          })),
          "A",
        );
        const sideB = resolveMatchSidePlayers(
          (match.participants ?? []).map((row) => ({
            side: row.side,
            participant: row.participant ? { playerProfileId: row.participant.playerProfileId } : null,
          })),
          "B",
        );
        return sideA.includes(participant.playerProfileId) || sideB.includes(participant.playerProfileId);
      })
      .map((match) => ({
        matchId: match.id,
        roundLabel: match.roundLabel,
        roundType: match.roundType,
        groupLabel: match.groupLabel,
        winnerSide: match.winnerSide,
        winnerParticipantId: match.winnerParticipantId,
      }));

    const finalPosition = cache.finalPositionByPlayer.get(participant.playerProfileId) ?? null;
    const wonTitle = cache.titleWinners.has(participant.playerProfileId);

    return {
      organizationId,
      eventId,
      categoryId: participant.categoryId,
      playerProfileId: participant.playerProfileId,
      partnerPlayerProfileId,
      finalPosition,
      wonTitle,
      bracketSnapshot: {
        computedAt: now.toISOString(),
        event: {
          id: event.id,
          title: event.title,
          slug: event.slug,
          startsAt: event.startsAt ? event.startsAt.toISOString() : null,
          endsAt: event.endsAt ? event.endsAt.toISOString() : null,
        },
        category: {
          id: participant.categoryId,
          label: participant.category?.label ?? null,
        },
        format: event.padelTournamentConfig?.format ?? null,
        standings: cache.standingsRows,
        playerMatches,
      } as Prisma.InputJsonValue,
      computedAt: now,
    };
  });

  await tx.padelPlayerHistoryProjection.deleteMany({ where: { eventId } });
  if (rows.length > 0) {
    await tx.padelPlayerHistoryProjection.createMany({ data: rows });
  }

  return { ok: true as const, rows: rows.length };
}
