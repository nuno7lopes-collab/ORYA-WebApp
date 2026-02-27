export const BOOKING_PENDING_HOLD_MINUTES = 10;
export const PENDING_BOOKING_STATUSES = ["PENDING_CONFIRMATION", "PENDING"] as const;

export type BookingPendingState = "NONE" | "ACTIVE" | "EXPIRED" | "PAST_START";

export function isPendingBookingStatus(status: string | null | undefined) {
  return typeof status === "string" && PENDING_BOOKING_STATUSES.includes(status as any);
}

export function resolvePendingBookingState(params: {
  status: string | null | undefined;
  startsAt: Date;
  pendingExpiresAt: Date | null;
  createdAt: Date;
  now: Date;
  holdMinutes?: number;
}): BookingPendingState {
  if (!isPendingBookingStatus(params.status)) return "NONE";
  if (params.startsAt.getTime() <= params.now.getTime()) return "PAST_START";
  const holdMinutes =
    typeof params.holdMinutes === "number" && Number.isFinite(params.holdMinutes) && params.holdMinutes > 0
      ? Math.floor(params.holdMinutes)
      : BOOKING_PENDING_HOLD_MINUTES;
  const fallbackExpiry = new Date(params.createdAt.getTime() + holdMinutes * 60 * 1000);
  const expiresAt = params.pendingExpiresAt ?? fallbackExpiry;
  return expiresAt.getTime() <= params.now.getTime() ? "EXPIRED" : "ACTIVE";
}

export function resolveEffectiveBookingStatus(status: string, pendingState: BookingPendingState) {
  if (pendingState === "EXPIRED" || pendingState === "PAST_START") return "CANCELLED_BY_CLIENT";
  return status;
}

