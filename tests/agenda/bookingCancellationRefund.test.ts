import { describe, expect, it } from "vitest";
import { computeCancellationRefundFromSnapshot } from "@/lib/reservas/confirmationSnapshot";

describe("booking cancellation refund", () => {
  it("client cancel keeps fees + applies penalty", () => {
    const snapshot = {
      version: 2,
      createdAt: "2026-02-04T12:00:00.000Z",
      currency: "EUR",
      policySnapshot: {
        policyId: 1,
        policyType: "CUSTOM",
        allowCancellation: true,
        cancellationWindowMinutes: 2880,
        cancellationPenaltyBps: 1000, // 10%
        allowReschedule: true,
        rescheduleWindowMinutes: 2880,
        guestBookingAllowed: false,
        noShowFeeCents: 0,
      },
      pricingSnapshot: {
        baseCents: 10_000,
        discountCents: 0,
        feeCents: 1000,
        platformFeeCents: 830,
        combinedFeeCents: 830,
        processorFeesStatus: "PENDING",
        processorFeesActualCents: null,
        taxCents: 0,
        totalCents: 11_000,
        feeMode: "ADDED",
        platformFeeBps: 800,
        platformFeeFixedCents: 30,
        stripeFeeBps: 0,
        stripeFeeFixedCents: 0,
        cardPlatformFeeCents: 0,
        // orya(800) + fixo(30)
      },
    };

    const res = computeCancellationRefundFromSnapshot(snapshot, { actor: "CLIENT", stripeFeeCentsActual: 250 });
    expect(res?.rule).toBe("CLIENT_CANCEL_KEEP_FEES");
    expect(res?.totalCents).toBe(11_000);
    expect(res?.penaltyCents).toBe(1000);
    expect(res?.feesRetainedCents).toBe(1080);
    expect(res?.refundCents).toBe(8920);
  });

  it("org cancel is full refund", () => {
    const snapshot = {
      version: 2,
      createdAt: "2026-02-04T12:00:00.000Z",
      currency: "EUR",
      policySnapshot: {
        policyId: 1,
        policyType: "CUSTOM",
        allowCancellation: false,
        cancellationWindowMinutes: null,
        cancellationPenaltyBps: 10_000,
        allowReschedule: false,
        rescheduleWindowMinutes: null,
        guestBookingAllowed: false,
        noShowFeeCents: 0,
      },
      pricingSnapshot: {
        baseCents: 10_000,
        discountCents: 0,
        feeCents: 0,
        platformFeeCents: 830,
        combinedFeeCents: 830,
        processorFeesStatus: "PENDING",
        processorFeesActualCents: null,
        taxCents: 0,
        totalCents: 10_000,
        feeMode: "INCLUDED",
        platformFeeBps: 800,
        platformFeeFixedCents: 30,
        stripeFeeBps: 0,
        stripeFeeFixedCents: 0,
        cardPlatformFeeCents: 0,
      },
    };

    const res = computeCancellationRefundFromSnapshot(snapshot, { actor: "ORG" });
    expect(res?.rule).toBe("FULL_REFUND");
    expect(res?.refundCents).toBe(10_000);
    expect(res?.penaltyCents).toBe(0);
  });
});
