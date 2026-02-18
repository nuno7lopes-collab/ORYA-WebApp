import { describe, expect, it } from "vitest";
import { buildScopeKey, resolveScopeData, type ScopedOverride, type ScopedTemplate } from "@/lib/reservas/scopedAvailability";

describe("scoped availability resolution", () => {
  it("falls back to organization templates when scope has no template rows", () => {
    const orgTemplates: ScopedTemplate[] = [
      { scopeType: "ORGANIZATION", scopeId: 0, dayOfWeek: 1, intervals: [{ startMinute: 9 * 60, endMinute: 17 * 60 }] },
    ];
    const orgOverrides: ScopedOverride[] = [];

    const resolved = resolveScopeData({
      scopeType: "PROFESSIONAL",
      scopeId: 7,
      orgTemplates,
      orgOverrides,
      templatesByScope: new Map(),
      overridesByScope: new Map(),
    });

    expect(resolved.hasCustomTemplates).toBe(false);
    expect(resolved.templates).toEqual(orgTemplates);
    expect(resolved.overrides).toEqual(orgOverrides);
  });

  it("treats empty scoped templates as explicit custom configuration", () => {
    const orgTemplates: ScopedTemplate[] = [
      { scopeType: "ORGANIZATION", scopeId: 0, dayOfWeek: 1, intervals: [{ startMinute: 9 * 60, endMinute: 17 * 60 }] },
    ];
    const orgOverrides: ScopedOverride[] = [];
    const scopedTemplates: ScopedTemplate[] = [
      { scopeType: "PROFESSIONAL", scopeId: 7, dayOfWeek: 1, intervals: [] },
    ];
    const scopedOverrides: ScopedOverride[] = [
      {
        scopeType: "PROFESSIONAL",
        scopeId: 7,
        date: new Date("2026-06-15T00:00:00.000Z"),
        kind: "CLOSED",
        intervals: [],
      },
    ];

    const resolved = resolveScopeData({
      scopeType: "PROFESSIONAL",
      scopeId: 7,
      orgTemplates,
      orgOverrides,
      templatesByScope: new Map([[buildScopeKey("PROFESSIONAL", 7), scopedTemplates]]),
      overridesByScope: new Map([[buildScopeKey("PROFESSIONAL", 7), scopedOverrides]]),
    });

    expect(resolved.hasCustomTemplates).toBe(true);
    expect(resolved.templates).toEqual(scopedTemplates);
    expect(resolved.overrides).toEqual(scopedOverrides);
  });
});
