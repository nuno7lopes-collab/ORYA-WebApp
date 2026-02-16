import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readLocal(pathname: string) {
  return readFileSync(resolve(process.cwd(), pathname), "utf8");
}

describe("analytics subnav canonical", () => {
  it("uses only canonical view=* navigation", () => {
    const file = readLocal("app/org/_components/subnav/AnalyticsSubnav.tsx");
    expect(file).toContain('buildOrgHref(orgId, "/analytics", { view: "overview" })');
    expect(file).toContain('buildOrgHref(orgId, "/analytics", { view: "conversion" })');
    expect(file).toContain('buildOrgHref(orgId, "/analytics", { view: "cohorts" })');
    expect(file).toContain('buildOrgHref(orgId, "/analytics", { view: "buyers" })');
    expect(file).toContain('buildOrgHref(orgId, "/analytics", { view: "time-series" })');
    expect(file).toContain('buildOrgHref(orgId, "/analytics", { view: "dimensions" })');
    expect(file).not.toMatch(/tab=|section=|analytics=|finance=/);
  });
});
