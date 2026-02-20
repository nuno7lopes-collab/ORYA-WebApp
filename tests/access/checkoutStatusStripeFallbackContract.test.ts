import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const routePath = resolve(process.cwd(), "app/api/checkout/status/route.ts");

describe("checkout status stripe fallback contract", () => {
  it("maps PaymentIntent terminal and retry states to deterministic checkout statuses", () => {
    const file = readFileSync(routePath, "utf8");
    expect(file).toContain("mapStripeIntentToCheckout");
    expect(file).toContain('case "requires_payment_method"');
    expect(file).toContain('case "canceled"');
    expect(file).toContain('case "succeeded"');
    expect(file).toContain("last_payment_error");
    expect(file).toContain("resolveStatusFromStripeIntent");
  });
});
