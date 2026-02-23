import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function readLocal(pathname: string) {
  return readFileSync(resolve(process.cwd(), pathname), "utf8");
}

describe("finance payouts namespace", () => {
  it("keeps canonical payouts routes under /finance/payouts/*", () => {
    const canonicalRoutes = [
      "app/api/org/[orgId]/finance/payouts/status/route.ts",
      "app/api/org/[orgId]/finance/payouts/list/route.ts",
      "app/api/org/[orgId]/finance/payouts/summary/route.ts",
      "app/api/org/[orgId]/finance/payouts/connect/route.ts",
      "app/api/org/[orgId]/finance/payouts/settings/route.ts",
    ];

    for (const route of canonicalRoutes) {
      const content = readLocal(route);
      expect(content).toContain("withApiEnvelope");
      expect(content).toContain("export const");
    }
  });

  it("removes legacy /payouts/* routes from runtime", () => {
    const legacyRoutes = [
      "app/api/org/[orgId]/payouts/status/route.ts",
      "app/api/org/[orgId]/payouts/list/route.ts",
      "app/api/org/[orgId]/payouts/summary/route.ts",
      "app/api/org/[orgId]/payouts/connect/route.ts",
      "app/api/org/[orgId]/payouts/settings/route.ts",
    ];

    for (const route of legacyRoutes) {
      expect(existsSync(resolve(process.cwd(), route))).toBe(false);
    }
  });
});
