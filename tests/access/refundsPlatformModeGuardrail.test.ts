import { describe, expect, it } from "vitest";

describe("refund guardrails", () => {
  it("refundPurchase respeita orgType para decidir Connect", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const file = readFileSync(resolve(process.cwd(), "lib/refunds/unifiedRefund.ts"), "utf8");
    expect(file).toContain("requiresOrganizationStripe(org.orgType)");
    expect(file).not.toContain("requireStripe: true");
  });

  it("booking refund respeita orgType para decidir Connect", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const file = readFileSync(resolve(process.cwd(), "lib/refunds/unifiedRefund.ts"), "utf8");
    expect(file).toContain("requiresOrganizationStripe(org.orgType)");
    expect(file).not.toContain("requireStripe: true");
  });
});
