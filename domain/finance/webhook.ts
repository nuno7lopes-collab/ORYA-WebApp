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
  type: "dispute.created" | "dispute.won" | "dispute.lost" | "charge.dispute.created";
  data: {
    object: {
      id: string;
      metadata?: Record<string, string | undefined> | null;
    };
  };
};

const EVENT_STATUS_MAP: Record<StripeDisputeEvent["type"], PaymentStatus> = {
  "dispute.created": PaymentStatus.DISPUTED,
  "charge.dispute.created": PaymentStatus.DISPUTED,
  "dispute.won": PaymentStatus.CHARGEBACK_WON,
  "dispute.lost": PaymentStatus.CHARGEBACK_LOST,
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
  if (!(event.type in EVENT_STATUS_MAP)) {
    return { handled: false, reason: "EVENT_NOT_SUPPORTED" };
  }

  const paymentId = resolvePaymentId(event);
  if (!paymentId) {
    return { handled: false, reason: "PAYMENT_ID_MISSING" };
  }

  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    select: { id: true, status: true, organizationId: true, sourceType: true, sourceId: true },
  });
  if (!payment) {
    return { handled: false, reason: "PAYMENT_NOT_FOUND", paymentId };
  }

  const nextStatus = EVENT_STATUS_MAP[event.type];
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
