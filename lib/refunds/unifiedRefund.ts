import { prisma } from "@/lib/prisma";
import type Stripe from "stripe";
import {
  cancelPaymentIntent,
  createRefund,
  retrievePaymentIntent,
} from "@/domain/finance/gateway/stripeGateway";
import { recordOutboxEvent } from "@/domain/outbox/producer";
import { appendEventLog } from "@/domain/eventLog/append";
import type { Prisma, RefundReason } from "@prisma/client";
import { SourceType } from "@prisma/client";
import { logFinanceError } from "@/lib/observability/finance";
import { logWarn } from "@/lib/observability/logger";
import { appendRefundLedgerEntries } from "@/domain/finance/ledgerAdjustments";
import { requiresOrganizationStripe } from "@/domain/finance/payoutModePolicy";

type RefundBookingParams = {
  bookingId: number;
  paymentIntentId: string;
  reason: string;
  amountCents?: number | null;
  idempotencyKey?: string | null;
};

type PaymentIntentWithCharges = Stripe.PaymentIntent & {
  charges?: Stripe.ApiList<Stripe.Charge> | null;
};

const toAmountCents = (value: number | null | undefined) => {
  if (!Number.isFinite(value)) return null;
  const parsed = Math.round(value as number);
  return parsed > 0 ? parsed : null;
};

export async function refundBookingPayment(params: RefundBookingParams) {
  const booking = await prisma.booking.findUnique({
    where: { id: params.bookingId },
    select: { organizationId: true },
  });
  if (!booking?.organizationId) {
    throw new Error("FINANCE_ORG_NOT_RESOLVED");
  }

  const org = await prisma.organization.findUnique({
    where: { id: booking.organizationId },
    select: {
      stripeAccountId: true,
      stripeChargesEnabled: true,
      stripePayoutsEnabled: true,
      orgType: true,
    },
  });
  if (!org) {
    throw new Error("FINANCE_ORG_NOT_RESOLVED");
  }

  const paymentEvent = await prisma.paymentEvent.findFirst({
    where: { stripePaymentIntentId: params.paymentIntentId },
    select: { purchaseId: true },
  });
  const paymentId = paymentEvent?.purchaseId ?? null;
  const payment = paymentId
    ? await prisma.payment.findUnique({
        where: { id: paymentId },
        select: { pricingSnapshotJson: true },
      })
    : null;
  const snapshot = payment?.pricingSnapshotJson as { total?: number } | null;
  const snapshotTotal = typeof snapshot?.total === "number" ? snapshot.total : null;

  const idempotencyKey =
    params.idempotencyKey ??
    `refund:BOOKING:${params.bookingId}:${params.reason}`;
  const paymentIntent = await retrievePaymentIntent(params.paymentIntentId, {
    expand: ["charges"],
  });
  const intent = paymentIntent as PaymentIntentWithCharges;
  const charges = Array.isArray(intent.charges?.data) ? intent.charges.data : [];
  const isSucceeded = intent.status === "succeeded";
  const hasSuccessfulCharge =
    charges.some((charge: Stripe.Charge) => charge.status === "succeeded") || isSucceeded;
  const cancelableStatuses = new Set([
    "requires_payment_method",
    "requires_capture",
    "requires_reauthorization",
    "requires_confirmation",
    "requires_action",
    "processing",
  ]);

  if (!hasSuccessfulCharge) {
    if (cancelableStatuses.has(intent.status)) {
      try {
        await cancelPaymentIntent(params.paymentIntentId);
      } catch (err) {
        console.warn("[reservas/refund] failed to cancel payment intent", err);
      }
    }
    return null;
  }

  const amountAvailable =
    snapshotTotal ?? intent.amount_received ?? intent.amount ?? 0;
  const requestedAmount = toAmountCents(params.amountCents);
  const refundAmountCents =
    requestedAmount && amountAvailable > 0
      ? Math.min(requestedAmount, amountAvailable)
      : amountAvailable > 0
        ? amountAvailable
        : null;

  if (!refundAmountCents) return null;
  const requiresStripeForRefund = requiresOrganizationStripe(org.orgType);
  const connectRefundOptions = requiresStripeForRefund
    ? { reverseTransfer: true, refundApplicationFee: true }
    : {};

  try {
    const refund = await createRefund(
      {
        payment_intent: params.paymentIntentId,
        amount: refundAmountCents,
      },
      {
        idempotencyKey,
        org,
        requireStripe: requiresStripeForRefund,
        ...connectRefundOptions,
      },
    );

    await prisma.$transaction(async (tx) => {
      const outbox = await recordOutboxEvent(
        {
          eventType: "refund.created",
          dedupeKey: idempotencyKey,
          payload: {
            bookingId: params.bookingId,
            paymentIntentId: params.paymentIntentId,
            reason: params.reason,
            amountCents: refundAmountCents,
          },
        },
        tx,
      );

      await appendEventLog(
        {
          eventId: outbox.eventId,
          organizationId: booking.organizationId,
          eventType: "refund.created",
          idempotencyKey: outbox.eventId,
          actorUserId: null,
          sourceType: SourceType.BOOKING,
          sourceId: String(params.bookingId),
          correlationId: outbox.eventId,
          payload: {
            bookingId: params.bookingId,
            paymentIntentId: params.paymentIntentId,
            reason: params.reason,
            amountCents: refundAmountCents,
          },
        },
        tx,
      );
    });

    return refund;
  } catch (err) {
    const message = err && typeof err === "object" && "message" in err ? String(err.message) : "";
    if (message.includes("does not have a successful charge")) {
      return null;
    }
    if (message.includes("FINANCE_CONNECT_NOT_READY") || message.includes("FINANCE_ORG_NOT_RESOLVED")) {
      throw err;
    }
    throw err;
  }
}

