import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readLocal(pathname: string) {
  return readFileSync(resolve(process.cwd(), pathname), "utf8");
}

describe("finance subnav canonical", () => {
  it("uses only canonical view=* navigation", () => {
    const file = readLocal("app/org/_components/subnav/FinanceSubnav.tsx");
    expect(file).toContain('buildOrgHref(orgId, "/finance", { view: "overview" })');
    expect(file).toContain('buildOrgHref(orgId, "/finance", { view: "invoicing" })');
    expect(file).toContain('buildOrgHref(orgId, "/finance", { view: "payouts" })');
    expect(file).toContain('buildOrgHref(orgId, "/finance", { view: "refunds-disputes" })');
    expect(file).toContain('buildOrgHref(orgId, "/finance", { view: "reconciliation" })');
    expect(file).toContain('buildOrgHref(orgId, "/finance", { view: "ledger" })');
    expect(file).toContain('buildOrgHref(orgId, "/finance", { view: "exports" })');
    expect(file).toContain('buildOrgHref(orgId, "/finance", { view: "ops" })');
    expect(file).not.toMatch(/tab=|section=|analytics=|finance=/);
  });
});
