export type BookingStateLike = {
  status?: string | null;
};

export function getBookingState(booking: BookingStateLike | null | undefined) {
  return booking?.status ?? null;
}

export function isBookingConfirmed(booking: BookingStateLike | null | undefined) {
  return booking?.status === "CONFIRMED";
}
