import type Stripe from "stripe";
import { SourceType } from "@prisma/client";
import {
  buildPaymentSubjectIdempotencyKey,
  type PaymentSubjectIdempotencyInput,
} from "@/lib/payments/idempotency";
import {
  PaymentSubject,
  type AppError,
  type PaymentSubject as PaymentSubjectType,
  type Result,
} from "@/lib/payments/types";

export { PaymentSubject, buildPaymentSubjectIdempotencyKey };
export type { AppError, PaymentSubjectIdempotencyInput, Result };

type CreatePaymentIntentForSubjectInput = {
  orgId: number;
  subjectType: PaymentSubjectType;
  subjectId: string;
  amountCents: number;
  currency: string;
  metadata?: Record<string, string>;
  customerId?: string | null;
  existingPaymentIntentId?: string | null;
};

type CreatePaymentIntentForSubjectOutput = {
  idempotencyKey: string;
  paymentIntent: Stripe.PaymentIntent;
  reused: boolean;
};

export interface CreatePaymentIntentForSubjectUseCase {
  execute(
    input: CreatePaymentIntentForSubjectInput,
  ): Promise<Result<CreatePaymentIntentForSubjectOutput, AppError>>;
}

const SUBJECT_TO_SOURCE_TYPE: Record<PaymentSubjectType, SourceType> = {
  BOOKING: SourceType.BOOKING,
  EVENT_TICKET: SourceType.TICKET_ORDER,
  STORE_ORDER: SourceType.STORE_ORDER,
  PADEL_REGISTRATION: SourceType.PADEL_REGISTRATION,
};

const SOURCE_TYPE_TO_SUBJECT = new Map<SourceType, PaymentSubjectType>([
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

export function resolveSourceTypeFromPaymentSubject(subject: PaymentSubjectType): SourceType {
  return SUBJECT_TO_SOURCE_TYPE[subject];
}

export function resolvePaymentSubjectFromSourceType(
  sourceType: string | null | undefined,
): PaymentSubjectType | null {
  if (!sourceType) return null;
  const normalized = sourceType.trim().toUpperCase();
  return SOURCE_TYPE_TO_SUBJECT.get(normalized as SourceType) ?? null;
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
