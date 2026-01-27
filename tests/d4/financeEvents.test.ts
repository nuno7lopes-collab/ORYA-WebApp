import { describe, it, expect } from "vitest";
import { FINANCE_OUTBOX_EVENTS } from "@/domain/finance/events";

describe("D4 finance outbox events", () => {
  it("exposes the canonical event types", () => {
    expect(FINANCE_OUTBOX_EVENTS.PAYMENT_CREATED).toBe("payment.created");
    expect(FINANCE_OUTBOX_EVENTS.PAYMENT_STATUS_CHANGED).toBe("payment.status.changed");
    expect(FINANCE_OUTBOX_EVENTS.PAYMENT_FEES_RECONCILED).toBe("payment.fees.reconciled");
  });
});