export async function refundPurchase(params: {
  purchaseId: string;
  paymentIntentId?: string | null;
  eventId: number;
  reason: RefundReason;
  refundedBy?: string | null;
  auditPayload?: Prisma.InputJsonValue;
}) {
  const { purchaseId, paymentIntentId, eventId, reason, refundedBy, auditPayload } = params;
  const dedupeKey = `refund:TICKET_ORDER:${purchaseId}`;

  const existing = await prisma.refund.findUnique({ where: { dedupeKey } });
  if (existing) return existing;

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { organizationId: true },
  });
  const organizationId = event?.organizationId ?? null;
  if (!organizationId) {
    throw new Error("FINANCE_ORG_NOT_RESOLVED");
  }

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      stripeAccountId: true,
      stripeChargesEnabled: true,
      stripePayoutsEnabled: true,
      orgType: true,
    },
  });
  if (!org) {
    throw new Error("FINANCE_ORG_NOT_RESOLVED");
  }

  const saleSummary = await prisma.saleSummary.findUnique({
    where: { purchaseId },
    select: {
      id: true,
      totalCents: true,
      platformFeeCents: true,
      cardPlatformFeeCents: true,
      stripeFeeCents: true,
      paymentIntentId: true,
      currency: true,
    },
  });
  if (!saleSummary) {
    logWarn("refund.sale_summary_missing", { purchaseId });
    return null;
  }

  const cardFeeCents = saleSummary.cardPlatformFeeCents ?? 0;
  const totalCents = saleSummary.totalCents ?? 0;
  const platformFeeCents = saleSummary.platformFeeCents ?? 0;
  const stripeFeeCents = saleSummary.stripeFeeCents ?? 0;
  const baseAmount = Math.max(0, totalCents - platformFeeCents - cardFeeCents - stripeFeeCents);

  let stripeRefundId: string | null = null;
  const requiresStripeForRefund = requiresOrganizationStripe(org.orgType);
  try {
    const refund = await createRefund(
      {
        payment_intent: paymentIntentId ?? saleSummary.paymentIntentId ?? undefined,
        amount: baseAmount,
      },
      { idempotencyKey: dedupeKey, org, requireStripe: requiresStripeForRefund },
    );
    stripeRefundId = refund.id;
  } catch (err) {
    const message = err && typeof err === "object" && "message" in err ? String(err.message) : "";
    if (message.includes("FINANCE_CONNECT_NOT_READY") || message.includes("FINANCE_ORG_NOT_RESOLVED")) {
      throw err;
    }
    logFinanceError("refund", err, { purchaseId, eventId, paymentIntentId });
    return null;
  }

  return await prisma.$transaction(async (tx) => {
    const refund = await tx.refund.create({
      data: {
        dedupeKey,
        purchaseId,
        paymentIntentId: paymentIntentId ?? saleSummary.paymentIntentId ?? null,
        eventId,
        baseAmountCents: baseAmount,
        feesExcludedCents:
          (saleSummary.platformFeeCents ?? 0) + cardFeeCents + (saleSummary.stripeFeeCents ?? 0),
        reason,
        refundedBy: refundedBy ?? null,
        stripeRefundId: stripeRefundId ?? null,
        auditPayload: auditPayload ?? {},
        refundedAt: new Date(),
      },
    });

    const outbox = await recordOutboxEvent(
      {
        eventType: "refund.created",
        dedupeKey,
        payload: {
          refundId: refund.id,
          purchaseId,
          eventId,
          reason,
        },
      },
      tx,
    );

    await appendEventLog(
      {
        eventId: outbox.eventId,
        organizationId,
        eventType: "refund.created",
        idempotencyKey: outbox.eventId,
        actorUserId: refundedBy ?? null,
        sourceType: SourceType.TICKET_ORDER,
        sourceId: purchaseId,
        correlationId: outbox.eventId,
        payload: {
          refundId: refund.id,
          purchaseId,
          eventId,
          reason,
        },
      },
      tx,
    );

    await appendRefundLedgerEntries({
      paymentId: purchaseId,
      causationId: dedupeKey,
      correlationId: purchaseId,
      tx,
    });

    return refund;
  });
}
