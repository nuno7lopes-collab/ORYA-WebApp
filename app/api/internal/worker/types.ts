export type OperationType =
  | "PROCESS_STRIPE_EVENT"
  | "FULFILL_PAYMENT"
  | "UPSERT_LEDGER_FROM_PI"
  | "UPSERT_LEDGER_FROM_PI_FREE"
  | "ISSUE_TICKETS"
  | "PROCESS_REFUND_SINGLE"
  | "MARK_DISPUTE"
  | "SEND_EMAIL_RECEIPT"
  | "SEND_NOTIFICATION_PURCHASE"
  | "APPLY_PROMO_REDEMPTION"
  | "CLAIM_GUEST_PURCHASE"
  | "SEND_EMAIL_OUTBOX";

export type OperationRecord = {
  id: number;
  operationType: OperationType | string;
  dedupeKey: string;
  status: string;
  attempts: number;
  payload: Record<string, unknown> | null;
  purchaseId: string | null;
  paymentIntentId: string | null;
  stripeEventId: string | null;
  eventId?: number | null;
  organizationId?: number | null;
  pairingId?: number | null;
};
