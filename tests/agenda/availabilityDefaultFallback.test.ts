import { describe, expect, it } from "vitest";
import { buildSlotsForRange, getDateParts, makeUtcDateFromLocal } from "@/lib/reservas/availability";

function getTimeParts(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const map = new Map(parts.map((part) => [part.type, part.value]));
  return {
    hour: Number(map.get("hour")),
    minute: Number(map.get("minute")),
  };
}

describe("availability default fallback", () => {
  it("applies default Mon-Fri 08:00-17:00 when no templates exist", () => {
    const timezone = "Europe/Lisbon";
    const monday = { year: 2026, month: 6, day: 15 };
    const rangeStart = makeUtcDateFromLocal({ ...monday, hour: 0, minute: 0 }, timezone);
    const rangeEnd = makeUtcDateFromLocal({ ...monday, hour: 23, minute: 59 }, timezone);

    const slots = buildSlotsForRange({
      rangeStart,
      rangeEnd,
      timezone,
      templates: [],
      overrides: [],
      durationMinutes: 60,
      stepMinutes: 60,
      now: new Date(rangeStart.getTime() - 60 * 1000),
    });

    expect(slots).toHaveLength(9);
    const first = getTimeParts(slots[0].startsAt, timezone);
    const last = getTimeParts(slots[slots.length - 1].startsAt, timezone);
    expect(first).toEqual({ hour: 8, minute: 0 });
    expect(last).toEqual({ hour: 16, minute: 0 });
  });

  it("keeps explicit empty template as closed for that day", () => {
    const timezone = "Europe/Lisbon";
    const monday = { year: 2026, month: 6, day: 15 };
    const dayOfWeek = new Date(Date.UTC(monday.year, monday.month - 1, monday.day)).getUTCDay();
    const rangeStart = makeUtcDateFromLocal({ ...monday, hour: 0, minute: 0 }, timezone);
    const rangeEnd = makeUtcDateFromLocal({ ...monday, hour: 23, minute: 59 }, timezone);

    const slots = buildSlotsForRange({
      rangeStart,
      rangeEnd,
      timezone,
      templates: [{ dayOfWeek, intervals: [] }],
      overrides: [],
      durationMinutes: 60,
      stepMinutes: 60,
      now: new Date(rangeStart.getTime() - 60 * 1000),
    });

    expect(slots).toHaveLength(0);
  });

  it("keeps weekend closed by default", () => {
    const timezone = "Europe/Lisbon";
    const sunday = { year: 2026, month: 6, day: 14 };
    const rangeStart = makeUtcDateFromLocal({ ...sunday, hour: 0, minute: 0 }, timezone);
    const rangeEnd = makeUtcDateFromLocal({ ...sunday, hour: 23, minute: 59 }, timezone);

    const slots = buildSlotsForRange({
      rangeStart,
      rangeEnd,
      timezone,
      templates: [],
      overrides: [],
      durationMinutes: 60,
      stepMinutes: 60,
      now: new Date(rangeStart.getTime() - 60 * 1000),
    });

    expect(slots).toHaveLength(0);
    const startParts = getDateParts(rangeStart, timezone);
    expect(startParts).toEqual(sunday);
  });
});
