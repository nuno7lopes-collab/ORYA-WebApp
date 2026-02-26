// app/api/stripe/webhook/route.ts
// Stripe webhook ingress (records outbox + delegates to consumers).

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { getStripeWebhookSecret } from "@/lib/stripeKeys";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { respondPlainText } from "@/lib/http/envelope";
import { getRequestContext } from "@/lib/http/requestContext";
import { jsonWrap } from "@/lib/api/wrapResponse";
import {
  EntitlementStatus,
  PadelPairingPaymentStatus,
  PadelPairingSlotStatus,
  PadelPairingStatus,
  PadelRegistrationStatus,
  SourceType,
  PaymentMode,
  PaymentStatus,
  Prisma,
  SaleSummaryStatus,
} from "@prisma/client";
import {
  constructStripeWebhookEvent,
  retrieveCharge,
  retrievePaymentIntent,
} from "@/domain/finance/gateway/stripeGateway";
import crypto from "crypto";
import { logError, logInfo, logWarn } from "@/lib/observability/logger";
import { paymentEventRepo, saleSummaryRepo } from "@/domain/finance/readModelConsumer";
import { appendEventLog } from "@/domain/eventLog/append";
import { makeOutboxDedupeKey } from "@/domain/outbox/dedupe";
import { recordOutboxEvent } from "@/domain/outbox/producer";
import { appendRefundLedgerEntries } from "@/domain/finance/ledgerAdjustments";
import { consumeStripeWebhookEvent } from "@/domain/finance/outbox";
import { FINANCE_OUTBOX_EVENTS } from "@/domain/finance/events";
import { resolveRegistrationStatusFromSlots, upsertPadelRegistrationForPairing } from "@/domain/padelRegistration";
import { performPaymentFulfillment } from "@/lib/operations/performPaymentFulfillment";
const STRIPE_OUTBOX_TYPE = "payment.webhook.received";

const logWebhookInfo = (message: string, context?: Record<string, unknown>) =>
  logInfo("stripe.webhook", { message, ...(context ?? {}) });
const logWebhookWarn = (message: string, context?: Record<string, unknown>) =>
  logWarn("stripe.webhook", { message, ...(context ?? {}) });
const logWebhookError = (message: string, err: unknown, context?: Record<string, unknown>) =>
  logError("stripe.webhook", err, { message, ...(context ?? {}) });

type StripeMetadata = Record<string, string | undefined>;

function extractStripeMetadata(event: Stripe.Event): StripeMetadata {
  const obj = event?.data?.object as unknown as Record<string, unknown> | undefined;
  const metadata = obj?.metadata;
  if (!metadata || typeof metadata !== "object") return {};
  return metadata as StripeMetadata;
}

function parseNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function resolvePaymentIntentId(event: Stripe.Event): string | null {
  const obj = event?.data?.object as any;
  if (!obj || typeof obj !== "object") return null;
  if (typeof obj.id === "string" && event.type.startsWith("payment_intent.")) return obj.id;
  if (typeof obj.payment_intent === "string") return obj.payment_intent;
  if (typeof obj.payment_intent === "object" && typeof obj.payment_intent?.id === "string") return obj.payment_intent.id;
  return null;
}

