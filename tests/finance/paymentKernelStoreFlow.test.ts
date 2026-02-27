import { describe, expect, it } from "vitest";
import { SourceType } from "@prisma/client";
import {
  PaymentSubject,
  buildPaymentFulfillmentDedupeKey,
  buildPaymentSubjectIdempotencyKey,
  resolvePaymentSubjectFromSourceType,
  resolveSourceTypeFromPaymentSubject,
} from "@/lib/payments/kernel";

describe("payment kernel - flow STORE_ORDER", () => {
  it("mapeia STORE_ORDER para SourceType.STORE_ORDER", () => {
    expect(resolveSourceTypeFromPaymentSubject(PaymentSubject.STORE_ORDER)).toBe(
      SourceType.STORE_ORDER,
    );
    expect(resolvePaymentSubjectFromSourceType(SourceType.STORE_ORDER)).toBe(
      PaymentSubject.STORE_ORDER,
    );
  });

  it("gera idempotency key determinística para STORE_ORDER", () => {
    const first = buildPaymentSubjectIdempotencyKey({
      subject: PaymentSubject.STORE_ORDER,
      purchaseId: "store_order_123",
    });
    const second = buildPaymentSubjectIdempotencyKey({
      subject: PaymentSubject.STORE_ORDER,
      purchaseId: "store_order_123",
    });
    expect(first).toBe(second);
    expect(first).toContain("STORE_ORDER");
  });

  it("gera dedupe key estável para fulfillment de STORE_ORDER", () => {
    const dedupe = buildPaymentFulfillmentDedupeKey({
      sourceType: SourceType.STORE_ORDER,
      sourceId: "555",
      purchaseId: "store_order_123",
      paymentIntentId: "pi_store_123",
    });
    expect(dedupe).toBe("fulfill:STORE_ORDER:555");
  });
});
