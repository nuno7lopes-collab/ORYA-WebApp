import { describe, expect, it } from "vitest";
import { SourceType } from "@prisma/client";
import {
  PaymentSubject,
  buildPaymentFulfillmentDedupeKey,
  buildPaymentSubjectIdempotencyKey,
  resolvePaymentSubjectFromSourceType,
  resolveSourceTypeFromPaymentSubject,
} from "@/lib/payments/kernel";

describe("payment kernel - flow PADEL_REGISTRATION", () => {
  it("mapeia PADEL_REGISTRATION para SourceType.PADEL_REGISTRATION", () => {
    expect(
      resolveSourceTypeFromPaymentSubject(PaymentSubject.PADEL_REGISTRATION),
    ).toBe(SourceType.PADEL_REGISTRATION);
    expect(resolvePaymentSubjectFromSourceType(SourceType.PADEL_REGISTRATION)).toBe(
      PaymentSubject.PADEL_REGISTRATION,
    );
  });

  it("gera idempotency key determinística para PADEL_REGISTRATION", () => {
    const first = buildPaymentSubjectIdempotencyKey({
      subject: PaymentSubject.PADEL_REGISTRATION,
      purchaseId: "padel:99:slot:1",
    });
    const second = buildPaymentSubjectIdempotencyKey({
      subject: PaymentSubject.PADEL_REGISTRATION,
      purchaseId: "padel:99:slot:1",
    });
    expect(first).toBe(second);
    expect(first).toContain("PADEL_REGISTRATION");
  });

  it("gera dedupe key estável para fulfillment de PADEL_REGISTRATION", () => {
    const dedupe = buildPaymentFulfillmentDedupeKey({
      sourceType: SourceType.PADEL_REGISTRATION,
      sourceId: "77",
      purchaseId: "padel:99:slot:1",
      paymentIntentId: "pi_padel_77",
    });
    expect(dedupe).toBe("fulfill:PADEL_REGISTRATION:77");
  });
});
