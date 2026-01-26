export const FINANCE_OUTBOX_EVENTS = {
  PAYMENT_CREATED: "payment.created",
  PAYMENT_STATUS_CHANGED: "payment.status.changed",
  PAYMENT_FEES_RECONCILED: "payment.fees.reconciled",
} as const;

export type FinanceOutboxEventType =
  (typeof FINANCE_OUTBOX_EVENTS)[keyof typeof FINANCE_OUTBOX_EVENTS];