async function resolveOrganizationIdFromStripeEvent(
  event: Stripe.Event,
  tx = prisma,
): Promise<number | null> {
  const metadata = extractStripeMetadata(event);
  const orgId = parseNumber(metadata.orgId);
  if (orgId) return orgId;

  const stripeAccountId =
    typeof event.account === "string" && event.account.trim() !== ""
      ? event.account.trim()
      : null;
  if (stripeAccountId) {
    const organization = await tx.organization.findFirst({
      where: { stripeAccountId },
      select: { id: true },
    });
    if (organization?.id) return organization.id;
  }

  const paymentId = typeof metadata.paymentId === "string" && metadata.paymentId.trim() !== "" ? metadata.paymentId.trim() : null;
  if (paymentId) {
    const payment = await tx.payment.findUnique({ where: { id: paymentId }, select: { organizationId: true } });
    if (payment?.organizationId) return payment.organizationId;
  }

  const eventId = parseNumber(metadata.eventId);
  if (eventId) {
    const eventRow = await tx.event.findUnique({ where: { id: eventId }, select: { organizationId: true } });
    if (eventRow?.organizationId) return eventRow.organizationId;
  }

  const bookingId = parseNumber(metadata.bookingId);
  if (bookingId) {
    const booking = await tx.booking.findUnique({ where: { id: bookingId }, select: { organizationId: true } });
    if (booking?.organizationId) return booking.organizationId;
  }

  const storeOrderId = parseNumber(metadata.storeOrderId);
  if (storeOrderId) {
    const order = await tx.storeOrder.findUnique({
      where: { id: storeOrderId },
      select: { store: { select: { ownerOrganizationId: true } } },
    });
    if (order?.store?.ownerOrganizationId) return order.store.ownerOrganizationId;
  }

  const storeId = parseNumber(metadata.storeId);
  if (storeId) {
    const store = await tx.store.findUnique({ where: { id: storeId }, select: { ownerOrganizationId: true } });
    if (store?.ownerOrganizationId) return store.ownerOrganizationId;
  }

  return null;
}

async function deadLetterUnresolvedOrgStripeEvent(params: {
  event: Stripe.Event;
  correlationId: string;
  paymentId: string | null;
}) {
  const { event, correlationId, paymentId } = params;
  const now = new Date();
  const safeStripeEvent = JSON.parse(JSON.stringify(event));
  const outbox = await recordOutboxEvent({
    eventType: STRIPE_OUTBOX_TYPE,
    dedupeKey: makeOutboxDedupeKey(STRIPE_OUTBOX_TYPE, event.id),
    payload: {
      stripeEvent: safeStripeEvent,
      stripeEventId: event.id,
      stripeEventType: event.type,
      reasonCode: "ORG_NOT_RESOLVED",
    },
    causationId: event.id,
    correlationId,
  });
  await prisma.outboxEvent.update({
    where: { eventId: outbox.eventId },
    data: {
      deadLetteredAt: now,
      attempts: Math.max(1, outbox.attempts ?? 0),
      nextAttemptAt: null,
      reasonCode: "ORG_NOT_RESOLVED",
      errorClass: "StripeWebhookOrgResolution",
      errorStack: null,
      firstSeenAt: outbox.firstSeenAt ?? now,
      lastSeenAt: now,
    },
  });
  logWebhookError("organization_id_missing_dead_lettered", new Error("ORG_NOT_RESOLVED"), {
    stripeEventId: event.id,
    stripeEventType: event.type,
    stripeAccountId: event.account ?? null,
    orgId: null,
    paymentId,
    correlationId,
  });
}

