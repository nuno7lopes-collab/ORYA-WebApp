import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readLocal(pathname: string) {
  return readFileSync(resolve(process.cwd(), pathname), "utf8");
}

describe("tool clients topbar-only navigation", () => {
  it("analytics client has no internal duplicated subnavigation", () => {
    const content = readLocal("app/org/[orgId]/analytics/AnalyticsToolClient.tsx");
    expect(content).not.toContain("Links rápidos");
    expect(content).not.toMatch(/viewKey:\s*\"/);
  });

  it("finance client has no internal duplicated subnavigation", () => {
    const content = readLocal("app/org/[orgId]/finance/FinanceToolClient.tsx");
    expect(content).not.toContain("Links rápidos");
    expect(content).not.toMatch(/viewKey:\s*\"/);
  });

  it("policies client has no internal duplicated subnavigation", () => {
    const content = readLocal("app/org/[orgId]/policies/PoliciesToolClient.tsx");
    expect(content).not.toContain("Links rápidos");
    expect(content).not.toMatch(/viewKey:\s*\"/);
    expect(content).not.toContain("ToolSubnavShell");
  });
});
