export type PadelTieBreakRule =
  | "HEAD_TO_HEAD"
  | "SET_DIFFERENCE"
  | "GAME_DIFFERENCE"
  | "POINTS"
  | "COIN_TOSS";

export type PadelPointsTable = Record<string, number>;

export type PadelScore = {
  sets?: Array<{ teamA: number; teamB: number }>;
  notes?: string;
  resultType?: "NORMAL" | "WALKOVER" | "RETIREMENT" | "INJURY";
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
    sets?: unknown;
    notes?: unknown;
    resultType?: unknown;
    winnerSide?: unknown;
    photoUrl?: unknown;
    walkover?: unknown;
  };
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
  if (obj.notes && typeof obj.notes !== "string") return false;
  if (
    obj.resultType &&
    !["NORMAL", "WALKOVER", "RETIREMENT", "INJURY"].includes(String(obj.resultType))
  ) {
    return false;
  }
  if (obj.winnerSide && !["A", "B"].includes(String(obj.winnerSide))) return false;
  if (obj.photoUrl && typeof obj.photoUrl !== "string") return false;
  if (obj.walkover && typeof obj.walkover !== "boolean") return false;
  return true;
}