async function recordStripeWebhookOutbox(event: Stripe.Event) {
  const metadata = extractStripeMetadata(event);
  const correlationId =
    (typeof metadata.purchaseId === "string" && metadata.purchaseId.trim() !== "" && metadata.purchaseId.trim()) ||
    (typeof metadata.paymentId === "string" && metadata.paymentId.trim() !== "" && metadata.paymentId.trim()) ||
    resolvePaymentIntentId(event) ||
    event.id;
  const paymentId =
    (typeof metadata.paymentId === "string" && metadata.paymentId.trim() !== "" && metadata.paymentId.trim()) ||
    (typeof metadata.purchaseId === "string" && metadata.purchaseId.trim() !== "" && metadata.purchaseId.trim()) ||
    null;
  const organizationId = await resolveOrganizationIdFromStripeEvent(event);
  if (!organizationId) {
    await deadLetterUnresolvedOrgStripeEvent({
      event,
      correlationId: correlationId ?? event.id,
      paymentId,
    });
    return { ok: true, deduped: false, deadLettered: true } as const;
  }
  const sourceType = typeof metadata.sourceType === "string" && metadata.sourceType.trim() !== "" ? metadata.sourceType : null;
  const sourceId = typeof metadata.sourceId === "string" && metadata.sourceId.trim() !== "" ? metadata.sourceId : null;
  const paymentIntentId = resolvePaymentIntentId(event);
  const purchaseId = typeof metadata.purchaseId === "string" && metadata.purchaseId.trim() !== "" ? metadata.purchaseId.trim() : null;

  const eventLogId = crypto.randomUUID();
  return prisma.$transaction(async (tx) => {
    const log = await appendEventLog(
      {
        eventId: eventLogId,
        organizationId,
        eventType: STRIPE_OUTBOX_TYPE,
        idempotencyKey: event.id,
        correlationId: correlationId ?? null,
        payload: {
          stripeEventId: event.id,
          stripeEventType: event.type,
          paymentIntentId,
          purchaseId,
          paymentId,
        },
        ...(sourceType && sourceId ? { sourceType, sourceId } : {}),
      },
      tx,
    );
    if (!log) return { ok: true, deduped: true, deadLettered: false };
    const safeStripeEvent = JSON.parse(JSON.stringify(event));
    await recordOutboxEvent(
      {
        eventId: eventLogId,
        eventType: STRIPE_OUTBOX_TYPE,
        dedupeKey: makeOutboxDedupeKey(STRIPE_OUTBOX_TYPE, event.id),
        payload: { stripeEvent: safeStripeEvent, stripeEventId: event.id, stripeEventType: event.type },
        causationId: event.id,
        correlationId: correlationId ?? null,
      },
      tx,
    );
    return { ok: true, deduped: false, deadLettered: false };
  });
}

async function _POST(req: NextRequest) {
  const ctx = getRequestContext(req);
  const logCtx = { requestId: ctx.requestId, correlationId: ctx.correlationId };
  const webhookSecret = getStripeWebhookSecret();
  if (!webhookSecret) {
    logWebhookError("missing_webhook_secret", new Error("STRIPE_WEBHOOK_SECRET_MISSING"), logCtx);
    return respondPlainText(ctx, "Webhook secret not configured", { status: 500 });
  }
  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    logWebhookError("missing_signature_header", new Error("STRIPE_SIGNATURE_MISSING"), logCtx);
    return respondPlainText(ctx, "Missing signature", { status: 400 });
  }

  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = constructStripeWebhookEvent(body, sig, webhookSecret);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown signature validation error";
    logWebhookError("invalid_signature", new Error(message), logCtx);
    return respondPlainText(ctx, "Invalid signature", { status: 400 });
  }

  logWebhookInfo("event_received", {
    id: event.id,
    type: event.type,
    ...logCtx,
  });

  try {
    const outbox = await recordStripeWebhookOutbox(event);
    if (outbox.deduped) {
      logWebhookWarn("duplicate_event_ignored", {
        id: event.id,
        type: event.type,
        ...logCtx,
      });
    }
    if (outbox.deadLettered) {
      logWebhookWarn("event_dead_lettered", {
        id: event.id,
        type: event.type,
        reasonCode: "ORG_NOT_RESOLVED",
        ...logCtx,
      });
    }
  } catch (err) {
    logWebhookError("processing_failed", err, logCtx);
    return respondPlainText(ctx, "WEBHOOK_PROCESSING_ERROR", { status: 500 });
  }

  return jsonWrap(
    {
      ok: true,
      status: "ACK",
      stripeEventId: event.id,
      received: true,
    },
    { status: 200, ctx },
  );
}

export async function handleStripeEvent(event: Stripe.Event) {
  return consumeStripeWebhookEvent(event);
}

export async function fulfillPayment(intent: Stripe.PaymentIntent, stripeEventId?: string) {
  const fulfillment = await performPaymentFulfillment(intent, stripeEventId);
  if (!fulfillment.handled) {
    logWebhookWarn("fulfill_payment.unhandled_intent", {
      intentId: intent.id,
      stripeEventId: stripeEventId ?? null,
    });
  }
}

