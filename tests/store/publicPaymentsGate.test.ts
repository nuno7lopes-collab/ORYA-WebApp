import { describe, expect, it } from "vitest";
import { getPublicStorePaymentsGate } from "@/lib/store/publicPaymentsGate";

describe("public store payments gate", () => {
  it("blocks EXTERNAL organization without stripe", () => {
    const gate = getPublicStorePaymentsGate({
      orgType: "EXTERNAL",
      officialEmail: "team@example.com",
      officialEmailVerifiedAt: new Date("2026-01-01T00:00:00.000Z"),
      stripeAccountId: null,
      stripeChargesEnabled: false,
      stripePayoutsEnabled: false,
    });
    expect(gate.ok).toBe(false);
    expect(gate.missingStripe).toBe(true);
  });

  it("allows PLATFORM organization without stripe when email is verified", () => {
    const gate = getPublicStorePaymentsGate({
      orgType: "PLATFORM",
      officialEmail: "platform@example.com",
      officialEmailVerifiedAt: new Date("2026-01-01T00:00:00.000Z"),
      stripeAccountId: null,
      stripeChargesEnabled: false,
      stripePayoutsEnabled: false,
    });
    expect(gate.ok).toBe(true);
    expect(gate.requireStripe).toBe(false);
  });
});
