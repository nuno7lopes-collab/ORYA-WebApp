import crypto from "crypto";
import { isValidPointsTable, isValidTieBreakRules, type PadelPointsTable, type PadelTieBreakRule } from "@/lib/padel/validation";
import { resolvePadelMatchStats } from "@/domain/padel/score";

export type PadelStandingEntityType = "PAIRING" | "PLAYER";

export type PadelStandingRow = {
  entityId: number;
  pairingId: number;
  playerId: number | null;
  points: number;
  wins: number;
  draws: number;
  losses: number;
  setDiff: number;
  gameDiff: number;
  setsFor: number;
  setsAgainst: number;
  gamesFor: number;
  gamesAgainst: number;
};

export const DEFAULT_PADEL_POINTS_TABLE: PadelPointsTable = {
  WIN: 3,
  DRAW: 1,
  LOSS: 0,
  BYE_NEUTRAL: 1,
};
export const DEFAULT_PADEL_TIE_BREAK_RULES: PadelTieBreakRule[] = [
  "POINTS",
  "HEAD_TO_HEAD",
  "SET_DIFFERENCE",
  "GAME_DIFFERENCE",
  "GAMES_FOR",
  "COIN_TOSS",
];

export function normalizePadelPointsTable(raw?: unknown): PadelPointsTable {
  return isValidPointsTable(raw) ? (raw as PadelPointsTable) : DEFAULT_PADEL_POINTS_TABLE;
}

export function normalizePadelTieBreakRules(raw?: unknown): PadelTieBreakRule[] {
  const base = isValidTieBreakRules(raw) ? (raw as PadelTieBreakRule[]) : DEFAULT_PADEL_TIE_BREAK_RULES;
  const seen = new Set<PadelTieBreakRule>();
  const deduped = base.filter((rule) => {
    if (seen.has(rule)) return false;
    seen.add(rule);
    return true;
  });
  return deduped.includes("POINTS") ? deduped : (["POINTS", ...deduped] as PadelTieBreakRule[]);
}

type MatchInput = {
  id?: number;
  pairingAId: number | null;
  pairingBId: number | null;
  sideAEntityIds?: number[] | null;
  sideBEntityIds?: number[] | null;
  scoreSets: unknown;
  score?: unknown;
  status: string;
  groupLabel?: string | null;
};

type MatchStats = NonNullable<ReturnType<typeof resolvePadelMatchStats>>;

type CompareParams = {
  headToHead: Map<string, number>;
  group: string;
  rules: PadelTieBreakRule[];
  applyHeadToHead: boolean;
  includePairingIdFallback?: boolean;
  drawOrderSeed?: string;
};

const headToHeadKey = (group: string, aId: number, bId: number) =>
  `${group}:${Math.min(aId, bId)}:${Math.max(aId, bId)}`;

const resolveRowEntityId = (row: Pick<PadelStandingRow, "entityId" | "pairingId">) =>
  typeof row.entityId === "number" && Number.isFinite(row.entityId) ? row.entityId : row.pairingId;

const drawOrderValue = (seed: string, entityId: number) => {
  const digest = crypto.createHash("sha256").update(`${seed}:${entityId}`).digest("hex");
  return Number.parseInt(digest.slice(0, 12), 16);
};

const ensureRowIn = (
  map: Map<string, Record<number, PadelStandingRow>>,
  group: string,
  entityId: number,
  entityType: PadelStandingEntityType,
) => {
  if (!map.has(group)) map.set(group, {});
  const bucket = map.get(group)!;
  if (!bucket[entityId]) {
    bucket[entityId] = {
      entityId,
      pairingId: entityId,
      playerId: entityType === "PLAYER" ? entityId : null,
      points: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      setDiff: 0,
      gameDiff: 0,
      setsFor: 0,
      setsAgainst: 0,
      gamesFor: 0,
      gamesAgainst: 0,
    };
  }
  return bucket[entityId];
};

