import { describe, expect, it } from "vitest";
import { buildScopeKey, resolveScopeData, type ScopedOverride, type ScopedSchedule } from "@/lib/reservas/scopedAvailability";

describe("scoped availability resolution", () => {
  it("falls back to organization schedules when scope has no active schedules", () => {
    const orgSchedules: ScopedSchedule[] = [
      { id: 1, scopeType: "ORGANIZATION", scopeId: 0, startDate: new Date("2026-02-18T00:00:00.000Z"), endDate: null },
    ];
    const orgOverrides: ScopedOverride[] = [
      { scopeType: "ORGANIZATION", scopeId: 0, date: new Date("2026-02-18T00:00:00.000Z"), kind: "OPEN", intervals: [] },
    ];

    const resolved = resolveScopeData({
      scopeType: "PROFESSIONAL",
      scopeId: 7,
      orgSchedules,
      orgOverrides,
      schedulesByScope: new Map(),
      overridesByScope: new Map([[buildScopeKey("ORGANIZATION", 0), orgOverrides]]),
    });

    expect(resolved.schedules).toEqual([]);
    expect(resolved.fallbackSchedules).toEqual(orgSchedules);
    expect(resolved.overrides).toEqual(orgOverrides);
  });

  it("merges organization and scoped overrides", () => {
    const orgSchedules: ScopedSchedule[] = [
      { id: 1, scopeType: "ORGANIZATION", scopeId: 0, startDate: new Date("2026-02-18T00:00:00.000Z"), endDate: null },
    ];
    const orgOverrides: ScopedOverride[] = [
      { scopeType: "ORGANIZATION", scopeId: 0, date: new Date("2026-02-18T00:00:00.000Z"), kind: "OPEN", intervals: [] },
    ];
    const scopedOverrides: ScopedOverride[] = [
      { scopeType: "PROFESSIONAL", scopeId: 7, date: new Date("2026-02-18T00:00:00.000Z"), kind: "BLOCK", intervals: [] },
    ];

    const resolved = resolveScopeData({
      scopeType: "PROFESSIONAL",
      scopeId: 7,
      orgSchedules,
      orgOverrides,
      schedulesByScope: new Map([[buildScopeKey("PROFESSIONAL", 7), [
        { id: 2, scopeType: "PROFESSIONAL", scopeId: 7, startDate: new Date("2026-03-01T00:00:00.000Z"), endDate: null },
      ]]]),
      overridesByScope: new Map([
        [buildScopeKey("ORGANIZATION", 0), orgOverrides],
        [buildScopeKey("PROFESSIONAL", 7), scopedOverrides],
      ]),
    });

    expect(resolved.overrides).toEqual([...orgOverrides, ...scopedOverrides]);
  });
});
