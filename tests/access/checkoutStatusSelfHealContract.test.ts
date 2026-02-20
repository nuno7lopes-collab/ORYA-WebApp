import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const routePath = resolve(process.cwd(), "app/api/checkout/status/route.ts");

describe("checkout status self-heal contract", () => {
  it("tenta reconciliação quando Stripe já está em PAID mas SSOT ainda não convergiu", () => {
    const file = readFileSync(routePath, "utf8");
    expect(file).toContain("performPaymentFulfillment");
    expect(file).toContain("maybeHealPaidIntent");
    expect(file).toContain("checkout.status.heal_paid_intent_failed");
    expect(file).toContain("status: PaymentStatus.SUCCEEDED");
    expect(file).toContain('status: "OK"');
  });
});
