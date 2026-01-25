import { prisma } from "@/lib/prisma";
import { LedgerEntryType, ProcessorFeesStatus } from "@prisma/client";

export type ReconcilePaymentFeesInput = {
  paymentId: string;
  processorFeeCents: number;
  causationId: string;
  correlationId?: string | null;
};

export type ReconcilePaymentFeesResult = {
  status: "FINALIZED" | "ADJUSTED" | "NOOP";
  paymentId: string;
  netToOrgFinal?: number;
};

function normalizeFee(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.abs(Math.round(value));
}

async function computeNetToOrgFinal(
  tx: typeof prisma,
  paymentId: string,
): Promise<number> {
  const entries = await tx.ledgerEntry.findMany({
    where: { paymentId },
    select: { amount: true },
  });
  return entries.reduce((sum, entry) => sum + entry.amount, 0);
}

export async function reconcilePaymentFees(
  input: ReconcilePaymentFeesInput,
): Promise<ReconcilePaymentFeesResult> {
  if (!input.paymentId) throw new Error("PAYMENT_ID_REQUIRED");
  if (!input.causationId) throw new Error("CAUSATION_ID_REQUIRED");

  const feeCents = normalizeFee(input.processorFeeCents);

  return prisma.$transaction(async (tx) => {
    const existing = await tx.ledgerEntry.findFirst({
      where: { paymentId: input.paymentId, causationId: input.causationId },
    });
    if (existing) {
      return { status: "NOOP", paymentId: input.paymentId };
    }

    const payment = await tx.payment.findUnique({ where: { id: input.paymentId } });
    if (!payment) {
      throw new Error("PAYMENT_NOT_FOUND");
    }

    const snapshot = payment.pricingSnapshotJson as { currency?: string } | null;
    const currency = snapshot?.currency;
    if (!currency) {
      throw new Error("CURRENCY_NOT_FOUND");
    }

    const entryBase = {
      paymentId: payment.id,
      currency,
      sourceType: payment.sourceType,
      sourceId: payment.sourceId,
      causationId: input.causationId,
      correlationId: input.correlationId ?? input.causationId,
    };

    if (payment.processorFeesStatus === ProcessorFeesStatus.PENDING) {
      await tx.ledgerEntry.create({
        data: {
          ...entryBase,
          entryType: LedgerEntryType.PROCESSOR_FEES_FINAL,
          amount: -feeCents,
        },
      });

      await tx.payment.update({
        where: { id: payment.id },
        data: {
          processorFeesStatus: ProcessorFeesStatus.FINAL,
          processorFeesActual: feeCents,
        },
      });

      const netToOrgFinal = await computeNetToOrgFinal(tx, payment.id);
      return { status: "FINALIZED", paymentId: payment.id, netToOrgFinal };
    }

    const feeEntries = await tx.ledgerEntry.findMany({
      where: {
        paymentId: payment.id,
        entryType: {
          in: [
            LedgerEntryType.PROCESSOR_FEES_FINAL,
            LedgerEntryType.PROCESSOR_FEES_ADJUSTMENT,
          ],
        },
      },
      select: { amount: true },
    });

    const currentFromLedger = Math.abs(
      feeEntries.reduce((sum, entry) => sum + entry.amount, 0),
    );
    const currentActual = payment.processorFeesActual ?? currentFromLedger;

    if (feeCents === currentActual) {
      if (payment.processorFeesActual !== feeCents) {
        await tx.payment.update({
          where: { id: payment.id },
          data: { processorFeesActual: feeCents },
        });
      }
      const netToOrgFinal = await computeNetToOrgFinal(tx, payment.id);
      return { status: "NOOP", paymentId: payment.id, netToOrgFinal };
    }

    const delta = feeCents - currentActual;
    await tx.ledgerEntry.create({
      data: {
        ...entryBase,
        entryType: LedgerEntryType.PROCESSOR_FEES_ADJUSTMENT,
        amount: -delta,
      },
    });

    await tx.payment.update({
      where: { id: payment.id },
      data: { processorFeesActual: feeCents },
    });

    const netToOrgFinal = await computeNetToOrgFinal(tx, payment.id);
    return { status: "ADJUSTED", paymentId: payment.id, netToOrgFinal };
  });
}
