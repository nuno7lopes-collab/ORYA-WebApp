export type PadelTieBreakRule =
  | "HEAD_TO_HEAD"
  | "SET_DIFFERENCE"
  | "GAME_DIFFERENCE"
  | "GAMES_FOR"
  | "POINTS"
  | "COIN_TOSS";

export type PadelPointsTable = Record<string, number>;

export type PadelScore = {
  mode?: "SETS" | "TIMED_GAMES";
  sets?: Array<{ teamA: number; teamB: number }>;
  gamesA?: number;
  gamesB?: number;
  endedAt?: string;
  endedByBuzzer?: boolean;
  allowDraw?: boolean;
  notes?: string;
  resultType?: "NORMAL" | "WALKOVER" | "RETIREMENT" | "INJURY" | "BYE_NEUTRAL";
  winnerSide?: "A" | "B";
  photoUrl?: string;
  walkover?: boolean;
};

export function isValidTieBreakRules(value: unknown): value is PadelTieBreakRule[] {
  if (!Array.isArray(value)) return false;
  return value.every((item) =>
    [
      "HEAD_TO_HEAD",
      "SET_DIFFERENCE",
      "GAME_DIFFERENCE",
      "GAMES_FOR",
      "POINTS",
      "COIN_TOSS",
    ].includes(String(item)),
  );
}

export function isValidPointsTable(value: unknown): value is PadelPointsTable {
  if (!value || typeof value !== "object") return false;
  return Object.values(value).every((v) => typeof v === "number" && Number.isFinite(v));
}

export function isValidScore(value: unknown): value is PadelScore {
  if (!value || typeof value !== "object") return false;
  const obj = value as {
    mode?: unknown;
    sets?: unknown;
    gamesA?: unknown;
    gamesB?: unknown;
    endedAt?: unknown;
    endedByBuzzer?: unknown;
    allowDraw?: unknown;
    notes?: unknown;
    resultType?: unknown;
    winnerSide?: unknown;
    photoUrl?: unknown;
    walkover?: unknown;
  };
  if (obj.mode && !["SETS", "TIMED_GAMES"].includes(String(obj.mode))) return false;
  if (obj.sets) {
    if (!Array.isArray(obj.sets)) return false;
    const okSets = obj.sets.every(
      (s) =>
        s &&
        typeof s === "object" &&
        Number.isFinite((s as { teamA?: unknown }).teamA) &&
        Number.isFinite((s as { teamB?: unknown }).teamB),
    );
    if (!okSets) return false;
  }
  if (obj.gamesA !== undefined && !Number.isFinite(Number(obj.gamesA))) return false;
  if (obj.gamesB !== undefined && !Number.isFinite(Number(obj.gamesB))) return false;
  if (obj.endedAt !== undefined && typeof obj.endedAt !== "string") return false;
  if (obj.endedByBuzzer !== undefined && typeof obj.endedByBuzzer !== "boolean") return false;
  if (obj.allowDraw !== undefined && typeof obj.allowDraw !== "boolean") return false;
  if (obj.notes && typeof obj.notes !== "string") return false;
  if (
    obj.resultType &&
    !["NORMAL", "WALKOVER", "RETIREMENT", "INJURY", "BYE_NEUTRAL"].includes(String(obj.resultType))
  ) {
    return false;
  }
  if (obj.winnerSide && !["A", "B"].includes(String(obj.winnerSide))) return false;
  if (obj.photoUrl && typeof obj.photoUrl !== "string") return false;
  if (obj.walkover && typeof obj.walkover !== "boolean") return false;
  return true;
}
