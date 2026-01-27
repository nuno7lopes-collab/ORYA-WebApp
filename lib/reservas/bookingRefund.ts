import { prisma } from "@/lib/prisma";
import {
  cancelPaymentIntent,
  createRefund,
  retrievePaymentIntent,
} from "@/domain/finance/gateway/stripeGateway";
import { cancelPendingPayout } from "@/lib/payments/pendingPayout";
import { recordOutboxEvent } from "@/domain/outbox/producer";
import { appendEventLog } from "@/domain/eventLog/append";
import { SourceType } from "@prisma/client";

type RefundBookingParams = {
  bookingId: number;
  paymentIntentId: string;
  reason: string;
  amountCents?: number | null;
  idempotencyKey?: string | null;
};

const toAmountCents = (value: number | null | undefined) => {
  if (!Number.isFinite(value)) return null;
  const parsed = Math.round(value as number);
  return parsed > 0 ? parsed : null;
};

export async function refundBookingPayment(params: RefundBookingParams) {
  const booking = await prisma.booking.findUnique({
    where: { id: params.bookingId },
    select: { organizationId: true },
  });
  if (!booking?.organizationId) {
    throw new Error("FINANCE_ORG_NOT_RESOLVED");
  }

  const org = await prisma.organization.findUnique({
    where: { id: booking.organizationId },
    select: {
      stripeAccountId: true,
      stripeChargesEnabled: true,
      stripePayoutsEnabled: true,
      orgType: true,
    },
  });
  if (!org) {
    throw new Error("FINANCE_ORG_NOT_RESOLVED");
  }

  const transaction = await prisma.transaction.findFirst({
    where: { stripePaymentIntentId: params.paymentIntentId },
    select: { amountCents: true },
  });

  const idempotencyKey =
    params.idempotencyKey ??
    `refund:BOOKING:${params.bookingId}:${params.reason}`;
  const paymentIntent = await retrievePaymentIntent(params.paymentIntentId, {
    expand: ["charges"],
  });
  const charges = Array.isArray(paymentIntent.charges?.data) ? paymentIntent.charges.data : [];
  const isSucceeded = paymentIntent.status === "succeeded";
  const hasSuccessfulCharge = charges.some((charge) => charge.status === "succeeded") || isSucceeded;
  const cancelableStatuses = new Set([
    "requires_payment_method",
    "requires_capture",
    "requires_reauthorization",
    "requires_confirmation",
    "requires_action",
    "processing",
  ]);

  if (!hasSuccessfulCharge) {
    if (cancelableStatuses.has(paymentIntent.status)) {
      try {
        await cancelPaymentIntent(params.paymentIntentId);
      } catch (err) {
        console.warn("[reservas/refund] failed to cancel payment intent", err);
      }
    }
    await cancelPendingPayout(params.paymentIntentId, params.reason);
    return null;
  }

  const amountAvailable =
    transaction?.amountCents ?? paymentIntent.amount_received ?? paymentIntent.amount ?? 0;
  const requestedAmount = toAmountCents(params.amountCents);
  const refundAmountCents =
    requestedAmount && amountAvailable > 0
      ? Math.min(requestedAmount, amountAvailable)
      : amountAvailable > 0
        ? amountAvailable
        : null;

  if (!refundAmountCents) {
    await cancelPendingPayout(params.paymentIntentId, params.reason);
    return null;
  }

  try {
    const refund = await createRefund(
      {
        payment_intent: params.paymentIntentId,
        amount: refundAmountCents,
      },
      { idempotencyKey, org, requireStripe: true },
    );

    await cancelPendingPayout(params.paymentIntentId, params.reason);

    await prisma.$transaction(async (tx) => {
      const outbox = await recordOutboxEvent(
        {
          eventType: "refund.created",
          payload: {
            bookingId: params.bookingId,
            paymentIntentId: params.paymentIntentId,
            reason: params.reason,
            amountCents: refundAmountCents,
          },
        },
        tx,
      );

      await appendEventLog(
        {
          eventId: outbox.eventId,
          organizationId: booking.organizationId,
          eventType: "refund.created",
          idempotencyKey: outbox.eventId,
          actorUserId: null,
          sourceType: SourceType.BOOKING,
          sourceId: String(params.bookingId),
          correlationId: outbox.eventId,
          payload: {
            bookingId: params.bookingId,
            paymentIntentId: params.paymentIntentId,
            reason: params.reason,
            amountCents: refundAmountCents,
          },
        },
        tx,
      );
    });

    return refund;
  } catch (err) {
    const message = err && typeof err === "object" && "message" in err ? String(err.message) : "";
    if (message.includes("does not have a successful charge")) {
      await cancelPendingPayout(params.paymentIntentId, params.reason);
      return null;
    }
    if (message.includes("FINANCE_CONNECT_NOT_READY") || message.includes("FINANCE_ORG_NOT_RESOLVED")) {
      throw err;
    }
    throw err;
  }
}
