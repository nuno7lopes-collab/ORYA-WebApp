import { isValidPointsTable, isValidTieBreakRules, type PadelPointsTable, type PadelTieBreakRule } from "@/lib/padel/validation";
import { resolvePadelMatchStats } from "@/domain/padel/score";

export type PadelStandingRow = {
  pairingId: number;
  points: number;
  wins: number;
  losses: number;
  setDiff: number;
  gameDiff: number;
  setsFor: number;
  setsAgainst: number;
  gamesFor: number;
  gamesAgainst: number;
};

export const DEFAULT_PADEL_POINTS_TABLE: PadelPointsTable = { WIN: 3, LOSS: 0 };
export const DEFAULT_PADEL_TIE_BREAK_RULES: PadelTieBreakRule[] = [
  "POINTS",
  "HEAD_TO_HEAD",
  "SET_DIFFERENCE",
  "GAME_DIFFERENCE",
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
  pairingAId: number | null;
  pairingBId: number | null;
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
};

const headToHeadKey = (group: string, aId: number, bId: number) =>
  `${group}:${Math.min(aId, bId)}:${Math.max(aId, bId)}`;

const ensureRowIn = (map: Map<string, Record<number, PadelStandingRow>>, group: string, pairingId: number) => {
  if (!map.has(group)) map.set(group, {});
  const bucket = map.get(group)!;
  if (!bucket[pairingId]) {
    bucket[pairingId] = {
      pairingId,
      points: 0,
      wins: 0,
      losses: 0,
      setDiff: 0,
      gameDiff: 0,
      setsFor: 0,
      setsAgainst: 0,
      gamesFor: 0,
      gamesAgainst: 0,
    };
  }
  return bucket[pairingId];
};

const compareRows = (a: PadelStandingRow, b: PadelStandingRow, params: CompareParams) => {
  const { rules, headToHead, group, applyHeadToHead } = params;
  for (const rule of rules) {
    if (rule === "POINTS" && a.points !== b.points) return b.points - a.points;
    if (rule === "HEAD_TO_HEAD" && applyHeadToHead) {
      const key = headToHeadKey(group, a.pairingId, b.pairingId);
      const h2h = headToHead.get(key);
      if (h2h === 1) return -1;
      if (h2h === -1) return 1;
    }
    if (rule === "SET_DIFFERENCE" && a.setDiff !== b.setDiff) return b.setDiff - a.setDiff;
    if (rule === "GAME_DIFFERENCE" && a.gameDiff !== b.gameDiff) return b.gameDiff - a.gameDiff;
    if (rule === "COIN_TOSS") return a.pairingId - b.pairingId;
  }
  if (a.setsFor !== b.setsFor) return b.setsFor - a.setsFor;
  if (a.gamesFor !== b.gamesFor) return b.gamesFor - a.gamesFor;
  if (params.includePairingIdFallback === false) return 0;
  return a.pairingId - b.pairingId;
};

const applyMatchResult = (
  map: Map<string, Record<number, PadelStandingRow>>,
  headToHead: Map<string, number>,
  group: string,
  aId: number,
  bId: number,
  stats: { aSets: number; bSets: number; aGames: number; bGames: number; winner: "A" | "B" },
  pointsTable: PadelPointsTable,
) => {
  const winPoints = Number.isFinite(pointsTable.WIN) ? pointsTable.WIN : DEFAULT_PADEL_POINTS_TABLE.WIN;
  const lossPoints = Number.isFinite(pointsTable.LOSS) ? pointsTable.LOSS : DEFAULT_PADEL_POINTS_TABLE.LOSS;
  const aRow = ensureRowIn(map, group, aId);
  const bRow = ensureRowIn(map, group, bId);
  const winnerIsA = stats.winner === "A";
  headToHead.set(headToHeadKey(group, aId, bId), winnerIsA ? 1 : -1);

  const winRow = winnerIsA ? aRow : bRow;
  const loseRow = winnerIsA ? bRow : aRow;
  const winSets = winnerIsA ? stats.aSets : stats.bSets;
  const loseSets = winnerIsA ? stats.bSets : stats.aSets;
  const winGames = winnerIsA ? stats.aGames : stats.bGames;
  const loseGames = winnerIsA ? stats.bGames : stats.aGames;

  winRow.points += winPoints;
  winRow.wins += 1;
  winRow.setsFor += winSets;
  winRow.setsAgainst += loseSets;
  winRow.setDiff += winSets - loseSets;
  winRow.gamesFor += winGames;
  winRow.gamesAgainst += loseGames;
  winRow.gameDiff += winGames - loseGames;

  loseRow.points += lossPoints;
  loseRow.losses += 1;
  loseRow.setsFor += loseSets;
  loseRow.setsAgainst += winSets;
  loseRow.setDiff += loseSets - winSets;
  loseRow.gamesFor += loseGames;
  loseRow.gamesAgainst += winGames;
  loseRow.gameDiff += loseGames - winGames;
};

