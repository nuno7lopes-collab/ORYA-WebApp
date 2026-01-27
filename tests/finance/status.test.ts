import { describe, expect, it } from "vitest";
import { LedgerEntryType, PaymentStatus } from "@prisma/client";
import { deriveCheckoutStatusFromPayment } from "@/domain/finance/status";

describe("deriveCheckoutStatusFromPayment", () => {
  it("uses ledger refunds as override", () => {
    const status = deriveCheckoutStatusFromPayment({
      paymentStatus: PaymentStatus.SUCCEEDED,
      ledgerEntries: [{ entryType: LedgerEntryType.REFUND_GROSS }],
    });
    expect(status).toBe("REFUNDED");
  });

  it("uses ledger chargebacks as override", () => {
    const status = deriveCheckoutStatusFromPayment({
      paymentStatus: PaymentStatus.SUCCEEDED,
      ledgerEntries: [{ entryType: LedgerEntryType.CHARGEBACK_GROSS }],
    });
    expect(status).toBe("DISPUTED");
  });

  it("maps payment status when ledger is neutral", () => {
    const status = deriveCheckoutStatusFromPayment({
      paymentStatus: PaymentStatus.CREATED,
      ledgerEntries: [{ entryType: LedgerEntryType.GROSS }],
    });
    expect(status).toBe("PENDING");
  });
});
