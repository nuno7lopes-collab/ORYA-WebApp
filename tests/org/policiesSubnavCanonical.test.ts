import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readLocal(pathname: string) {
  return readFileSync(resolve(process.cwd(), pathname), "utf8");
}

describe("policies subnav canonical", () => {
  it("uses only canonical view=* navigation", () => {
    const file = readLocal("app/org/_components/subnav/PoliciesSubnav.tsx");
    expect(file).toContain('buildOrgHref(orgId, "/policies", { view: "overview" })');
    expect(file).toContain('buildOrgHref(orgId, "/policies", { view: "booking" })');
    expect(file).toContain('buildOrgHref(orgId, "/policies", { view: "terms" })');
    expect(file).toContain('buildOrgHref(orgId, "/policies", { view: "guardrails" })');
    expect(file).not.toMatch(/tab=|section=|analytics=|finance=/);
  });
});
