import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readLocal(pathname: string) {
  return readFileSync(resolve(process.cwd(), pathname), "utf8");
}

describe("analytics/finance boundary guardrails", () => {
  it("finance UI does not call analytics endpoints", () => {
    const financeClient = readLocal("app/org/[orgId]/finance/FinanceToolClient.tsx");
    expect(financeClient).not.toMatch(/\/analytics\//);
  });

  it("analytics UI does not call finance mutating endpoints", () => {
    const analyticsClient = readLocal("app/org/[orgId]/analytics/AnalyticsToolClient.tsx");
    expect(analyticsClient).not.toMatch(/\/finance\//);
  });

  it("dashboard no longer couples analytics access to finance role flag", () => {
    const dashboardClient = readLocal("app/org/_internal/core/DashboardClient.tsx");
    expect(dashboardClient).not.toContain("roleFlags.canViewFinance && canAccessAnalytics");
    expect(dashboardClient).toContain("const canViewAnalytics = canAccessAnalytics;");
  });
});
