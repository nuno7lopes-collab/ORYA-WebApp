import { describe, expect, it } from "vitest";
import { BOOKING_CONFLICT_LOOKBACK_HOURS, getConflictWindowStart } from "@/lib/reservas/conflictWindow";

describe("booking conflict window", () => {
  it("uses a 24-hour lookback", () => {
    expect(BOOKING_CONFLICT_LOOKBACK_HOURS).toBe(24);
  });

  it("derives lower bound from the selected day start", () => {
    const dayStart = new Date("2026-02-18T00:00:00.000Z");
    expect(getConflictWindowStart(dayStart).toISOString()).toBe("2026-02-17T00:00:00.000Z");
  });
});
