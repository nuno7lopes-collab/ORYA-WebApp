import { describe, expect, it } from "vitest";
import { evaluateJourneyCondition, resolveQuietHoursDeferral } from "@/lib/crm/journeyRuntime";

describe("crm journey runtime helpers", () => {
  it("diferia execução quando cai em quiet hours", () => {
    const now = new Date("2026-03-01T22:15:00.000Z");
    const deferred = resolveQuietHoursDeferral({
      now,
      timezone: "UTC",
      startMinute: 20 * 60,
      endMinute: 10 * 60,
    });

    expect(deferred).not.toBeNull();
    expect(deferred?.toISOString()).toBe("2026-03-02T10:00:00.000Z");
  });

  it("não adia fora de quiet hours", () => {
    const now = new Date("2026-03-01T15:00:00.000Z");
    const deferred = resolveQuietHoursDeferral({
      now,
      timezone: "UTC",
      startMinute: 20 * 60,
      endMinute: 10 * 60,
    });
    expect(deferred).toBeNull();
  });

  it("avalia condição de recência em dias", () => {
    const now = new Date("2026-03-01T12:00:00.000Z");
    const condition = evaluateJourneyCondition({
      field: "lastActivityAt",
      op: "gte",
      value: "30d",
      snapshot: {
        lastActivityAt: new Date("2026-02-20T12:00:00.000Z"),
        totalSpentCents: 0,
        marketingOptIn: true,
        contactType: "CUSTOMER",
        tags: [],
        churnRiskScore: 10,
        reactivationPropensityScore: 20,
        padelActivityStatus: "ACTIVE",
      },
      now,
    });

    expect(condition.matched).toBe(true);
  });

  it("avalia tags com operador not_in", () => {
    const result = evaluateJourneyCondition({
      field: "tag",
      op: "not_in",
      value: "vip,premium",
      snapshot: {
        lastActivityAt: null,
        totalSpentCents: 1000,
        marketingOptIn: false,
        contactType: "LEAD",
        tags: ["trial"],
        churnRiskScore: null,
        reactivationPropensityScore: null,
        padelActivityStatus: null,
      },
    });

    expect(result.matched).toBe(true);
  });
});
