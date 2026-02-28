import { describe, expect, it } from "vitest";
import { SourceType } from "@prisma/client";
import {
  PaymentSubject,
  buildPaymentFulfillmentDedupeKey,
  buildPaymentSubjectIdempotencyKey,
  resolvePaymentSubjectFromSourceType,
  resolveSourceTypeFromPaymentSubject,
} from "@/lib/payments/kernel";

describe("payment kernel - flow BOOKING", () => {
  it("mapeia BOOKING para SourceType.BOOKING", () => {
    expect(resolveSourceTypeFromPaymentSubject(PaymentSubject.BOOKING)).toBe(SourceType.BOOKING);
    expect(resolvePaymentSubjectFromSourceType(SourceType.BOOKING)).toBe(PaymentSubject.BOOKING);
  });

  it("gera idempotency key determinística para BOOKING", () => {
    const first = buildPaymentSubjectIdempotencyKey({
      subject: PaymentSubject.BOOKING,
      purchaseId: "booking_321_v1",
    });
    const second = buildPaymentSubjectIdempotencyKey({
      subject: PaymentSubject.BOOKING,
      purchaseId: "booking_321_v1",
    });
    expect(first).toBe(second);
    expect(first).toContain("BOOKING");
  });

  it("gera idempotency key canónica para BOOKING", () => {
    const first = buildPaymentSubjectIdempotencyKey({
      orgId: 77,
      subjectType: PaymentSubject.BOOKING,
      subjectId: "booking_321_v1",
      amount: 5600,
      currency: "eur",
      extra: {
        bookingId: 321,
        serviceId: 88,
        paymentMethod: "card",
      },
    });
    const second = buildPaymentSubjectIdempotencyKey({
      orgId: 77,
      subjectType: PaymentSubject.BOOKING,
      subjectId: "booking_321_v1",
      amount: 5600,
      currency: "EUR",
      extra: {
        paymentMethod: "card",
        serviceId: 88,
        bookingId: 321,
      },
    });

    expect(first).toBe(second);
    expect(first).toContain("checkout:pk:BOOKING:booking_321_v1:");
  });

  it("gera dedupe key estável para fulfillment de BOOKING", () => {
    const dedupe = buildPaymentFulfillmentDedupeKey({
      sourceType: SourceType.BOOKING,
      sourceId: "321",
      purchaseId: "booking_321_v1",
      paymentIntentId: "pi_booking_321",
    });
    expect(dedupe).toBe("fulfill:BOOKING:321");
  });
});