async function publishPaymentRefunded(params: {
  paymentId: string | null;
  stripeEventId?: string | null;
  source: string;
}) {
  const paymentId = params.paymentId;
  if (!paymentId) return;
  await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({
      where: { id: paymentId },
      select: { status: true, organizationId: true, sourceType: true, sourceId: true },
    });
    if (!payment) return;
    const alreadyRefunded = payment.status === PaymentStatus.REFUNDED;
    if (!alreadyRefunded) {
      await tx.payment.update({
        where: { id: paymentId },
        data: { status: PaymentStatus.REFUNDED },
      });
    }

    if (alreadyRefunded) return;
    const eventLogId = crypto.randomUUID();
    const payload = {
      eventLogId,
      paymentId: params.paymentId,
      status: PaymentStatus.REFUNDED,
      source: params.source,
      eventType: "charge.refunded",
    };
    const idempotencyKey = params.stripeEventId ?? `charge.refunded:${paymentId}`;
    const log = await appendEventLog(
      {
        eventId: eventLogId,
        organizationId: payment.organizationId,
        eventType: FINANCE_OUTBOX_EVENTS.PAYMENT_STATUS_CHANGED,
        idempotencyKey,
        sourceType: payment.sourceType,
        sourceId: payment.sourceId,
        correlationId: params.paymentId,
        payload,
      },
      tx,
    );
    if (!log) return;
    await recordOutboxEvent(
      {
        eventId: eventLogId,
        eventType: FINANCE_OUTBOX_EVENTS.PAYMENT_STATUS_CHANGED,
        dedupeKey: makeOutboxDedupeKey(FINANCE_OUTBOX_EVENTS.PAYMENT_STATUS_CHANGED, idempotencyKey),
        payload,
        causationId: idempotencyKey,
        correlationId: params.paymentId,
      },
      tx,
    );
  });
}

