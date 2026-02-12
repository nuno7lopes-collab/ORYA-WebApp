import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { PaymentStatus } from "@prisma/client";
import { applyPaymentStatusToEntitlements } from "@/domain/finance/fulfillment";
import { FINANCE_OUTBOX_EVENTS } from "@/domain/finance/events";
import { appendEventLog } from "@/domain/eventLog/append";
import { makeOutboxDedupeKey } from "@/domain/outbox/dedupe";
import { recordOutboxEvent } from "@/domain/outbox/producer";

export type StripeDisputeEvent = {
  id: string;
  type: "payment.dispute_opened" | "payment.dispute_closed";
  data: {
    object: {
      id: string;
      metadata?: Record<string, string | undefined> | null;
      outcome?: "WON" | "LOST" | string | null;
    };
  };
};

function resolvePaymentId(event: StripeDisputeEvent): string | null {
  const metadata = event.data?.object?.metadata ?? null;
  const paymentId = metadata?.paymentId ?? metadata?.purchaseId ?? null;
  return paymentId && paymentId.trim() !== "" ? paymentId : null;
}

export async function handleStripeWebhook(event: StripeDisputeEvent): Promise<{
  handled: boolean;
  paymentId?: string;
  status?: PaymentStatus;
  updated?: boolean;
  reason?: string;
}> {
  const paymentId = resolvePaymentId(event);
  if (!paymentId) {
    return { handled: false, reason: "PAYMENT_ID_MISSING" };
  }

  let nextStatus: PaymentStatus;
  if (event.type === "payment.dispute_opened") {
    nextStatus = PaymentStatus.DISPUTED;
  } else if (event.type === "payment.dispute_closed") {
    const outcomeRaw = String(event.data?.object?.outcome ?? "").trim().toUpperCase();
    if (outcomeRaw === "WON") {
      nextStatus = PaymentStatus.CHARGEBACK_WON;
    } else if (outcomeRaw === "LOST") {
      nextStatus = PaymentStatus.CHARGEBACK_LOST;
    } else {
      return { handled: false, reason: "DISPUTE_OUTCOME_INVALID", paymentId };
    }
  } else {
    return { handled: false, reason: "EVENT_NOT_SUPPORTED", paymentId };
  }

  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    select: { id: true, status: true, organizationId: true, sourceType: true, sourceId: true },
  });
  if (!payment) {
    return { handled: false, reason: "PAYMENT_NOT_FOUND", paymentId };
  }

  if (payment.status === nextStatus) {
    return { handled: true, updated: false, paymentId, status: nextStatus };
  }

  await prisma.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: paymentId },
      data: { status: nextStatus },
    });
    await applyPaymentStatusToEntitlements({ paymentId, status: nextStatus, tx });
    const eventLogId = crypto.randomUUID();
    const payload = {
      eventLogId,
      paymentId,
      status: nextStatus,
      source: "stripe.webhook",
      eventType: event.type,
    };
    const log = await appendEventLog(
      {
        eventId: eventLogId,
        organizationId: payment.organizationId,
        eventType: FINANCE_OUTBOX_EVENTS.PAYMENT_STATUS_CHANGED,
        idempotencyKey: event.id,
        sourceType: payment.sourceType,
        sourceId: payment.sourceId,
        correlationId: paymentId,
        payload,
      },
      tx,
    );
    if (!log) return;
    await recordOutboxEvent(
      {
        eventId: eventLogId,
        eventType: FINANCE_OUTBOX_EVENTS.PAYMENT_STATUS_CHANGED,
        dedupeKey: makeOutboxDedupeKey(FINANCE_OUTBOX_EVENTS.PAYMENT_STATUS_CHANGED, event.id),
        payload,
        causationId: event.id,
        correlationId: paymentId,
      },
      tx,
    );
  });

  return { handled: true, updated: true, paymentId, status: nextStatus };
}
