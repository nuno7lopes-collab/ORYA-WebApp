import { describe, expect, it } from "vitest";
import { EventTemplateType } from "@prisma/client";
import {
  normalizeAnalyticsOverviewRange,
  parseEventTemplateType,
  resolveAnalyticsOverviewRangeBounds,
} from "@/domain/analytics/organizationOverviewMetrics";

describe("organizationOverviewMetrics", () => {
  it("normaliza range inválido para 30d", () => {
    expect(normalizeAnalyticsOverviewRange("7d")).toBe("7d");
    expect(normalizeAnalyticsOverviewRange("30d")).toBe("30d");
    expect(normalizeAnalyticsOverviewRange("all")).toBe("all");
    expect(normalizeAnalyticsOverviewRange("invalid")).toBe("30d");
    expect(normalizeAnalyticsOverviewRange(null)).toBe("30d");
  });

  it("resolve janelas temporais por range", () => {
    const now = new Date("2026-03-04T12:00:00.000Z");
    const sevenDays = resolveAnalyticsOverviewRangeBounds("7d", now);
    const thirtyDays = resolveAnalyticsOverviewRangeBounds("30d", now);
    const all = resolveAnalyticsOverviewRangeBounds("all", now);

    expect(sevenDays.from?.toISOString()).toBe("2026-02-25T12:00:00.000Z");
    expect(sevenDays.to?.toISOString()).toBe(now.toISOString());
    expect(thirtyDays.from?.toISOString()).toBe("2026-02-02T12:00:00.000Z");
    expect(thirtyDays.to?.toISOString()).toBe(now.toISOString());
    expect(all.from).toBeNull();
    expect(all.to).toBeNull();
  });

  it("parse de template type é case-insensitive e seguro", () => {
    expect(parseEventTemplateType("padel")).toBe(EventTemplateType.PADEL);
    expect(parseEventTemplateType(" PADEL ")).toBe(EventTemplateType.PADEL);
    expect(parseEventTemplateType("desconhecido")).toBeNull();
    expect(parseEventTemplateType(null)).toBeNull();
  });
});