async function handlePadelRegistrationRefund(params: {
  paymentId: string;
  paymentIntentId: string;
  livemode: boolean;
}) {
  const payment = await prisma.payment.findUnique({
    where: { id: params.paymentId },
    select: { sourceType: true, sourceId: true, pricingSnapshotJson: true },
  });
  if (!payment || payment.sourceType !== SourceType.PADEL_REGISTRATION) return false;

  const registration = await prisma.padelRegistration.findUnique({
    where: { id: payment.sourceId },
    select: { id: true, pairingId: true, organizationId: true, eventId: true, status: true },
  });

  const saleSummary = await prisma.saleSummary.findUnique({
    where: { purchaseId: params.paymentId },
    select: { id: true },
  });
  const saleLines = saleSummary?.id
    ? await prisma.saleLine.findMany({
        where: { saleSummaryId: saleSummary.id },
        select: { padelRegistrationLineId: true },
      })
    : [];

  const lineIds = new Set<number>();
  for (const line of saleLines) {
    if (line.padelRegistrationLineId) lineIds.add(line.padelRegistrationLineId);
  }

  if (lineIds.size === 0) {
    const snapshot = (payment.pricingSnapshotJson ?? null) as {
      lineItems?: Array<{ sourceLineId?: string | number | null }>;
    } | null;
    const items = Array.isArray(snapshot?.lineItems) ? snapshot!.lineItems! : [];
    for (const item of items) {
      const raw = item?.sourceLineId;
      const id = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
      if (Number.isFinite(id)) lineIds.add(id);
    }
  }

  const slotIds =
    lineIds.size > 0
      ? (
          await prisma.padelRegistrationLine.findMany({
            where: { id: { in: Array.from(lineIds) } },
            select: { pairingSlotId: true },
          })
        )
          .map((line) => line.pairingSlotId)
          .filter((id): id is number => typeof id === "number")
      : [];

  await prisma.$transaction(async (tx) => {
    await tx.entitlement.updateMany({
      where: { purchaseId: params.paymentId },
      data: { status: EntitlementStatus.REVOKED },
    });

    await paymentEventRepo(tx).updateMany({
      where: { stripePaymentIntentId: params.paymentIntentId },
      data: {
        status: "REFUNDED",
        errorMessage: null,
        updatedAt: new Date(),
        mode: params.livemode ? PaymentMode.LIVE : PaymentMode.TEST,
        isTest: !params.livemode,
      },
    });

    if (saleSummary?.id) {
      await saleSummaryRepo(tx).update({
        where: { id: saleSummary.id },
        data: { status: SaleSummaryStatus.REFUNDED, updatedAt: new Date() },
      });
    }

    if (!registration?.pairingId) {
      if (registration && registration.status !== PadelRegistrationStatus.REFUNDED) {
        await tx.padelRegistration.update({
          where: { id: registration.id },
          data: { status: PadelRegistrationStatus.REFUNDED },
        });
      }
      return;
    }

    if (slotIds.length > 0) {
      await tx.padelPairingSlot.updateMany({
        where: { id: { in: slotIds } },
        data: {
          slotStatus: PadelPairingSlotStatus.CANCELLED,
          paymentStatus: PadelPairingPaymentStatus.UNPAID,
        },
      });
    }

    const pairing = await tx.padelPairing.findUnique({
      where: { id: registration.pairingId },
      select: {
        id: true,
        pairingJoinMode: true,
        partnerInviteToken: true,
        partnerLinkToken: true,
        partnerLinkExpiresAt: true,
        slots: { select: { slotStatus: true, paymentStatus: true } },
      },
    });
    if (!pairing) return;

    const hasPaid = pairing.slots.some((slot) => slot.paymentStatus === PadelPairingPaymentStatus.PAID);
    const nextPairingStatus = hasPaid ? PadelPairingStatus.INCOMPLETE : PadelPairingStatus.CANCELLED;
    const nextRegistrationStatus = hasPaid
      ? resolveRegistrationStatusFromSlots({
          pairingJoinMode: pairing.pairingJoinMode,
          slots: pairing.slots,
        })
      : PadelRegistrationStatus.REFUNDED;

    await tx.padelPairing.update({
      where: { id: pairing.id },
      data: {
        pairingStatus: nextPairingStatus,
        partnerInviteToken: nextPairingStatus === PadelPairingStatus.CANCELLED ? null : pairing.partnerInviteToken,
        partnerLinkToken: nextPairingStatus === PadelPairingStatus.CANCELLED ? null : pairing.partnerLinkToken,
        partnerLinkExpiresAt: nextPairingStatus === PadelPairingStatus.CANCELLED ? null : pairing.partnerLinkExpiresAt,
      },
    });

    await upsertPadelRegistrationForPairing(tx, {
      pairingId: pairing.id,
      organizationId: registration.organizationId,
      eventId: registration.eventId,
      status: nextRegistrationStatus,
      reason: "PAYMENT_REFUNDED",
    });
  });

  return true;
}

