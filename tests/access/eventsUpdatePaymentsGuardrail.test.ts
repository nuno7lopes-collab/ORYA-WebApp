import { describe, expect, it } from "vitest";

describe("events update payments guardrail", () => {
  it("usa orgType como fonte de verdade para requireStripe", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const file = readFileSync(resolve(process.cwd(), "app/api/org/[orgId]/events/update/route.ts"), "utf8");
    expect(file).toContain("const requiresStripeForPaidSales = requiresOrganizationStripe(organization?.orgType);");
    expect(file).not.toContain("event.payoutMode === PayoutMode.PLATFORM ? false");
  });
});
