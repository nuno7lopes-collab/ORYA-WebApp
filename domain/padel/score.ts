export type PadelSetScore = { teamA: number; teamB: number };

export type PadelMatchStats = {
  sets: PadelSetScore[];
  aSets: number;
  bSets: number;
  aGames: number;
  bGames: number;
  winner: "A" | "B";
};

export type PadelScoreRules = {
  setsToWin: number;
  maxSets: number;
  gamesToWinSet: number;
  tieBreakAt: number | null;
  tieBreakTo: number | null;
  allowSuperTieBreak: boolean;
  superTieBreakTo: number;
  superTieBreakWinBy: number;
  superTieBreakOnlyDecider: boolean;
  allowExtendedGames: boolean;
};

export const DEFAULT_PADEL_SCORE_RULES: PadelScoreRules = {
  setsToWin: 2,
  maxSets: 3,
  gamesToWinSet: 6,
  tieBreakAt: 6,
  tieBreakTo: 7,
  allowSuperTieBreak: true,
  superTieBreakTo: 10,
  superTieBreakWinBy: 2,
  superTieBreakOnlyDecider: true,
  allowExtendedGames: false,
};

const WALKOVER_SET_COUNT = 2;
const WALKOVER_SET_GAMES = 6;

const clampInt = (raw: unknown, fallback: number, min: number, max: number) => {
  const parsed = typeof raw === "string" || typeof raw === "number" ? Number(raw) : NaN;
  if (!Number.isFinite(parsed)) return fallback;
  const value = Math.floor(parsed);
  if (value < min) return min;
  if (value > max) return max;
  return value;
};

export function normalizePadelScoreRules(raw: unknown): PadelScoreRules | null {
  if (!raw || typeof raw !== "object") return null;
  const input = raw as Record<string, unknown>;
  const setsToWin = clampInt(input.setsToWin, DEFAULT_PADEL_SCORE_RULES.setsToWin, 1, 5);
  const maxSetsFallback = Math.max(DEFAULT_PADEL_SCORE_RULES.maxSets, setsToWin * 2 - 1);
  const maxSets = clampInt(input.maxSets, maxSetsFallback, setsToWin, 9);
  const gamesToWinSet = clampInt(
    input.gamesToWinSet,
    DEFAULT_PADEL_SCORE_RULES.gamesToWinSet,
    1,
    9,
  );
  const tieBreakAtRaw = input.tieBreakAt;
  const tieBreakAt =
    tieBreakAtRaw === null
      ? null
      : clampInt(tieBreakAtRaw, DEFAULT_PADEL_SCORE_RULES.tieBreakAt ?? gamesToWinSet, 1, 12);
  const allowSuperTieBreak =
    typeof input.allowSuperTieBreak === "boolean"
      ? input.allowSuperTieBreak
      : DEFAULT_PADEL_SCORE_RULES.allowSuperTieBreak;
  const superTieBreakTo = clampInt(
    input.superTieBreakTo,
    DEFAULT_PADEL_SCORE_RULES.superTieBreakTo,
    5,
    20,
  );
  const superTieBreakWinBy = clampInt(
    input.superTieBreakWinBy,
    DEFAULT_PADEL_SCORE_RULES.superTieBreakWinBy,
    1,
    5,
  );
  const superTieBreakOnlyDecider =
    typeof input.superTieBreakOnlyDecider === "boolean"
      ? input.superTieBreakOnlyDecider
      : DEFAULT_PADEL_SCORE_RULES.superTieBreakOnlyDecider;
  const allowExtendedGames =
    typeof input.allowExtendedGames === "boolean"
      ? input.allowExtendedGames
      : DEFAULT_PADEL_SCORE_RULES.allowExtendedGames;
  const tieBreakTo =
    tieBreakAt === null
      ? null
      : clampInt(input.tieBreakTo, (tieBreakAt ?? gamesToWinSet) + 1, (tieBreakAt ?? 0) + 1, 15);

  return {
    setsToWin,
    maxSets,
    gamesToWinSet,
    tieBreakAt,
    tieBreakTo: tieBreakAt === null ? null : tieBreakTo,
    allowSuperTieBreak,
    superTieBreakTo,
    superTieBreakWinBy,
    superTieBreakOnlyDecider,
    allowExtendedGames,
  };
}

export function normalizePadelSets(raw: unknown): PadelSetScore[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const teamA = Number((item as { teamA?: unknown }).teamA);
      const teamB = Number((item as { teamB?: unknown }).teamB);
      if (!Number.isFinite(teamA) || !Number.isFinite(teamB)) return null;
      if (teamA < 0 || teamB < 0) return null;
      return { teamA, teamB };
    })
    .filter(Boolean) as PadelSetScore[];
}

