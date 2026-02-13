import { prisma } from "@/lib/prisma";
import { resolvePadelCompetitionState } from "@/domain/padelCompetitionState";
import {
  computePadelStandingsByGroup,
  computePadelStandingsByGroupForPlayers,
  normalizePadelPointsTable,
  normalizePadelTieBreakRules,
  type PadelStandingEntityType,
  type PadelStandingRow,
} from "@/domain/padel/standings";
import { isPublicAccessMode, resolveEventAccessMode } from "@/lib/events/accessPolicy";
import { resolvePadelRuleSetSnapshotForEvent } from "@/domain/padel/ruleSetSnapshot";

type TimerStatePayload = {
  status: "IDLE" | "RUNNING" | "STOPPED";
  roundNumber: number;
  durationSeconds: number;
  startedAt: string | null;
  remainingMs: number;
};

type PadelStandingMatchInput = {
  id: number;
  pairingAId: number | null;
  pairingBId: number | null;
  sideAEntityIds?: number[];
  sideBEntityIds?: number[];
  scoreSets: unknown;
  score: unknown;
  groupLabel: string | null;
  status: string;
};

type LiveMatchParticipant = {
  side: "A" | "B";
  slotOrder: number;
  participant: {
    id: number;
    playerProfileId: number;
    sourcePairingId: number | null;
    playerProfile: {
      id: number;
      fullName: string | null;
      displayName: string | null;
    } | null;
  } | null;
};

const resolveSideParticipants = (participants: LiveMatchParticipant[] | null | undefined, side: "A" | "B") =>
  (participants ?? [])
    .filter((row) => row.side === side)
    .sort((a, b) => (a.slotOrder ?? 0) - (b.slotOrder ?? 0));

const resolveSideSourcePairingId = (participants: LiveMatchParticipant[] | null | undefined, side: "A" | "B") =>
  resolveSideParticipants(participants, side)
    .map((row) => row.participant?.sourcePairingId)
    .find((id): id is number => typeof id === "number" && Number.isFinite(id)) ?? null;

const resolveSideEntityIds = (participants: LiveMatchParticipant[] | null | undefined, side: "A" | "B") =>
  resolveSideParticipants(participants, side)
    .map((row) => row.participant?.playerProfileId)
    .filter((id): id is number => typeof id === "number" && Number.isFinite(id));

const buildLegacyPairingSide = (participants: LiveMatchParticipant[] | null | undefined, side: "A" | "B") => {
  const sideRows = resolveSideParticipants(participants, side);
  if (sideRows.length === 0) return null;
  const id = resolveSideSourcePairingId(participants, side);
  return {
    id: id ?? 0,
    slots: sideRows.map((row) => ({
      playerProfile: {
        id: row.participant?.playerProfile?.id ?? row.participant?.playerProfileId ?? null,
        displayName: row.participant?.playerProfile?.displayName ?? null,
        fullName: row.participant?.playerProfile?.fullName ?? null,
      },
    })),
  };
};

function tieBreakRulesForFormat(format: string | null) {
  if (format === "NON_STOP") {
    return normalizePadelTieBreakRules(["POINTS", "HEAD_TO_HEAD", "GAME_DIFFERENCE", "GAMES_FOR", "COIN_TOSS"]);
  }
  if (format === "AMERICANO" || format === "MEXICANO") {
    return normalizePadelTieBreakRules(["POINTS", "GAME_DIFFERENCE", "GAMES_FOR", "HEAD_TO_HEAD", "COIN_TOSS"]);
  }
  return null;
}

