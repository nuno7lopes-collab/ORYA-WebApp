import { prisma } from "@/lib/prisma";
import type Stripe from "stripe";
import {
  cancelPaymentIntent,
  createRefund,
  retrievePaymentIntent,
} from "@/domain/finance/gateway/stripeGateway";
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

type PaymentIntentWithCharges = Stripe.PaymentIntent & {
  charges?: Stripe.ApiList<Stripe.Charge> | null;
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

  const paymentEvent = await prisma.paymentEvent.findFirst({
    where: { stripePaymentIntentId: params.paymentIntentId },
    select: { purchaseId: true },
  });
  const paymentId = paymentEvent?.purchaseId ?? null;
  const payment = paymentId
    ? await prisma.payment.findUnique({
        where: { id: paymentId },
        select: { pricingSnapshotJson: true },
      })
    : null;
  const snapshot = payment?.pricingSnapshotJson as { total?: number } | null;
  const snapshotTotal = typeof snapshot?.total === "number" ? snapshot.total : null;

  const idempotencyKey =
    params.idempotencyKey ??
    `refund:BOOKING:${params.bookingId}:${params.reason}`;
  const paymentIntent = await retrievePaymentIntent(params.paymentIntentId, {
    expand: ["charges"],
  });
  const intent = paymentIntent as PaymentIntentWithCharges;
  const charges = Array.isArray(intent.charges?.data) ? intent.charges.data : [];
  const isSucceeded = intent.status === "succeeded";
  const hasSuccessfulCharge =
    charges.some((charge: Stripe.Charge) => charge.status === "succeeded") || isSucceeded;
  const cancelableStatuses = new Set([
    "requires_payment_method",
    "requires_capture",
    "requires_reauthorization",
    "requires_confirmation",
    "requires_action",
    "processing",
  ]);

  if (!hasSuccessfulCharge) {
    if (cancelableStatuses.has(intent.status)) {
      try {
        await cancelPaymentIntent(params.paymentIntentId);
      } catch (err) {
        console.warn("[reservas/refund] failed to cancel payment intent", err);
      }
    }
    return null;
  }

  const amountAvailable =
    snapshotTotal ?? intent.amount_received ?? intent.amount ?? 0;
  const requestedAmount = toAmountCents(params.amountCents);
  const refundAmountCents =
    requestedAmount && amountAvailable > 0
      ? Math.min(requestedAmount, amountAvailable)
      : amountAvailable > 0
        ? amountAvailable
        : null;

  if (!refundAmountCents) return null;

  try {
    const refund = await createRefund(
      {
        payment_intent: params.paymentIntentId,
        amount: refundAmountCents,
      },
      { idempotencyKey, org, requireStripe: true },
    );

    await prisma.$transaction(async (tx) => {
      const outbox = await recordOutboxEvent(
        {
          eventType: "refund.created",
          dedupeKey: idempotencyKey,
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
      return null;
    }
    if (message.includes("FINANCE_CONNECT_NOT_READY") || message.includes("FINANCE_ORG_NOT_RESOLVED")) {
      throw err;
    }
    throw err;
  }
}
