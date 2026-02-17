import { describe, expect, it } from "vitest";
import { computePadelPlan, summarizeScheduleFeasibility } from "@/domain/padel/formatEngine/capacity";

describe("formatEngine capacity", () => {
  it("computes groups + knockout needs", () => {
    const plan = computePadelPlan({
      format: "GRUPOS_ELIMINATORIAS",
      teams: 16,
      windowStart: "2026-02-17T09:00:00.000Z",
      windowEnd: "2026-02-17T17:00:00.000Z",
      durationMinutes: 60,
      bufferMinutes: 0,
      courtsCount: 4,
      groupCount: 4,
      qualifyPerGroup: 2,
      extraQualifiers: 0,
    });

    expect(plan.categories).toHaveLength(1);
    expect(plan.categories[0]?.matchesNeeded).toBeGreaterThan(0);
    expect(plan.categories[0]?.rounds.some((round) => round.type === "GROUPS")).toBe(true);
    expect(plan.categories[0]?.rounds.some((round) => round.type === "KNOCKOUT")).toBe(true);
  });

  it("flags infeasible plan when slots are not enough", () => {
    const plan = computePadelPlan({
      format: "TODOS_CONTRA_TODOS",
      teams: 12,
      windowStart: "2026-02-17T09:00:00.000Z",
      windowEnd: "2026-02-17T11:00:00.000Z",
      durationMinutes: 60,
      bufferMinutes: 0,
      courtsCount: 2,
    });

    expect(plan.totalSlots).toBe(4);
    expect(plan.matchesNeeded).toBeGreaterThan(plan.totalSlots);
    expect(plan.feasible).toBe(false);
    expect(plan.blockingReasons).toContain("INSUFFICIENT_CAPACITY");
    expect(plan.alternatives.length).toBeGreaterThan(0);
  });

  it("summarizes unscheduled reasons", () => {
    const summary = summarizeScheduleFeasibility([
      { reason: "NO_SLOT_AVAILABLE" },
      { reason: "NO_SLOT_AVAILABLE" },
      { reason: "COURT_NOT_AVAILABLE" },
    ]);

    expect(summary.feasible).toBe(false);
    expect(summary.unscheduledByReason.NO_SLOT_AVAILABLE).toBe(2);
    expect(summary.unscheduledByReason.COURT_NOT_AVAILABLE).toBe(1);
  });

  it("returns hard cap and queue estimates for NON_STOP modes", () => {
    const hardCapPlan = computePadelPlan({
      format: "NON_STOP",
      windowStart: "2026-02-17T09:00:00.000Z",
      windowEnd: "2026-02-17T15:00:00.000Z",
      durationMinutes: 30,
      bufferMinutes: 0,
      courtsCount: 5,
      categories: [
        {
          categoryId: 1,
          teams: 14,
          format: "NON_STOP",
          nonStopMode: "HARD_CAP_WAITLIST",
          nonStopRounds: 6,
        },
      ],
    });
    const hardCapCategory = hardCapPlan.categories[0]!;
    expect(hardCapCategory.hardCapMax).toBe(10);
    expect(hardCapCategory.nonStopMode).toBe("HARD_CAP_WAITLIST");
    expect(hardCapCategory.recommendedMax).toBe(10);

    const activeQueuePlan = computePadelPlan({
      format: "NON_STOP",
      windowStart: "2026-02-17T09:00:00.000Z",
      windowEnd: "2026-02-17T15:00:00.000Z",
      durationMinutes: 30,
      bufferMinutes: 0,
      courtsCount: 5,
      categories: [
        {
          categoryId: 1,
          teams: 14,
          format: "NON_STOP",
          nonStopMode: "ACTIVE_QUEUE",
          nonStopRounds: 6,
        },
      ],
    });
    const activeQueueCategory = activeQueuePlan.categories[0]!;
    expect(activeQueueCategory.hardCapMax).toBeNull();
    expect(activeQueueCategory.queueEstimatedRounds).toBeGreaterThan(0);
    expect(activeQueueCategory.nonStopMode).toBe("ACTIVE_QUEUE");
  });
});
