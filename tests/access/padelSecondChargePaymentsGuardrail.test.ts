import { describe, expect, it } from "vitest";

describe("padel second charge guardrail", () => {
  it("nao força Connect quando orgType=PLATFORM", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const file = readFileSync(resolve(process.cwd(), "domain/padelSecondCharge.ts"), "utf8");
    expect(file).not.toContain("requireStripe: true");
    expect(file).toContain("requiresOrganizationStripeForEvent");
  });
});
