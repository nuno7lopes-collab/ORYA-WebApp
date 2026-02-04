import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { LedgerEntryType, ProcessorFeesStatus, Prisma } from "@prisma/client";
import { FINANCE_OUTBOX_EVENTS } from "@/domain/finance/events";
import { appendEventLog } from "@/domain/eventLog/append";
import { makeOutboxDedupeKey } from "@/domain/outbox/dedupe";
import { recordOutboxEvent } from "@/domain/outbox/producer";

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

type DbClient = Prisma.TransactionClient | typeof prisma;

async function computeNetToOrgFinal(
  tx: DbClient,
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
      select: { id: true },
    });
    if (existing) {
      return { status: "NOOP", paymentId: input.paymentId };
    }

    const payment = await tx.payment.findUnique({
      where: { id: input.paymentId },
      select: {
        id: true,
        organizationId: true,
        sourceType: true,
        sourceId: true,
        pricingSnapshotJson: true,
        processorFeesStatus: true,
        processorFeesActual: true,
      },
    });
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
      const eventLogId = crypto.randomUUID();
      const payload = {
        eventLogId,
        paymentId: payment.id,
        processorFeesActual: feeCents,
        processorFeesStatus: ProcessorFeesStatus.FINAL,
        netToOrgFinal,
      };
      const log = await appendEventLog(
        {
          eventId: eventLogId,
          organizationId: payment.organizationId,
          eventType: FINANCE_OUTBOX_EVENTS.PAYMENT_FEES_RECONCILED,
          idempotencyKey: input.causationId,
          sourceType: payment.sourceType,
          sourceId: payment.sourceId,
          correlationId: payment.id,
          payload,
        },
        tx,
      );
      if (log) {
        await recordOutboxEvent(
          {
            eventId: eventLogId,
            eventType: FINANCE_OUTBOX_EVENTS.PAYMENT_FEES_RECONCILED,
            dedupeKey: makeOutboxDedupeKey(FINANCE_OUTBOX_EVENTS.PAYMENT_FEES_RECONCILED, input.causationId),
            payload,
            causationId: input.causationId,
            correlationId: payment.id,
          },
          tx,
        );
      }
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
      const updatedActual = payment.processorFeesActual !== feeCents;
      if (updatedActual) {
        await tx.payment.update({
          where: { id: payment.id },
          data: { processorFeesActual: feeCents },
        });
      }
      const netToOrgFinal = await computeNetToOrgFinal(tx, payment.id);
      if (updatedActual) {
        const eventLogId = crypto.randomUUID();
        const payload = {
          eventLogId,
          paymentId: payment.id,
          processorFeesActual: feeCents,
          processorFeesStatus: payment.processorFeesStatus,
          netToOrgFinal,
        };
        const log = await appendEventLog(
          {
            eventId: eventLogId,
            organizationId: payment.organizationId,
            eventType: FINANCE_OUTBOX_EVENTS.PAYMENT_FEES_RECONCILED,
            idempotencyKey: input.causationId,
            sourceType: payment.sourceType,
            sourceId: payment.sourceId,
            correlationId: payment.id,
            payload,
          },
          tx,
        );
        if (log) {
          await recordOutboxEvent(
            {
              eventId: eventLogId,
              eventType: FINANCE_OUTBOX_EVENTS.PAYMENT_FEES_RECONCILED,
              dedupeKey: makeOutboxDedupeKey(FINANCE_OUTBOX_EVENTS.PAYMENT_FEES_RECONCILED, input.causationId),
              payload,
              causationId: input.causationId,
              correlationId: payment.id,
            },
            tx,
          );
        }
      }
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
    const eventLogId = crypto.randomUUID();
    const payload = {
      eventLogId,
      paymentId: payment.id,
      processorFeesActual: feeCents,
      processorFeesStatus: ProcessorFeesStatus.FINAL,
      netToOrgFinal,
    };
    const log = await appendEventLog(
      {
        eventId: eventLogId,
        organizationId: payment.organizationId,
        eventType: FINANCE_OUTBOX_EVENTS.PAYMENT_FEES_RECONCILED,
        idempotencyKey: input.causationId,
        sourceType: payment.sourceType,
        sourceId: payment.sourceId,
        correlationId: payment.id,
        payload,
      },
      tx,
    );
    if (log) {
      await recordOutboxEvent(
        {
          eventId: eventLogId,
          eventType: FINANCE_OUTBOX_EVENTS.PAYMENT_FEES_RECONCILED,
          dedupeKey: makeOutboxDedupeKey(FINANCE_OUTBOX_EVENTS.PAYMENT_FEES_RECONCILED, input.causationId),
          payload,
          causationId: input.causationId,
          correlationId: payment.id,
        },
        tx,
      );
    }
    return { status: "ADJUSTED", paymentId: payment.id, netToOrgFinal };
  });
}
