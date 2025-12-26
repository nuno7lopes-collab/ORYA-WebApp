import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripeClient";
import type { RefundReason } from "@prisma/client";
import { refundKey } from "@/lib/stripe/idempotency";
import { logFinanceError } from "@/lib/observability/finance";

// Idempotent refund executor (base-only) anchored by refundKey(purchaseId).
export async function refundPurchase(params: {
  purchaseId: string;
  paymentIntentId?: string | null;
  eventId: number;
  reason: RefundReason;
  refundedBy?: string | null;
  auditPayload?: Record<string, unknown>;
}) {
  const { purchaseId, paymentIntentId, eventId, reason, refundedBy, auditPayload } = params;
  const dedupeKey = refundKey(purchaseId);

  const existing = await prisma.refund.findUnique({ where: { dedupeKey } });
  if (existing) return existing;

  const saleSummary = await prisma.saleSummary.findUnique({
    where: { purchaseId },
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

  const baseAmount = Math.max(0, saleSummary.totalCents - saleSummary.platformFeeCents - saleSummary.stripeFeeCents);

  let stripeRefundId: string | null = null;
  try {
    const refund = await stripe.refunds.create(
      {
        payment_intent: paymentIntentId ?? saleSummary.paymentIntentId ?? undefined,
        amount: baseAmount,
      },
      { idempotencyKey: dedupeKey },
    );
    stripeRefundId = refund.id;
  } catch (err) {
    logFinanceError("refund", err, { purchaseId, eventId, paymentIntentId });
    return null;
  }

  return await prisma.refund.create({
    data: {
      dedupeKey,
      purchaseId,
      paymentIntentId: paymentIntentId ?? saleSummary.paymentIntentId ?? null,
      eventId,
      baseAmountCents: baseAmount,
      feesExcludedCents: (saleSummary.platformFeeCents ?? 0) + (saleSummary.stripeFeeCents ?? 0),
      reason,
      refundedBy: refundedBy ?? null,
      stripeRefundId: stripeRefundId ?? null,
      auditPayload: auditPayload ?? {},
      refundedAt: new Date(),
    },
  });
}
