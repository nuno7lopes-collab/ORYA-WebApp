import { Prisma } from "@prisma/client";

const GLOBAL_RATING_TABLE_MARKERS = [
  "padel_global_rating_profiles",
  "padel_global_rating_events",
  "padel_event_ranking_snapshots",
] as const;

export function isPadelGlobalRatingSchemaMissingError(error: unknown) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2021") {
    return false;
  }

  const table = String((error.meta as Record<string, unknown> | undefined)?.table ?? "").toLowerCase();
  const message = error.message.toLowerCase();
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
