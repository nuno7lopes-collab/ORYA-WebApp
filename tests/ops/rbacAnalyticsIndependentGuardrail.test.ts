import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readLocal(pathname: string) {
  return readFileSync(resolve(process.cwd(), pathname), "utf8");
}

describe("rbac analytics independent guardrails", () => {
  it("analytics API routes require ANALYTICS module and not FINANCEIRO", () => {
    const routes = [
      "app/api/org/[orgId]/analytics/overview/route.ts",
      "app/api/org/[orgId]/analytics/time-series/route.ts",
      "app/api/org/[orgId]/analytics/buyers/route.ts",
      "app/api/org/[orgId]/analytics/events/route.ts",
      "app/api/org/[orgId]/analytics/dimensoes/route.ts",
      "app/api/org/[orgId]/analytics/conversion/route.ts",
      "app/api/org/[orgId]/analytics/cohorts/route.ts",
    ];

    for (const route of routes) {
      const content = readLocal(route);
      expect(content).toContain("OrganizationModule.ANALYTICS");
      expect(content).not.toContain("OrganizationModule.FINANCEIRO");
    }
  });

  it("dashboard analytics access is independent from finance role gate", () => {
    const dashboardClient = readLocal("app/org/_internal/core/DashboardClient.tsx");
    expect(dashboardClient).toContain("const canViewAnalytics = canAccessAnalytics;");
    expect(dashboardClient).toContain("const canUseAnalytics = canViewAnalytics;");
  });
});
