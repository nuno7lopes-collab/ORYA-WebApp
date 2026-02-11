import { describe, expect, it } from "vitest";
import { isEndsAtAfterStart } from "@/lib/events/schedule";

describe("event schedule invariants", () => {
  it("accepts only endsAt strictly after startsAt", () => {
    const startsAt = new Date("2026-03-01T10:00:00.000Z");
    const endsAfter = new Date("2026-03-01T10:00:01.000Z");
    const endsEqual = new Date("2026-03-01T10:00:00.000Z");
    const endsBefore = new Date("2026-03-01T09:59:59.000Z");

    expect(isEndsAtAfterStart(startsAt, endsAfter)).toBe(true);
    expect(isEndsAtAfterStart(startsAt, endsEqual)).toBe(false);
    expect(isEndsAtAfterStart(startsAt, endsBefore)).toBe(false);
  });
});