export function buildWalkoverSets(winner: "A" | "B", rules?: Pick<PadelScoreRules, "setsToWin">): PadelSetScore[] {
  const setCount = Math.max(1, rules?.setsToWin ?? WALKOVER_SET_COUNT);
  return Array.from({ length: setCount }, () =>
    winner === "A" ? { teamA: WALKOVER_SET_GAMES, teamB: 0 } : { teamA: 0, teamB: WALKOVER_SET_GAMES },
  );
}

const isValidRegularSet = (set: PadelSetScore, rules: PadelScoreRules) => {
  const winnerGames = Math.max(set.teamA, set.teamB);
  const loserGames = Math.min(set.teamA, set.teamB);
  const diff = winnerGames - loserGames;
  if (winnerGames < rules.gamesToWinSet) return false;
  if (winnerGames === rules.gamesToWinSet) return diff >= 2;
  if (winnerGames === rules.gamesToWinSet + 1 && diff >= 2) return true;
  if (
    rules.tieBreakAt !== null &&
    rules.tieBreakTo !== null &&
    winnerGames === rules.tieBreakTo &&
    loserGames === rules.tieBreakAt
  ) {
    return true;
  }
  if (rules.allowExtendedGames || rules.tieBreakAt === null || rules.tieBreakTo === null) {
    return diff >= 2 && winnerGames >= rules.gamesToWinSet;
  }
  return false;
};

const isValidSuperTieBreakSet = (set: PadelSetScore, rules: PadelScoreRules) => {
  const winnerGames = Math.max(set.teamA, set.teamB);
  const loserGames = Math.min(set.teamA, set.teamB);
  const diff = winnerGames - loserGames;
  if (winnerGames < rules.superTieBreakTo) return false;
  return diff >= rules.superTieBreakWinBy;
};

export function computePadelMatchStats(rawSets: unknown, rules?: PadelScoreRules): PadelMatchStats | null {
  const sets = normalizePadelSets(rawSets);
  if (sets.length === 0) return null;
  if (rules && sets.length > rules.maxSets) return null;
  let aSets = 0;
  let bSets = 0;
  let aGames = 0;
  let bGames = 0;
  for (let idx = 0; idx < sets.length; idx += 1) {
    const set = sets[idx];
    if (set.teamA === set.teamB) return null;
    if (rules) {
      const isLast = idx === sets.length - 1;
      const canUseSuper =
        rules.allowSuperTieBreak && isLast && (!rules.superTieBreakOnlyDecider || aSets === bSets);
      const validSuper = canUseSuper && isValidSuperTieBreakSet(set, rules);
      const validRegular = isValidRegularSet(set, rules);
      if (!validSuper && !validRegular) return null;
    }
    aGames += set.teamA;
    bGames += set.teamB;
    if (set.teamA > set.teamB) {
      aSets += 1;
    } else {
      bSets += 1;
    }
    if (rules && (aSets === rules.setsToWin || bSets === rules.setsToWin) && idx < sets.length - 1) {
      return null;
    }
  }
  if (aSets === bSets) return null;
  if (rules && aSets !== rules.setsToWin && bSets !== rules.setsToWin) return null;
  return {
    sets,
    aSets,
    bSets,
    aGames,
    bGames,
    winner: aSets > bSets ? "A" : "B",
  };
}

export function resolvePadelMatchStats(
  scoreSets: unknown,
  score?: unknown,
  rules?: PadelScoreRules,
): PadelMatchStats | null {
  const scoreObj = score && typeof score === "object" && !Array.isArray(score) ? (score as Record<string, unknown>) : null;
  const scoreSetsRaw = Array.isArray(scoreSets)
    ? scoreSets
    : Array.isArray((scoreObj as { sets?: unknown } | null)?.sets)
      ? (scoreObj as { sets?: unknown }).sets
      : null;
  const stats = computePadelMatchStats(scoreSetsRaw, rules);
  if (stats) return stats;

  const winnerSide = scoreObj?.winnerSide;
  const resultType = scoreObj?.resultType;
  const isWalkover =
    scoreObj?.walkover === true || resultType === "WALKOVER" || resultType === "RETIREMENT" || resultType === "INJURY";
  if (!isWalkover) return null;
  if (winnerSide !== "A" && winnerSide !== "B") return null;
  return computePadelMatchStats(buildWalkoverSets(winnerSide, rules), rules);
}

export function resolvePadelWinnerFromSets(rawSets: unknown): "A" | "B" | null {
  const stats = computePadelMatchStats(rawSets);
  return stats ? stats.winner : null;
}
