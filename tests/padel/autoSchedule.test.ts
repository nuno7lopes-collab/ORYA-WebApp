import { describe, expect, it } from "vitest";
import { computeAutoSchedulePlan } from "@/domain/padel/autoSchedule";

describe("padel auto-schedule", () => {
  it("respects rest windows and court blocks", () => {
    const windowStart = new Date("2025-01-01T10:00:00Z");
    const windowEnd = new Date("2025-01-01T14:00:00Z");

    const result = computeAutoSchedulePlan({
      unscheduledMatches: [
        {
          id: 1,
          sideAProfileIds: [101],
          sideBProfileIds: [201],
          plannedDurationMinutes: null,
          courtId: null,
          roundType: "GROUPS",
        },
        {
          id: 2,
          sideAProfileIds: [101],
          sideBProfileIds: [301],
          plannedDurationMinutes: null,
          courtId: null,
          roundType: "GROUPS",
        },
      ],
      scheduledMatches: [],
      courts: [{ id: 1 }, { id: 2 }],
      availabilities: [],
      courtBlocks: [
        { courtId: 1, startAt: new Date("2025-01-01T10:00:00Z"), endAt: new Date("2025-01-01T12:00:00Z") },
      ],
      config: {
        windowStart,
        windowEnd,
        durationMinutes: 60,
        slotMinutes: 30,
        bufferMinutes: 0,
        minRestMinutes: 30,
        priority: "GROUPS_FIRST",
      },
    });

    expect(result.scheduled.length).toBe(2);
    const first = result.scheduled[0];
    const second = result.scheduled[1];
    expect(first.courtId).toBe(2);
    expect(first.start.toISOString()).toBe("2025-01-01T10:00:00.000Z");
    expect(second.courtId).toBe(2);
    expect(second.start.toISOString()).toBe("2025-01-01T11:30:00.000Z");
  });

  it("avoids player availability blocks", () => {
    const windowStart = new Date("2025-01-01T10:00:00Z");
    const windowEnd = new Date("2025-01-01T15:00:00Z");

    const result = computeAutoSchedulePlan({
      unscheduledMatches: [
        {
          id: 10,
          sideAProfileIds: [401],
          sideBProfileIds: [501],
          plannedDurationMinutes: null,
          courtId: null,
          roundType: "GROUPS",
        },
      ],
      scheduledMatches: [],
      courts: [{ id: 1 }],
      availabilities: [
        { playerProfileId: 401, playerEmail: null, startAt: new Date("2025-01-01T10:00:00Z"), endAt: new Date("2025-01-01T12:30:00Z") },
      ],
      courtBlocks: [],
      config: {
        windowStart,
        windowEnd,
        durationMinutes: 60,
        slotMinutes: 30,
        bufferMinutes: 0,
        minRestMinutes: 0,
        priority: "GROUPS_FIRST",
      },
    });

    expect(result.scheduled.length).toBe(1);
    expect(result.scheduled[0].start.toISOString()).toBe("2025-01-01T12:30:00.000Z");
  });
});
