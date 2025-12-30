import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripeClient";
import type { RefundReason } from "@prisma/client";
import { refundKey } from "@/lib/stripe/idempotency";
import { logFinanceError } from "@/lib/observability/finance";
import { randomUUID } from "crypto";

// Idempotent refund executor (full/partial) anchored by refundKey(purchaseId, refundId).
export async function refundPurchase(params: {
  purchaseId: string;
  paymentIntentId?: string | null;
  eventId: number;
  reason: RefundReason;
  refundedBy?: string | null;
  auditPayload?: Record<string, unknown>;
  amountCents?: number | null;
  refundId?: string | null;
}): Promise<{ refund: { id: number; baseAmountCents: number }; isFullRefund: boolean; remainingAfterCents: number } | null> {
  const { purchaseId, paymentIntentId, eventId, reason, refundedBy, auditPayload, amountCents, refundId } = params;
  const normalizedRefundId =
    typeof refundId === "string" && refundId.trim().length > 0 ? refundId.trim() : randomUUID();
  const dedupeKey = refundKey(purchaseId, normalizedRefundId);

  const existing = await prisma.refund.findUnique({ where: { dedupeKey } });

  const saleSummary = await prisma.saleSummary.findFirst({
    where: {
      OR: [
        { purchaseId },
        paymentIntentId ? { paymentIntentId } : undefined,
      ].filter(Boolean) as Array<Record<string, unknown>>,
    },
    select: {
      id: true,
      totalCents: true,
      platformFeeCents: true,
      stripeFeeCents: true,
      paymentIntentId: true,
      currency: true,
    },
  });
  if (!saleSummary) {
    console.warn("[refund] saleSummary not found for purchase", purchaseId);
    return null;
  }

  const refundedAgg = await prisma.refund.aggregate({
    where: { purchaseId },
    _sum: { baseAmountCents: true },
  });
  const refundedSoFar = refundedAgg._sum.baseAmountCents ?? 0;
  const remainingBefore = Math.max(0, saleSummary.totalCents - refundedSoFar);

  if (existing) {
    const remainingAfter = Math.max(0, saleSummary.totalCents - refundedSoFar);
    return {
      refund: { id: existing.id, baseAmountCents: existing.baseAmountCents },
      isFullRefund: remainingAfter === 0,
      remainingAfterCents: remainingAfter,
    };
  }

  const requestedAmount =
    typeof amountCents === "number" && Number.isFinite(amountCents)
      ? Math.round(amountCents)
      : remainingBefore;
  const refundAmount = Math.max(0, Math.min(requestedAmount, remainingBefore));

  if (refundAmount <= 0) {
    console.warn("[refund] nothing to refund for purchase", purchaseId);
    return null;
  }

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      payoutMode: true,
      organizer: { select: { orgType: true } },
    },
  });
  const isDestinationCharge =
    event?.payoutMode === "ORGANIZER" && event.organizer?.orgType !== "PLATFORM";

  let stripeRefundId: string | null = null;
  try {
    const refundParams: Parameters<typeof stripe.refunds.create>[0] = {
      payment_intent: paymentIntentId ?? saleSummary.paymentIntentId ?? undefined,
      amount: refundAmount,
    };
    if (isDestinationCharge) {
      refundParams.reverse_transfer = true;
      refundParams.refund_application_fee = false;
    }
    const refund = await stripe.refunds.create(refundParams, { idempotencyKey: dedupeKey });
    stripeRefundId = refund.id;
  } catch (err) {
    logFinanceError("refund", err, { purchaseId, eventId, paymentIntentId });
    return null;
  }

  const created = await prisma.refund.create({
    data: {
      dedupeKey,
      purchaseId,
      paymentIntentId: paymentIntentId ?? saleSummary.paymentIntentId ?? null,
      eventId,
      baseAmountCents: refundAmount,
      feesExcludedCents: (saleSummary.platformFeeCents ?? 0) + (saleSummary.stripeFeeCents ?? 0),
      reason,
      refundedBy: refundedBy ?? null,
      stripeRefundId: stripeRefundId ?? null,
      auditPayload: { ...(auditPayload ?? {}), refundId: normalizedRefundId },
      refundedAt: new Date(),
    },
  });

  const remainingAfter = Math.max(0, remainingBefore - refundAmount);
  return {
    refund: { id: created.id, baseAmountCents: created.baseAmountCents },
    isFullRefund: remainingAfter === 0,
    remainingAfterCents: remainingAfter,
  };
}
