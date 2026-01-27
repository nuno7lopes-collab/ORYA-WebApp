import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/platformSettings", () => ({
  getPlatformFees: vi.fn(async () => ({ feeBps: 800, feeFixedCents: 30 })),
  getStripeBaseFees: vi.fn(async () => ({ feeBps: 140, feeFixedCents: 25, region: "UE" })),
}));

import {
  BOOKING_CONFIRMATION_SNAPSHOT_VERSION,
  buildBookingConfirmationSnapshot,
} from "@/lib/reservas/confirmationSnapshot";

const basePolicy = {
  id: 5,
  policyType: "MODERATE",
  cancellationWindowMinutes: 2880,
  guestBookingAllowed: false,
  allowPayAtVenue: false,
  depositRequired: false,
  depositAmountCents: 0,
  noShowFeeCents: 0,
};

describe("booking confirmation snapshot", () => {
  it("persists a policy and pricing snapshot at confirm time", async () => {
    const tx = {
      organizationPolicy: {
        findFirst: vi.fn(async () => basePolicy),
      },
    } as any;

    const booking = {
      id: 10,
      organizationId: 20,
      price: 10_000,
      currency: "eur",
      policyRef: { policyId: 5 },
      service: {
        policyId: 5,
        unitPriceCents: 10_000,
        currency: "eur",
        organization: {
          feeMode: "ADDED",
          platformFeeBps: 800,
          platformFeeFixedCents: 30,
          orgType: "CLUB",
        },
      },
    } as any;

    const result = await buildBookingConfirmationSnapshot({
      tx,
      booking,
      now: new Date("2026-01-27T12:00:00.000Z"),
      paymentMeta: { grossAmountCents: 11_000, cardPlatformFeeCents: 0, stripeFeeEstimateCents: 154 },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.policyId).toBe(5);
    expect(result.snapshot.version).toBe(BOOKING_CONFIRMATION_SNAPSHOT_VERSION);
    expect(result.snapshot.createdAt).toBe("2026-01-27T12:00:00.000Z");
    expect(result.snapshot.currency).toBe("EUR");
    expect(result.snapshot.policySnapshot.policyId).toBe(5);
    expect(result.snapshot.pricingSnapshot.baseCents).toBe(10_000);
    expect(result.snapshot.pricingSnapshot.totalCents).toBe(11_000);
    expect(result.snapshot.pricingSnapshot.feeCents).toBe(1_000);
  });

  it("keeps feeCents at zero when fees are included in the base price", async () => {
    const tx = {
      organizationPolicy: {
        findFirst: vi.fn(async () => basePolicy),
      },
    } as any;

    const booking = {
      id: 11,
      organizationId: 21,
      price: 5_000,
      currency: "EUR",
      policyRef: null,
      service: {
        policyId: null,
        unitPriceCents: 5_000,
        currency: "EUR",
        organization: {
          feeMode: "INCLUDED",
          platformFeeBps: 600,
          platformFeeFixedCents: 20,
          orgType: "CLUB",
        },
      },
    } as any;

    const result = await buildBookingConfirmationSnapshot({
      tx,
      booking,
      now: new Date("2026-01-27T13:00:00.000Z"),
      paymentMeta: null,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.snapshot.pricingSnapshot.feeMode).toBe("INCLUDED");
    expect(result.snapshot.pricingSnapshot.totalCents).toBe(5_000);
    expect(result.snapshot.pricingSnapshot.feeCents).toBe(0);
  });
});

