import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const routePath = resolve(process.cwd(), "app/api/payments/intent/route.ts");

describe("payments intent runtime stripe contract", () => {
  it("expõe payload de runtime stripe em respostas de sucesso", () => {
    const file = readFileSync(routePath, "utf8");
    expect(file).toContain("resolveStripeRuntimePayloadForMode");
    expect(file).toContain("stripePublishableKey");
    expect(file).toContain("stripeMode");
    expect(file).toContain("...resolveStripeRuntimePayload(paymentIntent.livemode)");
  });
});
