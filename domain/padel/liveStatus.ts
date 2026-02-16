import { padel_match_status } from "@prisma/client";

export type PadelLiveMatchStatus = padel_match_status;

export const PADEL_MATCH_OFFICIAL_STATUSES = new Set<PadelLiveMatchStatus>([
  padel_match_status.OFFICIAL,
  padel_match_status.WALKOVER,
  padel_match_status.RETIRED,
]);

export const PADEL_MATCH_TERMINAL_STATUSES = new Set<PadelLiveMatchStatus>([
  padel_match_status.OFFICIAL,
  padel_match_status.WALKOVER,
  padel_match_status.RETIRED,
  padel_match_status.CANCELLED,
]);

export const PADEL_MATCH_PENDING_REVIEW_STATUSES = new Set<PadelLiveMatchStatus>([
  padel_match_status.PENDING_CONFIRMATION,
  padel_match_status.PENDING_REVIEW_EXPIRED,
]);

export function normalizePadelMatchStatus(status: string | padel_match_status | null | undefined): padel_match_status | null {
  if (!status) return null;
  if (Object.values(padel_match_status).includes(status as padel_match_status)) {
    return status as padel_match_status;
  }
  return null;
}

export function isPadelOfficialStatus(status: string | padel_match_status | null | undefined) {
  const normalized = normalizePadelMatchStatus(status);
  if (!normalized) return false;
  return (
    normalized === padel_match_status.OFFICIAL ||
    normalized === padel_match_status.WALKOVER ||
    normalized === padel_match_status.RETIRED
  );
}

export function isPadelTerminalStatus(status: string | padel_match_status | null | undefined) {
  const normalized = normalizePadelMatchStatus(status);
  if (!normalized) return false;
  return (
    normalized === padel_match_status.OFFICIAL ||
    normalized === padel_match_status.WALKOVER ||
    normalized === padel_match_status.RETIRED ||
    normalized === padel_match_status.CANCELLED
  );
}

export function isPadelLockedForReschedule(status: string | padel_match_status | null | undefined) {
  const normalized = normalizePadelMatchStatus(status);
  if (!normalized) return false;
  return normalized === padel_match_status.IN_PROGRESS || isPadelTerminalStatus(normalized);
}

export function toPadelPublicStatus(status: string | padel_match_status | null | undefined) {
  return normalizePadelMatchStatus(status);
}
