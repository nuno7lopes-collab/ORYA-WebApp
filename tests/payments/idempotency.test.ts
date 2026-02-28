import { describe, expect, it } from "vitest";
import { buildPaymentSubjectIdempotencyKey } from "@/lib/payments/idempotency";
import { PaymentSubject } from "@/lib/payments/types";

describe("payments idempotency key", () => {
  it("gera chave determinística para payload canónico", () => {
    const first = buildPaymentSubjectIdempotencyKey({
      orgId: 12,
      subjectType: "store_order",
      subjectId: "order_123",
      amount: 1999,
      currency: "eur",
      extra: {
        resourceIds: ["r2", "r1", "r3"],
        metadata: { b: "2", a: "1" },
      },
    });

    const second = buildPaymentSubjectIdempotencyKey({
      orgId: 12,
      subjectType: "STORE_ORDER",
      subjectId: "order_123",
      amount: 1999,
      currency: "EUR",
      extra: {
        metadata: { a: "1", b: "2" },
        resourceIds: ["r3", "r1", "r2"],
      },
    });

    expect(first).toBe(second);
    expect(first.startsWith("checkout:pk:STORE_ORDER:order_123:")).toBe(true);
  });

  it("muda a chave quando campos de contrato mudam", () => {
    const base = buildPaymentSubjectIdempotencyKey({
      orgId: 12,
      subjectType: "BOOKING",
      subjectId: "booking_1",
      amount: 4000,
      currency: "EUR",
    });
    const changedAmount = buildPaymentSubjectIdempotencyKey({
      orgId: 12,
      subjectType: "BOOKING",
      subjectId: "booking_1",
      amount: 4500,
      currency: "EUR",
    });
    const changedVersion = buildPaymentSubjectIdempotencyKey({
      orgId: 12,
      subjectType: "BOOKING",
      subjectId: "booking_1",
      amount: 4000,
      currency: "EUR",
      version: "v2",
    });

    expect(base).not.toBe(changedAmount);
    expect(base).not.toBe(changedVersion);
  });

  it("mantém compatibilidade com assinatura legacy", () => {
    const key = buildPaymentSubjectIdempotencyKey({
      subject: PaymentSubject.EVENT_TICKET,
      purchaseId: "purchase_abc",
    });
    expect(key).toBe("checkout:TICKET_ORDER:purchase_abc");
  });
});
