import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readLocal(pathname: string) {
  return readFileSync(resolve(process.cwd(), pathname), "utf8");
}

describe("policies legacy redirect", () => {
  it("redirects bookings policies legacy route to canonical policies tool", () => {
    const file = readLocal("app/org/[orgId]/bookings/policies/page.tsx");
    expect(file).toContain('redirect(buildOrgHref(orgId, "/policies", { view: "booking" }))');
  });
});
