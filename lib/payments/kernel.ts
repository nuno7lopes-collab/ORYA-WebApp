import { SourceType } from "@prisma/client";
import { checkoutKey } from "@/lib/stripe/idempotency";

export const PaymentSubject = {
  BOOKING: "BOOKING",
  EVENT_TICKET: "EVENT_TICKET",
  STORE_ORDER: "STORE_ORDER",
  PADEL_REGISTRATION: "PADEL_REGISTRATION",
} as const;

export type PaymentSubject = (typeof PaymentSubject)[keyof typeof PaymentSubject];

const SUBJECT_TO_SOURCE_TYPE: Record<PaymentSubject, SourceType> = {
  BOOKING: SourceType.BOOKING,
  EVENT_TICKET: SourceType.TICKET_ORDER,
  STORE_ORDER: SourceType.STORE_ORDER,
  PADEL_REGISTRATION: SourceType.PADEL_REGISTRATION,
};

const SOURCE_TYPE_TO_SUBJECT = new Map<SourceType, PaymentSubject>([
  [SourceType.BOOKING, PaymentSubject.BOOKING],
  [SourceType.TICKET_ORDER, PaymentSubject.EVENT_TICKET],
  [SourceType.STORE_ORDER, PaymentSubject.STORE_ORDER],
  [SourceType.PADEL_REGISTRATION, PaymentSubject.PADEL_REGISTRATION],
]);

function normalizeSegment(value: string | number | null | undefined) {
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value.trim();
  return "";
}

export function resolveSourceTypeFromPaymentSubject(subject: PaymentSubject): SourceType {
  return SUBJECT_TO_SOURCE_TYPE[subject];
}

export function resolvePaymentSubjectFromSourceType(
  sourceType: string | null | undefined,
): PaymentSubject | null {
  if (!sourceType) return null;
  const normalized = sourceType.trim().toUpperCase();
  return SOURCE_TYPE_TO_SUBJECT.get(normalized as SourceType) ?? null;
}

export function buildPaymentSubjectIdempotencyKey(params: {
  subject: PaymentSubject;
  purchaseId: string;
}) {
  const purchaseId = normalizeSegment(params.purchaseId);
  if (!purchaseId) {
    throw new Error("PURCHASE_ID_REQUIRED");
  }
  const sourceType = resolveSourceTypeFromPaymentSubject(params.subject);
  return checkoutKey(`${sourceType}:${purchaseId}`);
}

export function buildPaymentFulfillmentDedupeKey(params: {
  sourceType?: string | null;
  sourceId?: string | number | null;
  purchaseId?: string | null;
  paymentIntentId?: string | null;
}) {
  const sourceType = normalizeSegment(params.sourceType).toUpperCase();
  const sourceId = normalizeSegment(params.sourceId);
  if (sourceType && sourceId) {
    return `fulfill:${sourceType}:${sourceId}`;
  }
  const purchaseId = normalizeSegment(params.purchaseId);
  if (purchaseId) {
    return `fulfill:purchase:${purchaseId}`;
  }
  const paymentIntentId = normalizeSegment(params.paymentIntentId);
  if (paymentIntentId) {
    return `fulfill:intent:${paymentIntentId}`;
  }
  return "fulfill:unknown";
}
