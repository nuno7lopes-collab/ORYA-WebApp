export type PadelCategoryLevelResult =
  | { ok: true }
  | { ok: false; code: "LEVEL_REQUIRED_FOR_CATEGORY" | "CATEGORY_LEVEL_MISMATCH" };

const normalizeLevel = (value?: string | null) => (value ?? "").trim().toUpperCase();

const parseLevelNumber = (value: string) => {
  const match = value.match(/(\d+(?:[.,]\d+)?)/);
  if (!match) return null;
  const normalized = match[1].replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

export function validatePadelCategoryLevel(
  minLevel: string | null | undefined,
  maxLevel: string | null | undefined,
  playerLevel: string | null | undefined,
): PadelCategoryLevelResult {
  const min = normalizeLevel(minLevel);
  const max = normalizeLevel(maxLevel);
  const player = normalizeLevel(playerLevel);

  if (!min && !max) return { ok: true };
  if (!player) return { ok: false, code: "LEVEL_REQUIRED_FOR_CATEGORY" };

  const playerNum = parseLevelNumber(player);
  const minNum = min ? parseLevelNumber(min) : null;
  const maxNum = max ? parseLevelNumber(max) : null;

  if (playerNum !== null && (minNum !== null || maxNum !== null)) {
    const lower = minNum ?? Number.NEGATIVE_INFINITY;
    const upper = maxNum ?? Number.POSITIVE_INFINITY;
    if (playerNum < lower || playerNum > upper) {
      return { ok: false, code: "CATEGORY_LEVEL_MISMATCH" };
    }
    return { ok: true };
  }

  const enforceValue = (value: string): PadelCategoryLevelResult =>
    value
      ? player === value
        ? { ok: true }
        : { ok: false, code: "CATEGORY_LEVEL_MISMATCH" }
      : { ok: true };

  if (min && max && min === max) return enforceValue(min);
  if (min && !max) return enforceValue(min);
  if (!min && max) return enforceValue(max);

  return { ok: true };
}
