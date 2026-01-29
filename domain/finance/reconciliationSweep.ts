import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { retrieveCharge, retrievePaymentIntent } from "@/domain/finance/gateway/stripeGateway";
import { ProcessorFeesStatus } from "@prisma/client";
import { maybeReconcileStripeFees } from "@/domain/finance/reconciliationTrigger";
import { logError } from "@/lib/observability/logger";

type SweepResult = {
  scanned: number;
  reconciled: number;
  skippedNoIntent: number;
  skippedNoFee: number;
};

async function resolveStripeFee(intent: Stripe.PaymentIntent): Promise<{ feeCents: number; balanceTxId: string } | null> {
  const latestCharge =
    typeof intent.latest_charge === "string" ? intent.latest_charge : intent.latest_charge?.id ?? null;
  if (!latestCharge) return null;
  const charge = await retrieveCharge(latestCharge, { expand: ["balance_transaction"] });
  const balanceTx = charge.balance_transaction as Stripe.BalanceTransaction | null;
  if (!balanceTx || balanceTx.fee == null) return null;
  return { feeCents: balanceTx.fee, balanceTxId: balanceTx.id };
}

export async function sweepPendingProcessorFees(limit = 50): Promise<SweepResult> {
  const pending = await prisma.payment.findMany({
    where: { processorFeesStatus: ProcessorFeesStatus.PENDING },
    select: { id: true },
    take: limit,
  });

  let reconciled = 0;
  let skippedNoIntent = 0;
  let skippedNoFee = 0;

  for (const payment of pending) {
    let intentId: string | null = null;
    try {
      const paymentEvent = await prisma.paymentEvent.findFirst({
        where: { purchaseId: payment.id, stripePaymentIntentId: { not: null } },
        orderBy: { updatedAt: "desc" },
        select: { stripePaymentIntentId: true, stripeEventId: true },
      });
      intentId = paymentEvent?.stripePaymentIntentId ?? null;
      if (!intentId) {
        skippedNoIntent += 1;
        continue;
      }
      const intent = await retrievePaymentIntent(intentId, {
        expand: ["latest_charge"],
      });
      const feeInfo = await resolveStripeFee(intent as Stripe.PaymentIntent);
      if (!feeInfo) {
        skippedNoFee += 1;
        continue;
      }
      const result = await maybeReconcileStripeFees({
        paymentId: payment.id,
        feeCents: feeInfo.feeCents,
        balanceTxId: feeInfo.balanceTxId,
        stripeEventId: paymentEvent?.stripeEventId ?? null,
      });
      if (result.status !== "SKIPPED") reconciled += 1;
    } catch (err) {
      logError("finance.reconciliation_sweep.failed", err, {
        paymentIntentId: intentId,
        paymentId: payment.id,
      });
    }
  }

  return {
    scanned: pending.length,
    reconciled,
    skippedNoIntent,
    skippedNoFee,
  };
}
