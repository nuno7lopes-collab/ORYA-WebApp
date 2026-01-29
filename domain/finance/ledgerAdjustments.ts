import { prisma } from "@/lib/prisma";
import { logFinanceError } from "@/lib/observability/finance";
import { LedgerEntryType, Prisma } from "@prisma/client";
import type { PricingSnapshot } from "@/domain/finance/checkout";

type DbClient = Prisma.TransactionClient | typeof prisma;

const PROCESSOR_FEE_TYPES = new Set<LedgerEntryType>([
  LedgerEntryType.PROCESSOR_FEES_FINAL,
  LedgerEntryType.PROCESSOR_FEES_ADJUSTMENT,
]);

type LedgerTotals = {
  currency: string;
  sourceType: Prisma.PaymentGetPayload<{ select: { sourceType: true } }>["sourceType"];
  sourceId: string;
  grossCents: number;
  platformFeeCents: number;
  processorFeeCents: number;
};

async function resolveLedgerTotals(
  tx: DbClient,
  paymentId: string,
): Promise<LedgerTotals> {
  const payment = await tx.payment.findUnique({
    where: { id: paymentId },
    select: {
      id: true,
      sourceType: true,
      sourceId: true,
      processorFeesActual: true,
      pricingSnapshotJson: true,
    },
  });

  if (!payment) {
    throw new Error("PAYMENT_NOT_FOUND");
  }

  const snapshot = payment.pricingSnapshotJson as PricingSnapshot | null;
  const entries = await tx.ledgerEntry.findMany({
    where: { paymentId },
    select: { entryType: true, amount: true },
  });

  const grossFromLedger = entries
    .filter((entry) => entry.entryType === LedgerEntryType.GROSS)
    .reduce((sum, entry) => sum + entry.amount, 0);
  const platformFeeFromLedger = entries
    .filter((entry) => entry.entryType === LedgerEntryType.PLATFORM_FEE)
    .reduce((sum, entry) => sum + entry.amount, 0);
  const processorFeeFromLedger = entries
    .filter((entry) => PROCESSOR_FEE_TYPES.has(entry.entryType))
    .reduce((sum, entry) => sum + entry.amount, 0);

  const grossSnapshot = Number.isFinite(snapshot?.gross) ? Number(snapshot?.gross) : 0;
  const platformSnapshot = Number.isFinite(snapshot?.platformFee) ? Number(snapshot?.platformFee) : 0;
  const processorSnapshot = Number.isFinite(payment.processorFeesActual)
    ? Number(payment.processorFeesActual)
    : 0;

  const grossCents = grossFromLedger !== 0 ? grossFromLedger : grossSnapshot;
  const platformFeeCents =
    platformFeeFromLedger !== 0 ? platformFeeFromLedger : -Math.abs(platformSnapshot);
  const processorFeeCents =
    processorFeeFromLedger !== 0 ? processorFeeFromLedger : -Math.abs(processorSnapshot);

  return {
    currency: snapshot?.currency ?? "EUR",
    sourceType: payment.sourceType,
    sourceId: payment.sourceId,
    grossCents,
    platformFeeCents,
    processorFeeCents,
  };
}

