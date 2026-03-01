const GLOBAL_RATING_TABLE_MARKERS = [
  "padel_global_rating_profiles",
  "padel_global_rating_events",
  "padel_event_ranking_snapshots",
] as const;

export function isPadelGlobalRatingSchemaMissingError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: unknown }).code ?? null;
  if (code !== "P2021") return false;
  const meta = (error as { meta?: unknown }).meta;
  const table =
    meta && typeof meta === "object"
      ? String((meta as Record<string, unknown>).table ?? "").toLowerCase()
      : "";
  const message = String((error as { message?: unknown }).message ?? "").toLowerCase();
  return GLOBAL_RATING_TABLE_MARKERS.some((marker) => table.includes(marker) || message.includes(marker));
}

export async function withPadelGlobalRatingFallback<T>(
  operation: () => Promise<T>,
  fallback: T,
  scope: string,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (!isPadelGlobalRatingSchemaMissingError(error)) {
      throw error;
    }
    console.warn(`[padel/global-rating] schema missing; using fallback (${scope})`);
    return fallback;
  }
}
