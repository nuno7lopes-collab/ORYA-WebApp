import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const filePath = resolve(process.cwd(), "app/api/stripe/webhook/route.ts");

describe("stripe webhook org resolution contract", () => {
  it("resolve orgId por stripeAccountId (event.account) quando metadata não traz orgId", () => {
    const file = readFileSync(filePath, "utf8");
    expect(file).toContain("event.account");
    expect(file).toContain("where: { stripeAccountId }");
    expect(file).toContain("organization?.id");
  });
});