const compareRows = (a: PadelStandingRow, b: PadelStandingRow, params: CompareParams) => {
  const { rules, headToHead, group, applyHeadToHead } = params;
  const entityA = resolveRowEntityId(a);
  const entityB = resolveRowEntityId(b);
  for (const rule of rules) {
    if (rule === "POINTS" && a.points !== b.points) return b.points - a.points;
    if (rule === "HEAD_TO_HEAD" && applyHeadToHead) {
      const key = headToHeadKey(group, entityA, entityB);
      const h2h = headToHead.get(key);
      if (typeof h2h === "number" && h2h !== 0) return h2h > 0 ? -1 : 1;
    }
    if (rule === "SET_DIFFERENCE" && a.setDiff !== b.setDiff) return b.setDiff - a.setDiff;
    if (rule === "GAME_DIFFERENCE" && a.gameDiff !== b.gameDiff) return b.gameDiff - a.gameDiff;
    if (rule === "GAMES_FOR" && a.gamesFor !== b.gamesFor) return b.gamesFor - a.gamesFor;
    if (rule === "COIN_TOSS") {
      const seed = params.drawOrderSeed ?? `draw:${group}`;
      const drawA = drawOrderValue(seed, entityA);
      const drawB = drawOrderValue(seed, entityB);
      if (drawA !== drawB) return drawA - drawB;
    }
  }
  if (a.setsFor !== b.setsFor) return b.setsFor - a.setsFor;
  if (a.gamesFor !== b.gamesFor) return b.gamesFor - a.gamesFor;
  if (params.includePairingIdFallback === false) return 0;
  return entityA - entityB;
};

const pointsFor = (pointsTable: PadelPointsTable, key: "WIN" | "DRAW" | "LOSS" | "BYE_NEUTRAL", fallback: number) => {
  const raw = pointsTable[key];
  return Number.isFinite(raw) ? Number(raw) : fallback;
};

const applyMatchResult = (
  map: Map<string, Record<number, PadelStandingRow>>,
  headToHead: Map<string, number>,
  group: string,
  sideA: number[],
  sideB: number[],
  stats: MatchStats,
  pointsTable: PadelPointsTable,
  entityType: PadelStandingEntityType,
) => {
  const winPoints = pointsFor(pointsTable, "WIN", DEFAULT_PADEL_POINTS_TABLE.WIN);
  const drawPoints = pointsFor(pointsTable, "DRAW", DEFAULT_PADEL_POINTS_TABLE.DRAW ?? 1);
  const lossPoints = pointsFor(pointsTable, "LOSS", DEFAULT_PADEL_POINTS_TABLE.LOSS);
  const byePoints = pointsFor(pointsTable, "BYE_NEUTRAL", drawPoints);

  const aRows = sideA.map((id) => ensureRowIn(map, group, id, entityType));
  const bRows = sideB.map((id) => ensureRowIn(map, group, id, entityType));

  if (stats.resultType === "BYE_NEUTRAL") {
    const targetRows = aRows.length > 0 ? aRows : bRows;
    for (const row of targetRows) {
      row.points += byePoints;
      row.draws += 1;
    }
    return;
  }

  if (stats.isDraw || stats.winner == null) {
    for (const row of [...aRows, ...bRows]) {
      row.points += drawPoints;
      row.draws += 1;
    }
    for (const row of aRows) {
      row.setsFor += stats.aSets;
      row.setsAgainst += stats.bSets;
      row.setDiff += stats.aSets - stats.bSets;
      row.gamesFor += stats.aGames;
      row.gamesAgainst += stats.bGames;
      row.gameDiff += stats.aGames - stats.bGames;
    }
    for (const row of bRows) {
      row.setsFor += stats.bSets;
      row.setsAgainst += stats.aSets;
      row.setDiff += stats.bSets - stats.aSets;
      row.gamesFor += stats.bGames;
      row.gamesAgainst += stats.aGames;
      row.gameDiff += stats.bGames - stats.aGames;
    }
    return;
  }

  const winnerIsA = stats.winner === "A";
  const winningRows = winnerIsA ? aRows : bRows;
  const losingRows = winnerIsA ? bRows : aRows;

  for (const row of winningRows) {
    row.points += winPoints;
    row.wins += 1;
    row.setsFor += winnerIsA ? stats.aSets : stats.bSets;
    row.setsAgainst += winnerIsA ? stats.bSets : stats.aSets;
    row.setDiff += winnerIsA ? stats.aSets - stats.bSets : stats.bSets - stats.aSets;
    row.gamesFor += winnerIsA ? stats.aGames : stats.bGames;
    row.gamesAgainst += winnerIsA ? stats.bGames : stats.aGames;
    row.gameDiff += winnerIsA ? stats.aGames - stats.bGames : stats.bGames - stats.aGames;
  }
  for (const row of losingRows) {
    row.points += lossPoints;
    row.losses += 1;
    row.setsFor += winnerIsA ? stats.bSets : stats.aSets;
    row.setsAgainst += winnerIsA ? stats.aSets : stats.bSets;
    row.setDiff += winnerIsA ? stats.bSets - stats.aSets : stats.aSets - stats.bSets;
    row.gamesFor += winnerIsA ? stats.bGames : stats.aGames;
    row.gamesAgainst += winnerIsA ? stats.aGames : stats.bGames;
    row.gameDiff += winnerIsA ? stats.bGames - stats.aGames : stats.aGames - stats.bGames;
  }

  for (const aId of sideA) {
    for (const bId of sideB) {
      const key = headToHeadKey(group, aId, bId);
      const current = headToHead.get(key) ?? 0;
      headToHead.set(key, current + (winnerIsA ? 1 : -1));
    }
  }
};

