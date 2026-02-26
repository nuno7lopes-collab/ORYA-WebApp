import { buildAgendaConflictPayload } from "@/domain/agenda/conflictResponse";

export function buildBookingConflictBlocks(
  bookings: Array<{
    startsAt: Date;
    durationMinutes: number;
    professionalId: number | null;
    resourceId: number | null;
  }>,
) {
  return bookings.map((booking) => ({
    start: booking.startsAt,
    end: new Date(booking.startsAt.getTime() + booking.durationMinutes * 60 * 1000),
    professionalId: booking.professionalId,
    resourceId: booking.resourceId,
  }));
}

export function buildSessionConflictBlocks(
  sessions: Array<{ startsAt: Date; endsAt: Date; professionalId: number | null }>,
) {
  return sessions.map((session) => ({
    start: session.startsAt,
    end: session.endsAt,
    professionalId: session.professionalId,
    resourceId: null,
  }));
}

export function agendaConflictResponse(
  decision?: Parameters<typeof buildAgendaConflictPayload>[0]["decision"],
) {
  return {
    ok: false,
    ...buildAgendaConflictPayload({ decision: decision ?? null, fallbackReason: "MISSING_EXISTING_DATA" }),
  };
}
