type EventStatusLike = string | null | undefined;

export const EVENT_OPERATIONAL_STATUSES = ["PUBLISHED", "DATE_CHANGED"] as Array<
  "PUBLISHED" | "DATE_CHANGED"
>;

export const EVENT_TERMINAL_STATUSES = ["CANCELLED", "FINISHED"] as Array<
  "CANCELLED" | "FINISHED"
>;

export type EventOperationalBlockReason = "EVENT_CLOSED" | "EVENT_CANCELLED";

export function normalizeEventStatus(status?: EventStatusLike) {
  return typeof status === "string" ? status.trim().toUpperCase() : "";
}

export function isEventCancelledStatus(status?: EventStatusLike) {
  return normalizeEventStatus(status) === "CANCELLED";
}

export function isEventOperationalStatus(status?: EventStatusLike) {
  return EVENT_OPERATIONAL_STATUSES.includes(
    normalizeEventStatus(status) as (typeof EVENT_OPERATIONAL_STATUSES)[number],
  );
}

export function isEventTerminalStatus(status?: EventStatusLike) {
  return EVENT_TERMINAL_STATUSES.includes(
    normalizeEventStatus(status) as (typeof EVENT_TERMINAL_STATUSES)[number],
  );
}

export function hasEventEndedByDate(
  endsAt?: Date | string | null,
  now: Date = new Date(),
) {
  if (!endsAt) return false;
  const parsed = endsAt instanceof Date ? endsAt : new Date(endsAt);
  if (!Number.isFinite(parsed.getTime())) return false;
  return parsed.getTime() <= now.getTime();
}

export function resolveEventOperationalBlockReason(params: {
  status?: EventStatusLike;
  isDeleted?: boolean | null;
  endsAt?: Date | string | null;
  now?: Date;
}): EventOperationalBlockReason | null {
  if (params.isDeleted) return "EVENT_CLOSED";
  if (isEventCancelledStatus(params.status)) return "EVENT_CANCELLED";
  if (!isEventOperationalStatus(params.status)) return "EVENT_CLOSED";
  if (hasEventEndedByDate(params.endsAt, params.now ?? new Date())) return "EVENT_CLOSED";
  return null;
}