function normalizeTimerState(advancedSettings: unknown): TimerStatePayload {
  const raw =
    advancedSettings &&
    typeof advancedSettings === "object" &&
    !Array.isArray(advancedSettings) &&
    typeof (advancedSettings as Record<string, unknown>).nonStopTimerState === "object"
      ? ((advancedSettings as Record<string, unknown>).nonStopTimerState as Record<string, unknown>)
      : null;

  const statusRaw = typeof raw?.status === "string" ? raw.status.trim().toUpperCase() : "IDLE";
  const status = statusRaw === "RUNNING" || statusRaw === "STOPPED" ? statusRaw : "IDLE";
  const roundNumberRaw = typeof raw?.roundNumber === "number" ? raw.roundNumber : Number(raw?.roundNumber);
  const durationRaw = typeof raw?.durationSeconds === "number" ? raw.durationSeconds : Number(raw?.durationSeconds);
  const roundNumber = Number.isFinite(roundNumberRaw) && roundNumberRaw > 0 ? Math.floor(roundNumberRaw) : 1;
  const durationSeconds = Number.isFinite(durationRaw) && durationRaw > 0 ? Math.floor(durationRaw) : 20 * 60;
  const startedAt = typeof raw?.startedAt === "string" ? raw.startedAt : null;

  let remainingMs = 0;
  if (status === "RUNNING" && startedAt) {
    const started = new Date(startedAt);
    if (!Number.isNaN(started.getTime())) {
      remainingMs = Math.max(0, durationSeconds * 1000 - (Date.now() - started.getTime()));
    }
  }

  return {
    status,
    roundNumber,
    durationSeconds,
    startedAt,
    remainingMs,
  };
}

async function buildLiveStandings(params: {
  eventId: number;
  categoryId: number | null;
  format: string | null;
  matches: PadelStandingMatchInput[];
}) {
  const { eventId, categoryId, format, matches } = params;
  const entityType: PadelStandingEntityType = format === "AMERICANO" || format === "MEXICANO" ? "PLAYER" : "PAIRING";
  const ruleSnapshot = await resolvePadelRuleSetSnapshotForEvent({ eventId });
  const pointsTable = normalizePadelPointsTable(ruleSnapshot.pointsTable);
  const tieBreakRules = tieBreakRulesForFormat(format) ?? normalizePadelTieBreakRules(ruleSnapshot.tieBreakRules);
  const drawOrderSeed = `${eventId}:${Number.isFinite(categoryId) ? categoryId : "all"}:${format ?? "UNKNOWN"}`;

  const standingMatches = matches.map((match) => ({
    id: match.id,
    pairingAId: match.pairingAId,
    pairingBId: match.pairingBId,
    sideAEntityIds: Array.isArray(match.sideAEntityIds) ? match.sideAEntityIds : undefined,
    sideBEntityIds: Array.isArray(match.sideBEntityIds) ? match.sideBEntityIds : undefined,
    scoreSets: match.scoreSets,
    score: match.score,
    groupLabel: match.groupLabel,
    status: match.status,
  }));

  let standingsByGroup: Record<string, PadelStandingRow[]>;
  if (entityType === "PLAYER") {
    // Player standings no longer depend on legacy pairing joins; entity IDs come from match participants.
    const pairingPlayers = new Map<number, number[]>();
    standingsByGroup = computePadelStandingsByGroupForPlayers(
      standingMatches,
      pairingPlayers,
      pointsTable,
      tieBreakRules,
      {
        drawOrderSeed,
      },
    );
  } else {
    standingsByGroup = computePadelStandingsByGroup(standingMatches, pointsTable, tieBreakRules, {
      drawOrderSeed,
    });
  }

  const rows = Object.entries(standingsByGroup).flatMap(([groupLabel, groupRows]) =>
    groupRows.map((row, idx) => ({
      groupLabel,
      rank: idx + 1,
      entityId: row.entityId,
      pairingId: entityType === "PAIRING" ? row.entityId : null,
      playerId: entityType === "PLAYER" ? row.entityId : null,
      points: row.points,
      wins: row.wins,
      draws: row.draws,
      losses: row.losses,
      setDiff: row.setDiff,
      gameDiff: row.gameDiff,
      setsFor: row.setsFor,
      setsAgainst: row.setsAgainst,
      gamesFor: row.gamesFor,
      gamesAgainst: row.gamesAgainst,
    })),
  );

  return {
    entityType,
    rows,
    groups: standingsByGroup,
  };
}

export type PadelLivePayload = {
  matches: unknown;
  standings: unknown;
  timerState: TimerStatePayload;
  serverNow: string;
};

export type PadelLivePayloadError = "EVENT_NOT_FOUND" | "FORBIDDEN";

