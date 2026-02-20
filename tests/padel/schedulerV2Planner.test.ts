import { describe, expect, it } from "vitest";
import { computeSchedulerV2Plan } from "@/domain/padel/schedulerV2/planner";

describe("padel scheduler v2 planner", () => {
  it("equilibra categorias quando strategy é BALANCED_BY_CATEGORY", () => {
    const result = computeSchedulerV2Plan({
      strategy: "BALANCED_BY_CATEGORY",
      unscheduledMatches: [
        {
          id: 1,
          categoryId: 1,
          sideAProfileIds: [101],
          sideBProfileIds: [201],
          plannedDurationMinutes: null,
          courtId: null,
          roundType: "GROUPS",
        },
        {
          id: 2,
          categoryId: 1,
          sideAProfileIds: [102],
          sideBProfileIds: [202],
          plannedDurationMinutes: null,
          courtId: null,
          roundType: "GROUPS",
        },
        {
          id: 3,
          categoryId: 2,
          sideAProfileIds: [103],
          sideBProfileIds: [203],
          plannedDurationMinutes: null,
          courtId: null,
          roundType: "GROUPS",
        },
        {
          id: 4,
          categoryId: 2,
          sideAProfileIds: [104],
          sideBProfileIds: [204],
          plannedDurationMinutes: null,
          courtId: null,
          roundType: "GROUPS",
        },
      ],
      scheduledMatches: [],
      courts: [{ id: 1 }],
      availabilities: [],
      courtBlocks: [],
      config: {
        windowStart: new Date("2025-01-01T09:00:00Z"),
        windowEnd: new Date("2025-01-01T13:00:00Z"),
        durationMinutes: 60,
        slotMinutes: 30,
        bufferMinutes: 0,
        minRestMinutes: 0,
        priority: "GROUPS_FIRST",
      },
    });

    expect(result.scheduled.map((item) => item.matchId)).toEqual([1, 3, 2, 4]);
    expect(result.byCategory).toEqual([
      {
        categoryId: 1,
        scheduledCount: 2,
        skippedCount: 0,
        unscheduledByReason: {},
      },
      {
        categoryId: 2,
        scheduledCount: 2,
        skippedCount: 0,
        unscheduledByReason: {},
      },
    ]);
  });

  it("respeita strategy KNOCKOUT_FIRST", () => {
    const result = computeSchedulerV2Plan({
      strategy: "KNOCKOUT_FIRST",
      unscheduledMatches: [
        {
          id: 10,
          categoryId: 1,
          sideAProfileIds: [901],
          sideBProfileIds: [902],
          plannedDurationMinutes: null,
          courtId: null,
          roundType: "GROUPS",
          roundLabel: "Jornada 1",
        },
        {
          id: 11,
          categoryId: 1,
          sideAProfileIds: [903],
          sideBProfileIds: [904],
          plannedDurationMinutes: null,
          courtId: null,
          roundType: "KNOCKOUT",
          roundLabel: "SEMIFINAL",
        },
      ],
      scheduledMatches: [],
      courts: [{ id: 1 }],
      availabilities: [],
      courtBlocks: [],
      config: {
        windowStart: new Date("2025-01-01T09:00:00Z"),
        windowEnd: new Date("2025-01-01T12:00:00Z"),
        durationMinutes: 60,
        slotMinutes: 30,
        bufferMinutes: 0,
        minRestMinutes: 0,
        priority: "GROUPS_FIRST",
      },
    });

    expect(result.scheduled[0]?.matchId).toBe(11);
    expect(result.byCategory[0]?.scheduledCount).toBe(2);
  });
});
