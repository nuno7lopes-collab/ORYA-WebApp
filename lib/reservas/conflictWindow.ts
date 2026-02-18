const HOUR_MS = 60 * 60 * 1000;

export const BOOKING_CONFLICT_LOOKBACK_HOURS = 24;

export function getConflictWindowStart(dayStart: Date) {
  return new Date(dayStart.getTime() - BOOKING_CONFLICT_LOOKBACK_HOURS * HOUR_MS);
}
