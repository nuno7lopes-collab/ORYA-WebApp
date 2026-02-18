import { describe, expect, it } from "vitest";
import { buildSlotsForRange, getDateParts, makeUtcDateFromLocal } from "@/lib/reservas/availability";

function getLocalDateTimeParts(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const map = new Map(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(map.get("year")),
    month: Number(map.get("month")),
    day: Number(map.get("day")),
    hour: Number(map.get("hour")),
    minute: Number(map.get("minute")),
  };
}

describe("availability timezone conversion", () => {
  it("keeps winter midnight on the same local date for Europe/Lisbon", () => {
    const timezone = "Europe/Lisbon";
    const utc = makeUtcDateFromLocal(
      { year: 2026, month: 2, day: 15, hour: 0, minute: 30 },
      timezone,
    );
    const local = getLocalDateTimeParts(utc, timezone);

    expect(local).toEqual({
      year: 2026,
      month: 2,
      day: 15,
      hour: 0,
      minute: 30,
    });
  });

  it("keeps summer late-night on the same local date for Europe/Lisbon", () => {
    const timezone = "Europe/Lisbon";
    const utc = makeUtcDateFromLocal(
      { year: 2026, month: 6, day: 15, hour: 23, minute: 30 },
      timezone,
    );
    const local = getLocalDateTimeParts(utc, timezone);

    expect(local).toEqual({
      year: 2026,
      month: 6,
      day: 15,
      hour: 23,
      minute: 30,
    });
  });

  it("builds summer day slots only for the requested local date", () => {
    const timezone = "Europe/Lisbon";
    const day = { year: 2026, month: 6, day: 15 };
    const rangeStart = makeUtcDateFromLocal({ ...day, hour: 0, minute: 0 }, timezone);
    const rangeEnd = makeUtcDateFromLocal({ ...day, hour: 23, minute: 59 }, timezone);

    expect(rangeEnd.getTime()).toBeGreaterThan(rangeStart.getTime());

    const dayOfWeek = new Date(Date.UTC(day.year, day.month - 1, day.day)).getUTCDay();
    const slots = buildSlotsForRange({
      rangeStart,
      rangeEnd,
      timezone,
      templates: [{ dayOfWeek, intervals: [{ startMinute: 9 * 60, endMinute: 10 * 60 }] }],
      overrides: [],
      durationMinutes: 30,
      stepMinutes: 30,
      now: new Date(rangeStart.getTime() - 60 * 1000),
    });

    expect(slots).toHaveLength(2);
    slots.forEach((slot) => {
      const parts = getDateParts(slot.startsAt, timezone);
      expect(parts).toMatchObject(day);
    });
  });
});
