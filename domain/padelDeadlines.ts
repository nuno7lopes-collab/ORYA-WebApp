const MIN_DEADLINE_HOURS = 48;
const MAX_DEADLINE_HOURS = 168;
const BEFORE_EVENT_DEADLINE_HOURS = 24;
const MIN_LINK_MINUTES = 15;
const MAX_LINK_MINUTES = 30;
const DEFAULT_LINK_MINUTES = 30;
const GRACE_HOURS = 24;

export function clampDeadlineHours(raw?: number | null): number {
  const base = typeof raw === "number" && !Number.isNaN(raw) ? raw : MIN_DEADLINE_HOURS;
  return Math.min(Math.max(base, MIN_DEADLINE_HOURS), MAX_DEADLINE_HOURS);
}

export function computeDeadlineAt(now: Date, splitDeadlineHours?: number | null): Date {
  const hours = clampDeadlineHours(splitDeadlineHours);
  return new Date(now.getTime() + hours * 60 * 60 * 1000);
}

export function computeSplitDeadlineAt(
  invitedAt: Date,
  eventStartsAt: Date | null,
  splitDeadlineHours?: number | null,
) {
  const hours = clampDeadlineHours(splitDeadlineHours);
  const inviteDeadline = new Date(invitedAt.getTime() + hours * 60 * 60 * 1000);
  if (!eventStartsAt || Number.isNaN(eventStartsAt.getTime())) {
    return inviteDeadline;
  }
  const eventDeadline = new Date(eventStartsAt.getTime() - BEFORE_EVENT_DEADLINE_HOURS * 60 * 60 * 1000);
  return new Date(Math.min(inviteDeadline.getTime(), eventDeadline.getTime()));
}

export function clampLinkMinutes(raw?: number | null): number {
  const base = typeof raw === "number" && !Number.isNaN(raw) ? raw : DEFAULT_LINK_MINUTES;
  return Math.min(Math.max(base, MIN_LINK_MINUTES), MAX_LINK_MINUTES);
}

export function computePartnerLinkExpiresAt(now: Date, minutes?: number | null): Date {
  const mins = clampLinkMinutes(minutes);
  return new Date(now.getTime() + mins * 60 * 1000);
}

export function computeGraceUntil(now: Date): Date {
  return new Date(now.getTime() + GRACE_HOURS * 60 * 60 * 1000);
}