export async function buildPadelLivePayload(eventId: number, categoryId?: number | null): Promise<PadelLivePayload | { error: PadelLivePayloadError }> {
  const matchCategoryFilter = Number.isFinite(categoryId) ? { categoryId } : {};

  const [event, matches] = await Promise.all([
    prisma.event.findUnique({
      where: { id: eventId, isDeleted: false },
      select: {
        id: true,
        status: true,
        padelTournamentConfig: {
          select: {
            format: true,
            advancedSettings: true,
            lifecycleStatus: true,
          },
        },
        accessPolicies: {
          orderBy: { policyVersion: "desc" },
          take: 1,
          select: { mode: true },
        },
      },
    }),
    prisma.eventMatchSlot.findMany({
      where: { eventId, ...matchCategoryFilter },
      include: {
        participants: {
          orderBy: [{ side: "asc" }, { slotOrder: "asc" }, { id: "asc" }],
          include: {
            participant: {
              select: {
                id: true,
                playerProfileId: true,
                sourcePairingId: true,
                playerProfile: { select: { id: true, fullName: true, displayName: true } },
              },
            },
          },
        },
      },
      orderBy: [
        { roundType: "asc" },
        { groupLabel: "asc" },
        { startTime: "asc" },
        { id: "asc" },
      ],
    }),
  ]);

  if (!event) return { error: "EVENT_NOT_FOUND" };

  const accessMode = resolveEventAccessMode(event.accessPolicies?.[0]);
  const competitionState = resolvePadelCompetitionState({
    eventStatus: event.status,
    competitionState: (event.padelTournamentConfig?.advancedSettings as any)?.competitionState ?? null,
    lifecycleStatus: event.padelTournamentConfig?.lifecycleStatus ?? null,
  });
  const isPublicEvent =
    isPublicAccessMode(accessMode) &&
    ["PUBLISHED", "DATE_CHANGED", "FINISHED", "CANCELLED"].includes(event.status) &&
    competitionState === "PUBLIC";
  if (!isPublicEvent) return { error: "FORBIDDEN" };

  const groupMatches = await prisma.eventMatchSlot.findMany({
    where: { eventId, roundType: "GROUPS", ...matchCategoryFilter },
    select: {
      id: true,
      scoreSets: true,
      score: true,
      groupLabel: true,
      status: true,
      participants: {
        orderBy: [{ side: "asc" }, { slotOrder: "asc" }, { id: "asc" }],
        select: {
          side: true,
          slotOrder: true,
          participant: { select: { playerProfileId: true, sourcePairingId: true } },
        },
      },
    },
  });
  const standingMatches: PadelStandingMatchInput[] = groupMatches.map((match) => {
    const sideAEntityIds = resolveSideEntityIds(match.participants as LiveMatchParticipant[], "A");
    const sideBEntityIds = resolveSideEntityIds(match.participants as LiveMatchParticipant[], "B");
    return {
      id: match.id,
      pairingAId: resolveSideSourcePairingId(match.participants as LiveMatchParticipant[], "A"),
      pairingBId: resolveSideSourcePairingId(match.participants as LiveMatchParticipant[], "B"),
      sideAEntityIds: sideAEntityIds.length > 0 ? sideAEntityIds : undefined,
      sideBEntityIds: sideBEntityIds.length > 0 ? sideBEntityIds : undefined,
      scoreSets: match.scoreSets,
      score: match.score,
      groupLabel: match.groupLabel,
      status: match.status,
    };
  });
  const standings = await buildLiveStandings({
    eventId,
    categoryId: Number.isFinite(categoryId) ? (categoryId as number) : null,
    format: event.padelTournamentConfig?.format ?? null,
    matches: standingMatches,
  });
  const timerState = normalizeTimerState(event.padelTournamentConfig?.advancedSettings ?? null);
  const normalizedMatches = matches.map((match) => ({
    ...match,
    pairingA: buildLegacyPairingSide(match.participants as LiveMatchParticipant[], "A"),
    pairingB: buildLegacyPairingSide(match.participants as LiveMatchParticipant[], "B"),
  }));

  return {
    matches: normalizedMatches,
    standings,
    timerState,
    serverNow: new Date().toISOString(),
  };
}
