import { describe, expect, it } from "vitest";
import { buildProjectedEvents } from "@/app/org/[orgId]/calendar/_components/day/helpers";
import { buildAggregateAgendaItems } from "@/app/org/[orgId]/calendar/_components/week/aggregation";
import type { CalendarEvent } from "@/app/org/[orgId]/calendar/_components/day/types";

function buildEvent(id: string, startsAt: string, endsAt: string): CalendarEvent {
  return {
    id,
    kind: "RESERVATION",
    title: id,
    startsAt,
    endsAt,
    status: "CONFIRMED",
    reservationId: 1,
    eventId: null,
    tournamentId: null,
    courtId: null,
    professionalId: null,
    resourceId: null,
    serviceId: null,
    serviceTitle: null,
    serviceKind: null,
    bookingType: "INDIVIDUAL",
    channel: "BACKOFFICE",
    paymentStatus: "UNKNOWN",
    createdAt: null,
    requestedProfessionalId: null,
    requestedResourceId: null,
  };
}

describe("day general aggregation", () => {
  it("aggregates chained overlaps into a single block", () => {
    const day = new Date("2026-02-17T12:00:00.000Z");
    const events = [
      buildEvent("one", "2026-02-17T10:00:00.000Z", "2026-02-17T10:20:00.000Z"),
      buildEvent("two", "2026-02-17T10:15:00.000Z", "2026-02-17T10:20:00.000Z"),
      buildEvent("three", "2026-02-17T10:10:00.000Z", "2026-02-17T10:35:00.000Z"),
    ];

    const projected = buildProjectedEvents({ events, day, timezone: "UTC" });
    const aggregates = buildAggregateAgendaItems({
      positions: projected,
      dayKey: "general",
      minuteHeight: 1,
    });

    expect(aggregates).toHaveLength(1);
    expect(aggregates[0]?.startMinute).toBe(10 * 60);
    expect(aggregates[0]?.endMinute).toBe(10 * 60 + 35);
    expect(aggregates[0]?.items).toHaveLength(3);
  });
});
