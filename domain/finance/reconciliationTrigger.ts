import { reconcilePaymentFees } from "@/domain/finance/reconciliation";

export async function maybeReconcileStripeFees(input: {
  paymentId: string | null | undefined;
  feeCents: number | null | undefined;
  balanceTxId?: string | null;
  stripeEventId?: string | null;
}) {
  const paymentId = input.paymentId ?? null;
  if (!paymentId) return { status: "SKIPPED" as const };
  if (input.feeCents == null || !Number.isFinite(input.feeCents)) {
    return { status: "SKIPPED" as const };
  }
  const causationId = input.balanceTxId
    ? `stripe:balance_tx:${input.balanceTxId}`
    : `stripe:fee:${input.stripeEventId ?? paymentId}`;
  const correlationId = input.stripeEventId ?? causationId;
  return reconcilePaymentFees({
    paymentId,
    processorFeeCents: input.feeCents,
    causationId,
    correlationId,
  });
}
