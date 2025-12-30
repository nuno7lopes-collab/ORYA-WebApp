export type CheckinWindow = { start: Date | null; end: Date | null };

// Default policy: abre 6h antes e fecha 6h depois do fim; se não houver end, fecha 24h após start.
export function buildDefaultCheckinWindow(startsAt?: Date | null, endsAt?: Date | null): CheckinWindow {
  if (!startsAt) return { start: null, end: null };
  const start = new Date(startsAt.getTime() - 6 * 60 * 60 * 1000);
  const end = endsAt
    ? new Date(endsAt.getTime() + 6 * 60 * 60 * 1000)
    : new Date(startsAt.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

export function isOutsideWindow(window?: CheckinWindow) {
  if (!window) return false;
  const now = new Date();
  if (window.start && now < window.start) return true;
  if (window.end && now > window.end) return true;
  return false;
}
