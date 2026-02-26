import { RefundCasePolicyCause, SourceType } from "@prisma/client";
import { requestUnifiedRefundCase } from "@/lib/refunds/unifiedRefundCase";

export type BookingRefundReason =
  | "CLIENT_CANCEL"
  | "ORG_CANCEL"
  | "BOOKING_RESCHEDULE";

type RequestBookingRefundCaseInput = {
  bookingId: number;
  paymentIntentId: string;
  reason: BookingRefundReason;
  requestedBy?: string | null;
  reasonCode?: string | null;
  amountCents?: number | null;
  idempotencyKey?: string | null;
  auditPayload?: Record<string, unknown>;
};

function resolvePolicyCause(reason: BookingRefundReason) {
  if (reason === "CLIENT_CANCEL") return RefundCasePolicyCause.BOOKING_CLIENT_CANCEL;
  if (reason === "BOOKING_RESCHEDULE") return RefundCasePolicyCause.BOOKING_FORCED_RESCHEDULE;
  return RefundCasePolicyCause.BOOKING_ORG_CANCEL;
}

export async function requestBookingRefundCase(input: RequestBookingRefundCaseInput) {
  const policyCause = resolvePolicyCause(input.reason);
  const defaultIdempotencyKey =
    input.idempotencyKey ??
    `refund_case:BOOKING:${input.bookingId}:${input.reason}:${input.paymentIntentId}`;

  return requestUnifiedRefundCase({
    policyCause,
    paymentIntentId: input.paymentIntentId,
    sourceType: SourceType.BOOKING,
    sourceId: String(input.bookingId),
    requestedBy: input.requestedBy ?? null,
    reasonCode: input.reasonCode ?? input.reason,
    idempotencyKey: defaultIdempotencyKey,
    overrideRefundCents: input.amountCents ?? null,
    auditPayload: {
      bookingId: input.bookingId,
      reason: input.reason,
      ...(input.auditPayload ?? {}),
    },
  });
}
