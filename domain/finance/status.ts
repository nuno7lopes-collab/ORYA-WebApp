import { LedgerEntryType, PaymentStatus } from "@prisma/client";

export type CheckoutStatus =
  | "PENDING"
  | "PROCESSING"
  | "REQUIRES_ACTION"
  | "PAID"
  | "FAILED"
  | "REFUNDED"
  | "DISPUTED";

const REFUND_LEDGER_TYPES = new Set<LedgerEntryType>([
  LedgerEntryType.REFUND_GROSS,
  LedgerEntryType.REFUND_PLATFORM_FEE_REVERSAL,
  LedgerEntryType.REFUND_PROCESSOR_FEES_REVERSAL,
]);

const DISPUTE_LEDGER_TYPES = new Set<LedgerEntryType>([
  LedgerEntryType.CHARGEBACK_GROSS,
  LedgerEntryType.CHARGEBACK_PLATFORM_FEE_REVERSAL,
  LedgerEntryType.DISPUTE_FEE,
  LedgerEntryType.DISPUTE_FEE_REVERSAL,
]);

export function deriveCheckoutStatusFromPayment(params: {
  paymentStatus: PaymentStatus;
  ledgerEntries?: Array<{ entryType: LedgerEntryType }>;
}): CheckoutStatus {
  const ledgerEntries = params.ledgerEntries ?? [];
  for (const entry of ledgerEntries) {
    if (DISPUTE_LEDGER_TYPES.has(entry.entryType)) {
      return "DISPUTED";
    }
  }
  for (const entry of ledgerEntries) {
    if (REFUND_LEDGER_TYPES.has(entry.entryType)) {
      return "REFUNDED";
    }
  }

  switch (params.paymentStatus) {
    case PaymentStatus.CREATED:
      return "PENDING";
    case PaymentStatus.REQUIRES_ACTION:
      return "REQUIRES_ACTION";
    case PaymentStatus.PROCESSING:
      return "PROCESSING";
    case PaymentStatus.SUCCEEDED:
      return "PAID";
    case PaymentStatus.PARTIAL_REFUND:
    case PaymentStatus.REFUNDED:
      return "REFUNDED";
    case PaymentStatus.DISPUTED:
    case PaymentStatus.CHARGEBACK_WON:
    case PaymentStatus.CHARGEBACK_LOST:
      return "DISPUTED";
    case PaymentStatus.FAILED:
    case PaymentStatus.CANCELLED:
    default:
      return "FAILED";
  }
}
