import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const routePath = resolve(process.cwd(), "app/api/payments/intent/route.ts");

describe("payments intent stripe destination error contract", () => {
  it("maps Stripe destination/account errors to stable business error code", () => {
    const file = readFileSync(routePath, "utf8");
    expect(file).toContain("isStripeDestinationConfigError");
    expect(file).toContain('"ORGANIZATION_STRIPE_NOT_CONNECTED"');
    expect(file).toContain('nextAction: "CONNECT_STRIPE"');
    expect(file).toContain("account_invalid");
    expect(file).toContain("does not have access to account");
  });
});
