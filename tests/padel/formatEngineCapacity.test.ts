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
});