export function comparePadelStandingsRows(
  a: PadelStandingRow,
  b: PadelStandingRow,
  tieBreakRules: PadelTieBreakRule[],
  options?: { includePairingIdFallback?: boolean; drawOrderSeed?: string },
) {
  return compareRows(a, b, {
    headToHead: new Map(),
    group: "",
    rules: tieBreakRules,
    applyHeadToHead: false,
    includePairingIdFallback: options?.includePairingIdFallback,
    drawOrderSeed: options?.drawOrderSeed,
  });
}

export function sortPadelStandingsRows(
  rows: PadelStandingRow[],
  tieBreakRules: PadelTieBreakRule[],
  options?: { includePairingIdFallback?: boolean; drawOrderSeed?: string },
) {
  return [...rows].sort((a, b) => comparePadelStandingsRows(a, b, tieBreakRules, options));
}

function computePadelStandingsByGroupCore(
  matches: MatchInput[],
  pointsTable: PadelPointsTable,
  tieBreakRules: PadelTieBreakRule[],
  options?: { entityType?: PadelStandingEntityType; drawOrderSeed?: string },
) {
  const entityType = options?.entityType ?? "PAIRING";
  const groups = new Map<string, Record<number, PadelStandingRow>>();
  const scoredMatches: Array<{ group: string; sideA: number[]; sideB: number[]; stats: MatchStats }> = [];

  matches.forEach((match) => {
    const group = match.groupLabel || "A";
    const sideA = (match.sideAEntityIds && match.sideAEntityIds.length > 0
      ? match.sideAEntityIds
      : match.pairingAId != null
        ? [match.pairingAId]
        : []) as number[];
    const sideB = (match.sideBEntityIds && match.sideBEntityIds.length > 0
      ? match.sideBEntityIds
      : match.pairingBId != null
        ? [match.pairingBId]
        : []) as number[];

    for (const entityId of [...sideA, ...sideB]) {
      ensureRowIn(groups, group, entityId, entityType);
    }
    if (match.status !== "DONE") return;
    const stats = resolvePadelMatchStats(match.scoreSets, match.score ?? null);
    if (!stats) return;
    scoredMatches.push({ group, sideA, sideB, stats });
  });

  const headToHead = new Map<string, number>();
  for (const match of scoredMatches) {
    applyMatchResult(groups, headToHead, match.group, match.sideA, match.sideB, match.stats, pointsTable, entityType);
  }

  const standings: Record<string, PadelStandingRow[]> = {};
  groups.forEach((rows, label) => {
    const list = Object.values(rows);
    const groupedByPoints = list.reduce<Record<number, PadelStandingRow[]>>((acc, row) => {
      acc[row.points] = acc[row.points] || [];
      acc[row.points].push(row);
      return acc;
    }, {});

    const resolved: PadelStandingRow[] = [];
    const pointKeys = Object.keys(groupedByPoints)
      .map(Number)
      .sort((a, b) => b - a);

    pointKeys.forEach((pts) => {
      const cluster = groupedByPoints[pts];
      if (cluster.length <= 1) {
        resolved.push(...cluster);
        return;
      }

      const mini = cluster.map((row) => ({
        ...row,
        points: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        setDiff: 0,
        gameDiff: 0,
        setsFor: 0,
        setsAgainst: 0,
        gamesFor: 0,
        gamesAgainst: 0,
      }));
      const miniMap = new Map<number, PadelStandingRow>();
      mini.forEach((row) => miniMap.set(row.entityId, row));
      const miniGroups = new Map<string, Record<number, PadelStandingRow>>([
        [label, Object.fromEntries(miniMap)],
      ]);
      const miniHeadToHead = new Map<string, number>();

      scoredMatches
        .filter((m) => m.group === label)
        .forEach((m) => {
          const sideA = m.sideA.filter((id) => miniMap.has(id));
          const sideB = m.sideB.filter((id) => miniMap.has(id));
          const include =
            (sideA.length > 0 && sideB.length > 0) || (m.stats.resultType === "BYE_NEUTRAL" && (sideA.length > 0 || sideB.length > 0));
          if (!include) return;
          applyMatchResult(miniGroups, miniHeadToHead, label, sideA, sideB, m.stats, pointsTable, entityType);
        });

      const sortedCluster = [...mini].sort((a, b) =>
        compareRows(a, b, {
          headToHead: miniHeadToHead,
          group: label,
          rules: tieBreakRules,
          applyHeadToHead: cluster.length >= 2,
          drawOrderSeed: options?.drawOrderSeed ? `${options.drawOrderSeed}:${label}` : undefined,
        }),
      );
      resolved.push(...sortedCluster.map((row) => rows[row.entityId]));
    });

    standings[label] = resolved;
  });

  return standings;
}

