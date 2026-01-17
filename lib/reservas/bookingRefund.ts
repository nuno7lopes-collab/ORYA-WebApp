import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripeClient";
import { cancelPendingPayout } from "@/lib/payments/pendingPayout";

type RefundBookingParams = {
  bookingId: number;
  paymentIntentId: string;
  reason: string;
};

export async function refundBookingPayment(params: RefundBookingParams) {
  const transaction = await prisma.transaction.findFirst({
    where: { stripePaymentIntentId: params.paymentIntentId },
    select: { amountCents: true },
  });

  const idempotencyKey = `booking_refund_${params.bookingId}`;
  const paymentIntent = await stripe.paymentIntents.retrieve(params.paymentIntentId, {
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
        await stripe.paymentIntents.cancel(params.paymentIntentId);
      } catch (err) {
        console.warn("[reservas/refund] failed to cancel payment intent", err);
      }
    }
    await cancelPendingPayout(params.paymentIntentId, params.reason);
    return null;
  }

  const amountCents = transaction?.amountCents ?? paymentIntent.amount_received ?? undefined;
  const refundAmount = amountCents && amountCents > 0 ? amountCents : undefined;

  try {
    const refund = await stripe.refunds.create(
      {
        payment_intent: params.paymentIntentId,
        amount: refundAmount,
      },
      { idempotencyKey },
    );

    await cancelPendingPayout(params.paymentIntentId, params.reason);

    return refund;
  } catch (err) {
    const message = err && typeof err === "object" && "message" in err ? String(err.message) : "";
    if (message.includes("does not have a successful charge")) {
      await cancelPendingPayout(params.paymentIntentId, params.reason);
      return null;
    }
    throw err;
  }
}