export function comparePadelStandingsRows(
  a: PadelStandingRow,
  b: PadelStandingRow,
  tieBreakRules: PadelTieBreakRule[],
  options?: { includePairingIdFallback?: boolean },
) {
  return compareRows(a, b, {
    headToHead: new Map(),
    group: "",
    rules: tieBreakRules,
    applyHeadToHead: false,
    includePairingIdFallback: options?.includePairingIdFallback,
  });
}

export function sortPadelStandingsRows(
  rows: PadelStandingRow[],
  tieBreakRules: PadelTieBreakRule[],
  options?: { includePairingIdFallback?: boolean },
) {
  return [...rows].sort((a, b) => comparePadelStandingsRows(a, b, tieBreakRules, options));
}

export function computePadelStandingsByGroup(
  matches: MatchInput[],
  pointsTable: PadelPointsTable,
  tieBreakRules: PadelTieBreakRule[],
) {
  const groups = new Map<string, Record<number, PadelStandingRow>>();
  const scoredMatches: Array<{ group: string; pairingAId: number; pairingBId: number; stats: MatchStats }> = [];

  matches.forEach((match) => {
    const group = match.groupLabel || "A";
    if (match.pairingAId) ensureRowIn(groups, group, match.pairingAId);
    if (match.pairingBId) ensureRowIn(groups, group, match.pairingBId);
    if (match.status !== "DONE") return;
    if (!match.pairingAId || !match.pairingBId) return;
    const stats = resolvePadelMatchStats(match.scoreSets, match.score ?? null);
    if (!stats) return;
    scoredMatches.push({ group, pairingAId: match.pairingAId, pairingBId: match.pairingBId, stats });
  });

  const headToHead = new Map<string, number>();
  scoredMatches.forEach((match) => {
    applyMatchResult(
      groups,
      headToHead,
      match.group,
      match.pairingAId,
      match.pairingBId,
      match.stats,
      pointsTable,
    );
  });

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
        losses: 0,
        setDiff: 0,
        gameDiff: 0,
        setsFor: 0,
        setsAgainst: 0,
        gamesFor: 0,
        gamesAgainst: 0,
      }));
      const miniMap = new Map<number, PadelStandingRow>();
      mini.forEach((row) => miniMap.set(row.pairingId, row));
      const miniGroups = new Map<string, Record<number, PadelStandingRow>>([
        [label, Object.fromEntries(miniMap)],
      ]);
      const miniHeadToHead = new Map<string, number>();

      scoredMatches
        .filter(
          (m) =>
            m.group === label &&
            cluster.some((c) => c.pairingId === m.pairingAId || c.pairingId === m.pairingBId),
        )
        .forEach((m) => {
          if (!miniMap.has(m.pairingAId) || !miniMap.has(m.pairingBId)) return;
          applyMatchResult(
            miniGroups,
            miniHeadToHead,
            label,
            m.pairingAId,
            m.pairingBId,
            m.stats,
            pointsTable,
          );
        });

      const sortedCluster = [...mini].sort((a, b) =>
        compareRows(a, b, {
          headToHead: miniHeadToHead,
          group: label,
          rules: tieBreakRules,
          applyHeadToHead: cluster.length >= 2,
        }),
      );
      resolved.push(...sortedCluster.map((row) => rows[row.pairingId]));
    });

    standings[label] = resolved;
  });

  return standings;
}
