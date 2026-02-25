import { describe, expect, it } from "vitest";
import { evaluatePaidWriteGate } from "@/lib/organizationPayments";

describe("evaluatePaidWriteGate", () => {
  it("permite escrita gratuita sem email/stripe", () => {
    const result = evaluatePaidWriteGate({
      organizationId: 12,
      orgType: "EXTERNAL",
      officialEmail: null,
      officialEmailVerifiedAt: null,
      stripeAccountId: null,
      stripeChargesEnabled: false,
      stripePayoutsEnabled: false,
      amountCents: 0,
    });
    expect(result.ok).toBe(true);
  });

  it("bloqueia EXTERNAL sem stripe em escrita paga", () => {
    const result = evaluatePaidWriteGate({
      organizationId: 12,
      orgType: "EXTERNAL",
      officialEmail: "finance@org.pt",
      officialEmailVerifiedAt: new Date("2026-01-01T00:00:00.000Z"),
      stripeAccountId: null,
      stripeChargesEnabled: false,
      stripePayoutsEnabled: false,
      amountCents: 2500,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errorCode).toBe("PAYMENTS_NOT_READY");
    expect(result.details.missingEmail).toBe(false);
    expect(result.details.missingStripe).toBe(true);
    expect(result.details.ctaHref).toBe("/org/12/finance?view=payouts");
  });

  it("permite PLATFORM sem stripe em escrita paga com email verificado", () => {
    const result = evaluatePaidWriteGate({
      organizationId: 33,
      orgType: "PLATFORM",
      officialEmail: "platform@orya.pt",
      officialEmailVerifiedAt: new Date("2026-01-01T00:00:00.000Z"),
      stripeAccountId: null,
      stripeChargesEnabled: false,
      stripePayoutsEnabled: false,
      amountCents: 4900,
    });

    expect(result.ok).toBe(true);
  });

  it("bloqueia escrita paga sem email oficial", () => {
    const result = evaluatePaidWriteGate({
      organizationId: 44,
      orgType: "PLATFORM",
      officialEmail: null,
      officialEmailVerifiedAt: null,
      stripeAccountId: null,
      stripeChargesEnabled: false,
      stripePayoutsEnabled: false,
      amountCents: 990,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.details.missingEmail).toBe(true);
    expect(result.details.missingStripe).toBe(false);
    expect(result.details.ctaHref).toBe("/org/44/finance?view=payouts");
  });
});