export async function handleRefund(charge: Stripe.Charge, opts?: { stripeEventId?: string | null }) {
  const paymentIntentId =
    typeof charge.payment_intent === "string"
      ? charge.payment_intent
      : charge.payment_intent?.id;

  if (!paymentIntentId) {
    logWebhookWarn("handle_refund.payment_intent_missing", { chargeId: charge.id });
    return;
  }

  // Obter metadata do payment intent para identificar PADEL_SPLIT
  const intent = await retrievePaymentIntent(paymentIntentId, { expand: ["latest_charge"] }).catch(() => null);
  const paymentId =
    intent?.metadata?.paymentId ??
    intent?.metadata?.purchaseId ??
    null;

  if (paymentId) {
    const handled = await handlePadelRegistrationRefund({
      paymentId,
      paymentIntentId,
      livemode: charge.livemode,
    });
    if (handled) {
      await publishPaymentRefunded({
        paymentId: paymentId ?? null,
        stripeEventId: opts?.stripeEventId ?? null,
        source: "stripe.webhook",
      });
      return;
    }
  }

  const tickets = await prisma.ticket.findMany({
    where: { stripePaymentIntentId: paymentIntentId },
    select: { id: true, ticketTypeId: true, eventId: true, status: true },
  });

  if (!tickets.length) {
    logWebhookWarn("handle_refund.no_tickets_for_payment_intent", { paymentIntentId });
    return;
  }

  const byType = tickets.reduce<Record<number, number>>((acc, t) => {
    acc[t.ticketTypeId] = (acc[t.ticketTypeId] ?? 0) + 1;
    return acc;
  }, {});

  const ticketTypeIds = Object.keys(byType).map((id) => Number(id));
  const saleSummary = await prisma.saleSummary.findUnique({
    where: { paymentIntentId },
    select: { id: true, promoCodeId: true, purchaseId: true },
  });
  const ticketTypes = await prisma.ticketType.findMany({
    where: { id: { in: ticketTypeIds } },
    select: { id: true, soldQuantity: true },
  });

  const stockUpdates = ticketTypes.map((tt) => {
    const decrementBy = byType[tt.id] ?? 0;
    const newSold = Math.max(0, tt.soldQuantity - decrementBy);
    return prisma.ticketType.update({
      where: { id: tt.id },
      data: { soldQuantity: newSold },
    });
  });

  const ticketIds = tickets.map((t) => t.id);
  const entitlementClauses: Prisma.EntitlementWhereInput[] = [
    { ticketId: { in: ticketIds } },
  ];
  if (saleSummary?.purchaseId) {
    entitlementClauses.push({ purchaseId: saleSummary.purchaseId });
  }
  if (paymentId) {
    entitlementClauses.push({ purchaseId: paymentId });
  }
  const entitlementWhere =
    entitlementClauses.length > 0 ? ({ OR: entitlementClauses } as Prisma.EntitlementWhereInput) : null;

  await prisma.$transaction([
    ...(entitlementWhere
      ? [
          prisma.entitlement.updateMany({
            where: entitlementWhere,
            data: { status: EntitlementStatus.REVOKED },
          }),
        ]
      : []),
    prisma.ticket.updateMany({
      where: { id: { in: ticketIds } },
      data: { status: "REFUNDED" },
    }),
    ...stockUpdates,
    paymentEventRepo(prisma).updateMany({
      where: { stripePaymentIntentId: paymentIntentId },
      data: {
        status: "REFUNDED",
        errorMessage: null,
        updatedAt: new Date(),
        mode: charge.livemode ? PaymentMode.LIVE : PaymentMode.TEST,
        isTest: !charge.livemode,
      },
    }),
    ...(saleSummary?.id
      ? [
          ...(saleSummary.purchaseId
            ? [
                prisma.promoRedemption.deleteMany({
                  where: { purchaseId: saleSummary.purchaseId },
                }),
              ]
            : []),
          saleSummaryRepo(prisma).update({
            where: { id: saleSummary.id },
            data: { status: SaleSummaryStatus.REFUNDED, updatedAt: new Date() },
          }),
        ]
      : []),
  ]);

  await publishPaymentRefunded({
    paymentId: saleSummary?.purchaseId ?? paymentId,
    stripeEventId: opts?.stripeEventId ?? null,
    source: "stripe.webhook",
  });

  const ledgerPaymentId = saleSummary?.purchaseId ?? paymentId ?? null;
  if (ledgerPaymentId) {
    const baseCausationId = saleSummary?.purchaseId
      ? `refund:TICKET_ORDER:${saleSummary.purchaseId}`
      : `refund:${paymentIntentId}`;
    await appendRefundLedgerEntries({
      paymentId: ledgerPaymentId,
      causationId: baseCausationId,
      correlationId: ledgerPaymentId,
    });
  }

  logWebhookInfo("handle_refund.tickets_refunded", {
    paymentIntentId,
    ticketCount: tickets.length,
  });
}
export const POST = withApiEnvelope(_POST);