export function computePadelStandingsByGroup(
  matches: MatchInput[],
  pointsTable: PadelPointsTable,
  tieBreakRules: PadelTieBreakRule[],
  options?: { drawOrderSeed?: string },
) {
  return computePadelStandingsByGroupCore(matches, pointsTable, tieBreakRules, {
    entityType: "PAIRING",
    drawOrderSeed: options?.drawOrderSeed,
  });
}

export function computePadelStandingsByGroupForPlayers(
  matches: MatchInput[],
  pairingPlayers: Map<number, number[]>,
  pointsTable: PadelPointsTable,
  tieBreakRules: PadelTieBreakRule[],
  options?: { drawOrderSeed?: string },
) {
  const playerMatches: MatchInput[] = matches.map((match) => ({
    ...match,
    sideAEntityIds:
      match.sideAEntityIds ??
      (typeof match.pairingAId === "number" ? pairingPlayers.get(match.pairingAId) ?? [] : []),
    sideBEntityIds:
      match.sideBEntityIds ??
      (typeof match.pairingBId === "number" ? pairingPlayers.get(match.pairingBId) ?? [] : []),
  }));
  return computePadelStandingsByGroupCore(playerMatches, pointsTable, tieBreakRules, {
    entityType: "PLAYER",
    drawOrderSeed: options?.drawOrderSeed,
  });
}
