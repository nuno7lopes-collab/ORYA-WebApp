import { describe, expect, it } from "vitest";
import { SourceType } from "@prisma/client";
import {
  PaymentSubject,
  buildPaymentFulfillmentDedupeKey,
  buildPaymentSubjectIdempotencyKey,
  resolvePaymentSubjectFromSourceType,
  resolveSourceTypeFromPaymentSubject,
} from "@/lib/payments/kernel";

describe("payment kernel - flow EVENT_TICKET", () => {
  it("mapeia EVENT_TICKET para SourceType.TICKET_ORDER", () => {
    expect(resolveSourceTypeFromPaymentSubject(PaymentSubject.EVENT_TICKET)).toBe(
      SourceType.TICKET_ORDER,
    );
    expect(resolvePaymentSubjectFromSourceType(SourceType.TICKET_ORDER)).toBe(
      PaymentSubject.EVENT_TICKET,
    );
  });

  it("gera idempotency key determinística para EVENT_TICKET", () => {
    const first = buildPaymentSubjectIdempotencyKey({
      subject: PaymentSubject.EVENT_TICKET,
      purchaseId: "pur_event_123",
    });
    const second = buildPaymentSubjectIdempotencyKey({
      subject: PaymentSubject.EVENT_TICKET,
      purchaseId: "pur_event_123",
    });
    expect(first).toBe(second);
    expect(first).toContain("TICKET_ORDER");
  });

  it("gera idempotency key canónica para rollout do kernel", () => {
    const first = buildPaymentSubjectIdempotencyKey({
      orgId: 22,
      subjectType: PaymentSubject.EVENT_TICKET,
      subjectId: "pur_event_123",
      amount: 1200,
      currency: "eur",
      extra: {
        totalQuantity: 2,
        scenario: "SINGLE",
      },
    });
    const second = buildPaymentSubjectIdempotencyKey({
      orgId: 22,
      subjectType: PaymentSubject.EVENT_TICKET,
      subjectId: "pur_event_123",
      amount: 1200,
      currency: "EUR",
      extra: {
        scenario: "SINGLE",
        totalQuantity: 2,
      },
    });
    expect(first).toBe(second);
    expect(first).toContain("checkout:pk:EVENT_TICKET:pur_event_123:");
  });

  it("gera dedupe key estável para fulfillment de EVENT_TICKET", () => {
    const dedupe = buildPaymentFulfillmentDedupeKey({
      sourceType: SourceType.TICKET_ORDER,
      sourceId: "42",
      purchaseId: "pur_event_123",
      paymentIntentId: "pi_event_123",
    });
    expect(dedupe).toBe("fulfill:TICKET_ORDER:42");
  });
});