export async function appendRefundLedgerEntries(params: {
  paymentId: string;
  causationId: string;
  correlationId?: string | null;
  tx?: DbClient;
}) {
  const tx = params.tx ?? prisma;
  try {
    const totals = await resolveLedgerTotals(tx, params.paymentId);
    const base = {
      paymentId: params.paymentId,
      currency: totals.currency,
      sourceType: totals.sourceType,
      sourceId: totals.sourceId,
      correlationId: params.correlationId ?? params.causationId,
    };

    const entries: Prisma.LedgerEntryCreateManyInput[] = [];
    if (totals.grossCents) {
      entries.push({
        ...base,
        entryType: LedgerEntryType.REFUND_GROSS,
        amount: -Math.abs(totals.grossCents),
        causationId: `${params.causationId}:refund_gross`,
      });
    }
    if (totals.platformFeeCents) {
      entries.push({
        ...base,
        entryType: LedgerEntryType.REFUND_PLATFORM_FEE_REVERSAL,
        amount: Math.abs(totals.platformFeeCents),
        causationId: `${params.causationId}:refund_platform_fee`,
      });
    }
    if (totals.processorFeeCents) {
      entries.push({
        ...base,
        entryType: LedgerEntryType.REFUND_PROCESSOR_FEES_REVERSAL,
        amount: Math.abs(totals.processorFeeCents),
        causationId: `${params.causationId}:refund_processor_fee`,
      });
    }

    if (entries.length) {
      await tx.ledgerEntry.createMany({ data: entries, skipDuplicates: true });
    }
  } catch (err) {
    logFinanceError("refund.ledger_append_failed", err, { paymentId: params.paymentId });
    throw err;
  }
}

export async function appendChargebackLedgerEntries(params: {
  paymentId: string;
  causationId: string;
  correlationId?: string | null;
  disputeFeeCents?: number | null;
  tx?: DbClient;
}) {
  const tx = params.tx ?? prisma;
  try {
    const totals = await resolveLedgerTotals(tx, params.paymentId);
    const base = {
      paymentId: params.paymentId,
      currency: totals.currency,
      sourceType: totals.sourceType,
      sourceId: totals.sourceId,
      correlationId: params.correlationId ?? params.causationId,
    };

    const entries: Prisma.LedgerEntryCreateManyInput[] = [];
    if (totals.grossCents) {
      entries.push({
        ...base,
        entryType: LedgerEntryType.CHARGEBACK_GROSS,
        amount: -Math.abs(totals.grossCents),
        causationId: `${params.causationId}:chargeback_gross`,
      });
    }
    if (totals.platformFeeCents) {
      entries.push({
        ...base,
        entryType: LedgerEntryType.CHARGEBACK_PLATFORM_FEE_REVERSAL,
        amount: Math.abs(totals.platformFeeCents),
        causationId: `${params.causationId}:chargeback_platform_fee`,
      });
    }

    const disputeFee = params.disputeFeeCents ?? 0;
    if (disputeFee) {
      entries.push({
        ...base,
        entryType: LedgerEntryType.DISPUTE_FEE,
        amount: -Math.abs(disputeFee),
        causationId: `${params.causationId}:dispute_fee`,
      });
    }

    if (entries.length) {
      await tx.ledgerEntry.createMany({ data: entries, skipDuplicates: true });
    }
  } catch (err) {
    logFinanceError("dispute.ledger_append_failed", err, { paymentId: params.paymentId });
    throw err;
  }
}

export async function appendDisputeFeeReversal(params: {
  paymentId: string;
  causationId: string;
  correlationId?: string | null;
  disputeFeeCents?: number | null;
  tx?: DbClient;
}) {
  const fee = params.disputeFeeCents ?? 0;
  if (!fee) return;
  const tx = params.tx ?? prisma;
  const payment = await tx.payment.findUnique({
    where: { id: params.paymentId },
    select: { sourceType: true, sourceId: true, pricingSnapshotJson: true },
  });
  if (!payment) throw new Error("PAYMENT_NOT_FOUND");
  const snapshot = payment.pricingSnapshotJson as PricingSnapshot | null;

  await tx.ledgerEntry.createMany({
    data: [
      {
        paymentId: params.paymentId,
        entryType: LedgerEntryType.DISPUTE_FEE_REVERSAL,
        amount: Math.abs(fee),
        currency: snapshot?.currency ?? "EUR",
        sourceType: payment.sourceType,
        sourceId: payment.sourceId,
        causationId: `${params.causationId}:dispute_fee_reversal`,
        correlationId: params.correlationId ?? params.causationId,
      },
    ],
    skipDuplicates: true,
  });
}
