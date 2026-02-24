import { describe, expect, it } from "vitest";

describe("payouts connect guardrails", () => {
  it("usa Stripe Connect Standard e não Express", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const file = readFileSync(
      resolve(process.cwd(), "app/api/org/[orgId]/finance/payouts/connect/route.ts"),
      "utf8",
    );
    expect(file).toContain('type: "standard"');
    expect(file).not.toContain('type: "express"');
  });
});
