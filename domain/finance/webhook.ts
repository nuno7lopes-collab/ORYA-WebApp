import { prisma } from "@/lib/prisma";
import { PaymentStatus } from "@prisma/client";
import { applyPaymentStatusToEntitlements } from "@/domain/finance/fulfillment";
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
  const paymentId = metadata?.paymentId ?? null;
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

  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
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
    await recordOutboxEvent(
      {
        eventType: "payment.status.changed",
        payload: { paymentId, status: nextStatus, source: "stripe.webhook", eventType: event.type },
        causationId: event.id,
        correlationId: paymentId,
      },
      tx,
    );
  });

  return { handled: true, updated: true, paymentId, status: nextStatus };
}
