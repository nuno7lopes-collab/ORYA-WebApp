export const DEFAULT_EVENT_DURATION_HOURS = 5;
export const DEFAULT_EVENT_DURATION_MS = DEFAULT_EVENT_DURATION_HOURS * 60 * 60 * 1000;

export function buildDefaultEndsAt(startsAt: Date): Date {
  return new Date(startsAt.getTime() + DEFAULT_EVENT_DURATION_MS);
}

export function isEndsAtAfterStart(startsAt: Date, endsAt: Date): boolean {
  return endsAt.getTime() > startsAt.getTime();
}

export function normalizeEndsAt(startsAt: Date, endsAt?: Date | string | null): Date {
  const resolved = endsAt instanceof Date ? endsAt : endsAt ? new Date(endsAt) : null;
  if (!resolved || Number.isNaN(resolved.getTime()) || !isEndsAtAfterStart(startsAt, resolved)) {
    return buildDefaultEndsAt(startsAt);
  }
  return resolved;
}
