import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const load = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("mobile payments backend/frontend contract", () => {
  it("keeps backend payment readiness error codes stable", () => {
    const storeCheckout = load("app/api/public/store/checkout/route.ts");
    const storePrefill = load("app/api/public/store/checkout/prefill/route.ts");
    const serviceCheckout = load("app/api/servicos/[id]/checkout/route.ts");
    const eventCheckout = load("app/api/payments/intent/route.ts");

    expect(storeCheckout).toContain('fail("PAYMENTS_NOT_READY"');
    expect(storePrefill).toContain('errorCode: "PAYMENTS_NOT_READY"');
    expect(serviceCheckout).toContain('"PAYMENTS_NOT_READY"');
    expect(eventCheckout).toContain('"ORGANIZATION_PAYMENTS_NOT_READY"');
    expect(serviceCheckout).toContain('"INVALID_PAYMENT_METHOD"');
  });

  it("keeps mobile error mappers aligned with backend codes", () => {
    const mobileErrors = load("apps/mobile/lib/errors.ts");
    const storeErrors = load("apps/mobile/features/store/errors.ts");

    expect(mobileErrors).toContain("ORGANIZATION_PAYMENTS_NOT_READY");
    expect(mobileErrors).toContain("PAYMENTS_NOT_READY");
    expect(mobileErrors).toContain("PAYMENT_INTENT_TERMINAL");
    expect(mobileErrors).toContain("IDEMPOTENCY_KEY_PAYLOAD_MISMATCH");
    expect(storeErrors).toContain("PAYMENTS_NOT_READY");
    expect(storeErrors).toContain("CHECKOUT_UNAVAILABLE");
  });
});
