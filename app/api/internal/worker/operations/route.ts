// Internal operations worker (outbox + fulfillment).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import Stripe from "stripe";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { retrieveCharge, retrievePaymentIntent } from "@/domain/finance/gateway/stripeGateway";
import { handleRefund } from "@/app/api/stripe/webhook/route";
import { OperationType } from "../types";
import { refundPurchase } from "@/lib/refunds/refundService";
import { PaymentEventSource, RefundReason, EntitlementType, EntitlementStatus, Prisma, NotificationType } from "@prisma/client";
import { EntitlementV7Status, mapV7StatusToLegacy } from "@/lib/entitlements/status";
import { FulfillPayload } from "@/lib/operations/types";
import { fulfillPaidIntent } from "@/lib/operations/fulfillPaid";
import { fulfillStoreOrderIntent } from "@/lib/operations/fulfillStoreOrder";
import { markSaleDisputed } from "@/domain/finance/disputes";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import {
  sendPurchaseConfirmationEmail,
  sendEntitlementDeliveredEmail,
  sendClaimEmail,
  sendRefundEmail,
  sendImportantUpdateEmail,
} from "@/lib/emailSender";
import { fulfillResaleIntent } from "@/lib/operations/fulfillResale";
import { fulfillPadelSplitIntent } from "@/lib/operations/fulfillPadelSplit";
import { fulfillPadelSecondCharge } from "@/lib/operations/fulfillPadelSecondCharge";
import { fulfillPadelFullIntent } from "@/lib/operations/fulfillPadelFull";
import { fulfillServiceBookingIntent } from "@/lib/operations/fulfillServiceBooking";
import { fulfillServiceCreditPurchaseIntent } from "@/lib/operations/fulfillServiceCredits";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createNotification } from "@/lib/notifications";
import { processNotificationOutboxBatch } from "@/domain/notifications/outboxProcessor";
import { applyPromoRedemptionOperation } from "@/lib/operations/applyPromoRedemption";
import { normalizeEmail } from "@/lib/utils/email";
import { getAppBaseUrl } from "@/lib/appBaseUrl";
import { getLatestPolicyVersionForEvent } from "@/lib/checkin/accessPolicy";
import { maybeReconcileStripeFees } from "@/domain/finance/reconciliationTrigger";
import { handleStripeWebhook } from "@/domain/finance/webhook";
import { paymentEventRepo, saleLineRepo, saleSummaryRepo } from "@/domain/finance/readModelConsumer";
import { handleFinanceOutboxEvent } from "@/domain/finance/outbox";
import { sweepPendingProcessorFees } from "@/domain/finance/reconciliationSweep";
import { publishOutboxBatch } from "@/domain/outbox/publisher";
import { consumeOpsFeedBatch } from "@/domain/opsFeed/consumer";
import { handlePadelRegistrationOutboxEvent } from "@/domain/padelRegistrationOutbox";
import { handleLoyaltyOutboxEvent } from "@/domain/loyaltyOutbox";
import { handleTournamentOutboxEvent } from "@/domain/tournaments/outbox";
import { handlePadelOutboxEvent } from "@/domain/padel/outbox";
import { handleOwnerTransferOutboxEvent } from "@/domain/organization/ownerTransferOutbox";
import { consumeAgendaMaterializationEvent } from "@/domain/agendaReadModel/consumer";
import { handleSearchIndexOutboxEvent } from "@/domain/searchIndex/consumer";
import { requireInternalSecret } from "@/lib/security/requireInternalSecret";
import { jsonWrap } from "@/lib/api/wrapResponse";

const MAX_ATTEMPTS = 5;
const BATCH_SIZE = 5;

const BASE_URL = getAppBaseUrl();
const absUrl = (path: string) => (/^https?:\/\//i.test(path) ? path : `${BASE_URL}${path.startsWith("/") ? path : `/${path}`}`);

type OperationRecord = {
  id: number;
  operationType: OperationType | string;
  dedupeKey: string;
  status: string;
  attempts: number;
  payload: Record<string, unknown> | null;
  paymentIntentId: string | null;
  purchaseId: string | null;
  stripeEventId: string | null;
  eventId?: number | null;
};

function buildOwnerKey(params: { ownerUserId?: string | null; ownerIdentityId?: string | null; guestEmail?: string | null }) {
  if (params.ownerUserId) return `user:${params.ownerUserId}`;
  if (params.ownerIdentityId) return `identity:${params.ownerIdentityId}`;
  const guest = normalizeEmail(params.guestEmail);
  if (guest) return `email:${guest}`;
  return "unknown";
}

async function markEntitlementsStatusByPurchase(purchaseId: string, status: EntitlementV7Status) {
  const legacyStatus = mapV7StatusToLegacy(status);
  await prisma.entitlement.updateMany({
    where: { purchaseId },
    data: { status: legacyStatus },
  });
}

async function processClaimGuestPurchase(op: OperationRecord) {
  const payload = op.payload || {};
  const purchaseId =
    op.purchaseId || (typeof payload.purchaseId === "string" ? payload.purchaseId : null);
  const userId = typeof payload.userId === "string" ? payload.userId : null;
  const userEmail = typeof payload.userEmail === "string" ? payload.userEmail : null;

  if (!purchaseId || !userId || !userEmail) {
    throw new Error("CLAIM_GUEST_PURCHASE missing purchaseId/userId/userEmail");
  }

  const normalizedEmail = normalizeEmail(userEmail);

  // Ensure email identity exists/verified
  const identity = await prisma.emailIdentity.upsert({
    where: { emailNormalized: normalizedEmail ?? userEmail },
    update: { userId, emailVerifiedAt: new Date() },
    create: {
      emailNormalized: normalizedEmail ?? userEmail,
      userId,
      emailVerifiedAt: new Date(),
    },
  });

  const newOwnerKey = buildOwnerKey({ ownerUserId: userId });

  await prisma.entitlement.updateMany({
    where: {
      purchaseId,
      ownerUserId: null,
      OR: [
        { ownerIdentityId: identity.id },
        { ownerKey: `email:${normalizedEmail ?? userEmail}` },
      ],
    },
    data: {
      ownerUserId: userId,
      ownerIdentityId: null,
      ownerKey: newOwnerKey,
      updatedAt: new Date(),
    },
  });
}

async function processSendEmailOutbox(op: OperationRecord) {
  const payload = op.payload || {};
  const templateKey = typeof payload.templateKey === "string" ? payload.templateKey : null;
  const recipient = typeof payload.recipient === "string" ? payload.recipient : null;
  const purchaseId =
    op.purchaseId || (typeof payload.purchaseId === "string" ? payload.purchaseId : null);
  const entitlementId =
    typeof payload.entitlementId === "string" ? payload.entitlementId : null;
  const dedupeKey =
    typeof payload.dedupeKey === "string"
      ? payload.dedupeKey
      : templateKey && recipient && purchaseId
        ? `${purchaseId}:${templateKey}:${recipient}`
        : null;

  if (!templateKey || !recipient || !purchaseId || !dedupeKey) {
    throw new Error("SEND_EMAIL_OUTBOX missing fields");
  }

  const fallbackTicketUrl = entitlementId
    ? `/me/bilhetes/${entitlementId}`
    : "/me/carteira?section=wallet";

  await prisma.emailOutbox.upsert({
    where: { dedupeKey },
    update: {},
    create: {
      templateKey,
      recipient,
      purchaseId,
      entitlementId,
      dedupeKey,
      status: "PENDING",
      payload: payload.payload ?? {},
    },
  });

  try {
    const tpl = payload.payload as any;
    switch (templateKey) {
      case "PURCHASE_CONFIRMED":
      case "PURCHASE_CONFIRMED_GUEST": {
        await sendPurchaseConfirmationEmail({
          to: recipient,
          eventTitle: tpl?.eventTitle ?? "Compra ORYA",
          eventSlug: tpl?.eventSlug ?? null,
          startsAt: tpl?.startsAt ?? null,
          endsAt: tpl?.endsAt ?? null,
          locationName: tpl?.locationName ?? null,
          locationCity: tpl?.locationCity ?? null,
          address: tpl?.address ?? null,
          locationSource: tpl?.locationSource ?? null,
          locationFormattedAddress: tpl?.locationFormattedAddress ?? null,
          locationComponents:
            tpl?.locationComponents && typeof tpl.locationComponents === "object"
              ? (tpl.locationComponents as Record<string, unknown>)
              : null,
          locationOverrides:
            tpl?.locationOverrides && typeof tpl.locationOverrides === "object"
              ? (tpl.locationOverrides as Record<string, unknown>)
              : null,
          ticketsCount: tpl?.ticketsCount ?? 1,
          ticketUrl: tpl?.ticketUrl ? absUrl(tpl.ticketUrl) : absUrl(fallbackTicketUrl),
        });
        break;
      }
      case "ENTITLEMENT_DELIVERED":
      case "ENTITLEMENT_DELIVERED_GUEST": {
        await sendEntitlementDeliveredEmail({
          to: recipient,
          eventTitle: tpl?.eventTitle ?? "Entitlement entregue",
          startsAt: tpl?.startsAt ?? null,
          venue: tpl?.locationName ?? null,
          ticketUrl: tpl?.ticketUrl ? absUrl(tpl.ticketUrl) : absUrl(fallbackTicketUrl),
        });
        break;
      }
      case "CLAIM_GUEST": {
        await sendClaimEmail({
          to: recipient,
          eventTitle: tpl?.eventTitle ?? "Claim concluído",
          ticketUrl: tpl?.ticketUrl ? absUrl(tpl.ticketUrl) : absUrl(fallbackTicketUrl),
        });
        break;
      }
      case "REFUND": {
        await sendRefundEmail({
          to: recipient,
          eventTitle: tpl?.eventTitle ?? "Refund ORYA",
          amountRefundedBaseCents: tpl?.amountRefundedBaseCents ?? null,
          reason: tpl?.reason ?? null,
          ticketUrl: tpl?.ticketUrl ? absUrl(tpl.ticketUrl) : absUrl(fallbackTicketUrl),
        });
        break;
      }
      case "IMPORTANT_UPDATE": {
        await sendImportantUpdateEmail({
          to: recipient,
          eventTitle: tpl?.eventTitle ?? "Atualização ORYA",
          message: tpl?.message ?? "Atualização relevante sobre o teu acesso.",
          ticketUrl: tpl?.ticketUrl ? absUrl(tpl.ticketUrl) : absUrl(fallbackTicketUrl),
        });
        break;
      }
      default: {
        console.warn("[SEND_EMAIL_OUTBOX] TemplateKey sem sender mapeado", templateKey);
      }
    }

    await prisma.emailOutbox.update({
      where: { dedupeKey },
      data: { status: "SENT", sentAt: new Date(), errorCode: null },
    });
  } catch (err: any) {
    await prisma.emailOutbox.update({
      where: { dedupeKey },
      data: { status: "FAILED", failedAt: new Date(), errorCode: err?.message ?? "SEND_FAILED" },
    });
    throw err;
  }
}

async function _POST(req: NextRequest) {
  if (!requireInternalSecret(req)) {
    return jsonWrap({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const results = await runOperationsBatch();
  return jsonWrap({ ok: true, processed: results.length, results }, { status: 200 });
}

export async function runOperationsBatch() {
  const now = new Date();
  const pending = await prisma.operation.findMany({
    where: {
      OR: [
        { status: "PENDING" },
        { status: "FAILED", nextRetryAt: { lte: now } },
      ],
    },
    orderBy: { id: "asc" },
    take: BATCH_SIZE,
  });

  const results: Array<{ id: number; status: string; error?: string }> = [];

  for (const op of pending as OperationRecord[]) {
    const now = new Date();
    const claim = await prisma.operation.updateMany({
      where: {
        id: op.id,
        lockedAt: null,
        OR: [
          { status: "PENDING" },
          { status: "FAILED", nextRetryAt: { lte: now } },
        ],
      },
      data: {
        status: "RUNNING",
        attempts: { increment: 1 },
        lockedAt: now,
        updatedAt: now,
      },
    });
    if (claim.count === 0) continue;

    try {
      await processOperation(op);
      await prisma.operation.update({
        where: { id: op.id },
        data: { status: "SUCCEEDED", lastError: null, lockedAt: null, nextRetryAt: null },
      });
      results.push({ id: op.id, status: "SUCCEEDED" });
    } catch (err) {
      const attempts = op.attempts + 1;
      const errorMessage = err instanceof Error ? err.message : String(err);
      const isDead = attempts >= MAX_ATTEMPTS;
      await prisma.operation.update({
        where: { id: op.id },
        data: {
          status: isDead ? "DEAD_LETTER" : "FAILED",
          lastError: errorMessage,
          lockedAt: null,
          nextRetryAt: isDead ? null : new Date(Date.now() + 5 * 60 * 1000),
        },
      });
      results.push({ id: op.id, status: isDead ? "DEAD_LETTER" : "FAILED", error: errorMessage });
    }
  }

  await processNotificationOutboxBatch();
  try {
    await publishOutboxBatch();
  } catch (err) {
    console.warn("[runOperationsBatch] publishOutboxBatch falhou", err);
  }
  try {
    await consumeOpsFeedBatch();
  } catch (err) {
    console.warn("[runOperationsBatch] consumeOpsFeedBatch falhou", err);
  }
  try {
    await sweepPendingProcessorFees();
  } catch (err) {
    console.warn("[runOperationsBatch] sweepPendingProcessorFees falhou", err);
  }
  return results;
}

async function processOperation(op: OperationRecord) {
  switch (op.operationType) {
    case "PROCESS_STRIPE_EVENT":
      return processStripeEvent(op);
    case "FULFILL_PAYMENT":
      return processFulfillPayment(op);
    case "UPSERT_LEDGER_FROM_PI":
    case "UPSERT_LEDGER_FROM_PI_FREE":
      return processUpsertLedger(op);
    case "PROCESS_REFUND_SINGLE":
      return processRefundSingle(op);
    case "MARK_DISPUTE":
      return processMarkDispute(op);
    case "SEND_EMAIL_RECEIPT":
      return processSendEmailReceipt(op);
    case "SEND_NOTIFICATION_PURCHASE":
      return processSendNotificationPurchase(op);
    case "APPLY_PROMO_REDEMPTION":
      return processApplyPromoRedemption(op);
    case "CLAIM_GUEST_PURCHASE":
      return processClaimGuestPurchase(op);
    case "SEND_EMAIL_OUTBOX":
      return processSendEmailOutbox(op);
    case "OUTBOX_EVENT": {
      const payload = op.payload ?? {};
      const eventType = typeof payload.eventType === "string" ? payload.eventType : null;
      const eventPayload =
        payload.payload && typeof payload.payload === "object"
          ? (payload.payload as Record<string, unknown>)
          : {};
      console.info("[outbox.consume]", {
        eventId: typeof payload.eventId === "string" ? payload.eventId : null,
        eventType,
        correlationId: typeof payload.correlationId === "string" ? payload.correlationId : null,
        registrationId:
          typeof (eventPayload as Record<string, unknown>).registrationId === "string"
            ? (eventPayload as Record<string, unknown>).registrationId
            : null,
        attempts: op.attempts,
      });
      if (!eventType) throw new Error("OUTBOX_EVENT_MISSING_TYPE");
      if (eventType.startsWith("payment.")) {
        return handleFinanceOutboxEvent({
          eventType,
          payload: eventPayload as any,
        });
      }
      if (eventType.startsWith("PADREG_")) {
        return handlePadelRegistrationOutboxEvent({
          eventType,
          payload: eventPayload as any,
        });
      }
      if (eventType.startsWith("LOYALTY_")) {
        return handleLoyaltyOutboxEvent({
          eventType,
          payload: eventPayload as any,
        });
      }
      if (eventType.startsWith("TOURNAMENT_")) {
        return handleTournamentOutboxEvent({
          eventType,
          payload: eventPayload as any,
        });
      }
      if (eventType.startsWith("PADEL_")) {
        return handlePadelOutboxEvent({
          eventType,
          payload: eventPayload as any,
        });
      }
      if (
        eventType.startsWith("event.") ||
        eventType.startsWith("tournament.") ||
        eventType.startsWith("reservation.")
      ) {
        const eventId = typeof payload.eventId === "string" ? payload.eventId : null;
        if (!eventId) throw new Error("OUTBOX_EVENT_MISSING_ID");
        return consumeAgendaMaterializationEvent(eventId);
      }
      if (eventType === "AGENDA_ITEM_UPSERT_REQUESTED") {
        const eventId = typeof payload.eventId === "string" ? payload.eventId : null;
        if (!eventId) throw new Error("OUTBOX_EVENT_MISSING_ID");
        return consumeAgendaMaterializationEvent(eventId);
      }
      if (eventType.startsWith("search.index.")) {
        return handleSearchIndexOutboxEvent({
          eventType,
          payload: eventPayload as any,
        });
      }
      if (eventType.startsWith("organization.owner_transfer.")) {
        return handleOwnerTransferOutboxEvent({
          eventType,
          payload: eventPayload as any,
        });
      }
      return { ok: true };
    }
    default:
      throw new Error(`Unsupported operationType=${op.operationType}`);
  }
}

async function performPaymentFulfillment(intent: Stripe.PaymentIntent, stripeEventId?: string) {
  const handledStore = await fulfillStoreOrderIntent(intent as Stripe.PaymentIntent);
  const handledService = await fulfillServiceBookingIntent(intent as Stripe.PaymentIntent);
  const handledCredits = await fulfillServiceCreditPurchaseIntent(intent as Stripe.PaymentIntent);
  const handledResale = await fulfillResaleIntent(intent as Stripe.PaymentIntent);
  const handledPadelSplit = await fulfillPadelSplitIntent(intent as Stripe.PaymentIntent, null);
  const handledPadelFull = await fulfillPadelFullIntent(intent as Stripe.PaymentIntent);
  const handledSecondCharge = await fulfillPadelSecondCharge(intent as Stripe.PaymentIntent);
  const handledPaid =
    handledStore ||
    handledService ||
    handledCredits ||
    handledResale ||
    handledPadelSplit ||
    handledPadelFull ||
    handledSecondCharge
      ? true
      : await fulfillPaidIntent(intent as Stripe.PaymentIntent, stripeEventId);

  return (
    handledStore ||
    handledService ||
    handledCredits ||
    handledResale ||
    handledPadelSplit ||
    handledPadelFull ||
    handledSecondCharge ||
    handledPaid
  );
}

async function processStripeEvent(op: OperationRecord) {
  const payload = op.payload || {};
  const eventType = typeof payload.stripeEventType === "string" ? payload.stripeEventType : null;
  if (eventType === "payment_intent.succeeded") {
    const piId =
      op.paymentIntentId ||
      (typeof payload.paymentIntentId === "string" ? payload.paymentIntentId : null);
    if (!piId) throw new Error("Missing paymentIntentId");
    const intent = await retrievePaymentIntent(piId, { expand: ["latest_charge"] });
    const paymentId =
      typeof intent.metadata?.paymentId === "string" && intent.metadata.paymentId.trim() !== ""
        ? intent.metadata.paymentId.trim()
        : typeof payload.paymentId === "string" && payload.paymentId.trim() !== ""
          ? payload.paymentId.trim()
          : null;
    try {
      const chargeId =
        typeof intent.latest_charge === "string"
          ? intent.latest_charge
          : intent.latest_charge?.id ?? null;
      if (chargeId) {
        const charge = await retrieveCharge(chargeId, { expand: ["balance_transaction"] });
        const balanceTx = charge.balance_transaction as Stripe.BalanceTransaction | null;
        if (balanceTx?.fee != null) {
          await maybeReconcileStripeFees({
            paymentId,
            feeCents: balanceTx.fee,
            balanceTxId: balanceTx.id ?? null,
            stripeEventId: op.stripeEventId ?? null,
          });
        }
      }
    } catch (err) {
      console.warn("[processStripeEvent] reconcile fees falhou", err);
    }
    try {
      const handled = await performPaymentFulfillment(intent as Stripe.PaymentIntent, op.stripeEventId ?? undefined);
      if (!handled) {
        throw new Error("PAYMENT_INTENT_NOT_HANDLED");
      }
      await paymentEventRepo(prisma).updateMany({
        where: { stripePaymentIntentId: piId },
        data: {
          status: "OK",
          errorMessage: null,
          updatedAt: new Date(),
        },
      });
      return;
    } catch (err) {
      await paymentEventRepo(prisma).updateMany({
        where: { stripePaymentIntentId: piId },
        data: {
          status: "ERROR",
          errorMessage: err instanceof Error ? err.message : String(err),
          updatedAt: new Date(),
        },
      });
      throw err;
    }
  }
  if (eventType === "charge.refunded") {
    const chargeId = typeof payload.chargeId === "string" ? payload.chargeId : null;
    if (!chargeId) throw new Error("Missing chargeId");
    const charge = await retrieveCharge(chargeId);
    return handleRefund(charge as Stripe.Charge);
  }
  if (eventType === "dispute.created" || eventType === "dispute.won" || eventType === "dispute.lost" || eventType === "charge.dispute.created") {
    const stripeEventObject =
      typeof payload.stripeEventObject === "object" && payload.stripeEventObject
        ? (payload.stripeEventObject as Record<string, any>)
        : null;
    if (!stripeEventObject) throw new Error("Missing stripeEventObject");
    const objectId = typeof stripeEventObject.id === "string" ? stripeEventObject.id : null;
    if (!objectId) throw new Error("Missing stripeEventObject.id");
    const metadata =
      stripeEventObject.metadata && typeof stripeEventObject.metadata === "object"
        ? (stripeEventObject.metadata as Record<string, string | undefined>)
        : null;
    return handleStripeWebhook({
      id: typeof payload.stripeEventId === "string" ? payload.stripeEventId : op.stripeEventId ?? "unknown",
      type: eventType as any,
      data: { object: { id: objectId, metadata } },
    });
  }
  throw new Error(`Unsupported stripeEventType=${eventType ?? "unknown"}`);
}

async function processFulfillPayment(op: OperationRecord) {
  const payload = (op.payload ?? {}) as Partial<FulfillPayload>;
  const piId =
    op.paymentIntentId ||
    (typeof payload.paymentIntentId === "string" ? payload.paymentIntentId : null);
  if (!piId) throw new Error("Missing paymentIntentId for FULFILL_PAYMENT");

  const intent =
    typeof payload.rawMetadata === "object"
      ? await retrievePaymentIntent(piId, { expand: ["latest_charge"] })
      : await retrievePaymentIntent(piId, { expand: ["latest_charge"] });

  try {
    const handled = await performPaymentFulfillment(intent as Stripe.PaymentIntent, op.stripeEventId ?? undefined);
    if (!handled) {
      throw new Error("PAYMENT_INTENT_NOT_HANDLED");
    }
    await paymentEventRepo(prisma).updateMany({
      where: { stripePaymentIntentId: piId },
      data: {
        status: "OK",
        errorMessage: null,
        updatedAt: new Date(),
      },
    });
  } catch (err) {
    await paymentEventRepo(prisma).updateMany({
      where: { stripePaymentIntentId: piId },
      data: {
        status: "ERROR",
        errorMessage: err instanceof Error ? err.message : String(err),
        updatedAt: new Date(),
      },
    });
    throw err;
  }
}

async function processUpsertLedger(op: OperationRecord) {
  const payload = op.payload || {};
  const purchaseId = op.purchaseId || (typeof payload.purchaseId === "string" ? payload.purchaseId : null);
  const eventId =
    op.eventId ??
    (typeof payload.eventId === "number"
      ? payload.eventId
      : typeof payload.eventId === "string"
        ? Number(payload.eventId)
        : null);

  if (!purchaseId || !eventId) {
    throw new Error("Missing purchaseId or eventId for UPSERT_LEDGER_FROM_PI");
  }

  const lines = Array.isArray(payload.lines)
    ? (payload.lines as Array<{ ticketTypeId: number; quantity: number; unitPriceCents: number; currency?: string }>)
    : [];

  if (!lines.length) throw new Error("No lines to upsert ledger");

  const currency =
    typeof payload.currency === "string"
      ? payload.currency.toUpperCase()
      : typeof payload.currency === "string"
        ? payload.currency.toUpperCase()
        : "EUR";
  const promoCodeId =
    typeof payload.promoCodeId === "number"
      ? payload.promoCodeId
      : typeof payload.promoCodeId === "string"
        ? Number(payload.promoCodeId)
        : null;
  const userId =
    typeof payload.userId === "string"
      ? payload.userId
      : typeof payload.ownerUserId === "string"
        ? payload.ownerUserId
        : null;
  const ownerIdentityId = typeof payload.ownerIdentityId === "string" ? payload.ownerIdentityId : null;
  const guestEmail = typeof payload.guestEmail === "string" ? payload.guestEmail : null;
  const subtotalCents = Number(payload.subtotalCents ?? 0);
  const discountCents = Number(payload.discountCents ?? 0);
  const platformFeeCents = Number(payload.platformFeeCents ?? 0);
  const feeMode = typeof payload.feeMode === "string" ? (payload.feeMode as string) : null;

  const event = await prisma.event.findUnique({ where: { id: eventId }, include: { ticketTypes: true } });
  if (!event) throw new Error("Event not found");

  const ticketTypeMap = new Map(event.ticketTypes.map((t) => [t.id, t]));

  const ownerKey = buildOwnerKey({ ownerUserId: userId, ownerIdentityId, guestEmail });
  const totalSubtotal = lines.reduce(
    (sum, line) => sum + Math.max(0, Number(line.unitPriceCents ?? 0)) * Math.max(1, Number(line.quantity ?? 0)),
    0,
  );

  await prisma.$transaction(async (tx) => {
    const saleSummary = await saleSummaryRepo(tx).upsert({
      where: { paymentIntentId: purchaseId },
      update: {
        eventId: event.id,
        userId,
        ownerUserId: userId,
        ownerIdentityId,
        purchaseId,
        promoCodeId,
        subtotalCents,
        discountCents,
        platformFeeCents,
        stripeFeeCents: 0,
        totalCents: 0,
        netCents: 0,
        feeMode: feeMode as any,
        currency,
      },
      create: {
        paymentIntentId: purchaseId,
        eventId: event.id,
        userId,
        ownerUserId: userId,
        ownerIdentityId,
        purchaseId,
        promoCodeId,
        subtotalCents,
        discountCents,
        platformFeeCents,
        stripeFeeCents: 0,
        totalCents: 0,
        netCents: 0,
        feeMode: feeMode as any,
        currency,
        status: "PAID",
      },
    });

    const existingTickets = await tx.ticket.findMany({
      where: {
        eventId: event.id,
        OR: [{ purchaseId }, { stripePaymentIntentId: purchaseId }],
      },
      select: {
        id: true,
        ticketTypeId: true,
        emissionIndex: true,
        saleSummaryId: true,
        purchaseId: true,
      },
    });

    const ticketsByType = new Map<number, Map<number, typeof existingTickets[number]>>();
    for (const ticket of existingTickets) {
      const index = ticket.emissionIndex ?? 0;
      const typeMap = ticketsByType.get(ticket.ticketTypeId) ?? new Map();
      typeMap.set(index, ticket);
      ticketsByType.set(ticket.ticketTypeId, typeMap);
    }

    await saleLineRepo(tx).deleteMany({ where: { saleSummaryId: saleSummary.id } });

    let remainingDiscount = discountCents;
    let remainingPlatformFee = platformFeeCents;

    for (const [index, line] of lines.entries()) {
      const tt = ticketTypeMap.get(line.ticketTypeId);
      if (!tt) continue;

      const qty = Math.max(1, Number(line.quantity ?? 0));
      const lineSubtotal = Math.max(0, Number(line.unitPriceCents ?? 0)) * qty;
      const isLastLine = index === lines.length - 1;
      const discountForLine = isLastLine
        ? remainingDiscount
        : totalSubtotal > 0
          ? Math.round((discountCents * lineSubtotal) / totalSubtotal)
          : 0;
      remainingDiscount -= discountForLine;
      const platformFeeForLine = isLastLine
        ? remainingPlatformFee
        : totalSubtotal > 0
          ? Math.round((platformFeeCents * lineSubtotal) / totalSubtotal)
          : 0;
      remainingPlatformFee -= platformFeeForLine;
      const discountPerUnitCents = qty > 0 ? Math.floor(discountForLine / qty) : 0;
      const netCents = Math.max(0, lineSubtotal - discountForLine);

      const saleLine = await saleLineRepo(tx).create({
        data: {
          saleSummaryId: saleSummary.id,
          eventId: event.id,
          ticketTypeId: line.ticketTypeId,
          promoCodeId,
          quantity: qty,
          unitPriceCents: line.unitPriceCents,
          discountPerUnitCents,
          grossCents: lineSubtotal,
          netCents,
          platformFeeCents: platformFeeForLine,
        },
        select: { id: true },
      });

      const pricePerTicketCents = Math.round(netCents / Math.max(1, qty));
      const basePlatformFee = Math.floor(platformFeeForLine / Math.max(1, qty));
      let feeRemainder = platformFeeForLine - basePlatformFee * Math.max(1, qty);

      const typeTickets = ticketsByType.get(line.ticketTypeId) ?? new Map();
      const policyVersionApplied = await getLatestPolicyVersionForEvent(event.id, tx);
      let createdCount = 0;

      for (let i = 0; i < qty; i++) {
        let ticket = typeTickets.get(i);
        if (!ticket) {
          const feeForTicket = basePlatformFee + (feeRemainder > 0 ? 1 : 0);
          if (feeRemainder > 0) feeRemainder -= 1;

          const created = await tx.ticket.create({
            data: {
              userId: userId ?? null,
              ownerUserId: userId ?? null,
              ownerIdentityId: ownerIdentityId ?? null,
              eventId: event.id,
              ticketTypeId: line.ticketTypeId,
              status: "ACTIVE",
              purchasedAt: new Date(),
              qrSecret: crypto.randomUUID(),
              pricePaid: pricePerTicketCents,
              currency: tt.currency ?? currency,
              platformFeeCents: feeForTicket,
              totalPaidCents: pricePerTicketCents + feeForTicket,
              stripePaymentIntentId: purchaseId,
              purchaseId,
              saleSummaryId: saleSummary.id,
              emissionIndex: i,
            },
            select: { id: true, ticketTypeId: true, emissionIndex: true, saleSummaryId: true, purchaseId: true },
          });
          ticket = created;
          typeTickets.set(i, ticket);
          createdCount += 1;
        } else {
          if (ticket.saleSummaryId !== saleSummary.id) {
            await tx.ticket.update({
              where: { id: ticket.id },
              data: { saleSummaryId: saleSummary.id },
            });
          }
          if (!ticket.purchaseId && purchaseId) {
            await tx.ticket.update({
              where: { id: ticket.id },
              data: { purchaseId },
            });
          }
        }

        if (!userId && guestEmail) {
          await tx.guestTicketLink.upsert({
            where: { ticketId: ticket.id },
            update: { guestEmail, guestName: "Convidado" },
            create: { ticketId: ticket.id, guestEmail, guestName: "Convidado" },
          });
        }

        await tx.entitlement.upsert({
          where: {
            purchaseId_saleLineId_lineItemIndex_ownerKey_type: {
              purchaseId,
              saleLineId: saleLine.id,
              lineItemIndex: i,
              ownerKey,
              type: EntitlementType.EVENT_TICKET,
            },
          },
          update: {
            status: EntitlementStatus.ACTIVE,
            ownerUserId: userId ?? null,
            ownerIdentityId: ownerIdentityId ?? null,
            eventId: event.id,
            policyVersionApplied,
            snapshotTitle: event.title,
            snapshotCoverUrl: event.coverImageUrl,
            snapshotVenueName: event.locationName,
            snapshotStartAt: event.startsAt,
            snapshotTimezone: event.timezone,
            ticketId: ticket.id,
          },
          create: {
            purchaseId,
            saleLineId: saleLine.id,
            lineItemIndex: i,
            ownerKey,
            ownerUserId: userId ?? null,
            ownerIdentityId: ownerIdentityId ?? null,
            eventId: event.id,
            type: EntitlementType.EVENT_TICKET,
            status: EntitlementStatus.ACTIVE,
            policyVersionApplied,
            snapshotTitle: event.title,
            snapshotCoverUrl: event.coverImageUrl,
            snapshotVenueName: event.locationName,
            snapshotStartAt: event.startsAt,
            snapshotTimezone: event.timezone,
            ticketId: ticket.id,
          },
        });
      }

      ticketsByType.set(line.ticketTypeId, typeTickets);

      if (createdCount > 0) {
        await tx.ticketType.update({
          where: { id: tt.id },
          data: { soldQuantity: { increment: createdCount } },
        });
      }
    }
  });

  // Marcar PaymentEvent como OK (free flow)
  await paymentEventRepo(prisma).updateMany({
    where: { stripePaymentIntentId: purchaseId },
    data: {
      status: "OK",
      source: PaymentEventSource.API,
      purchaseId,
      eventId: event.id,
      userId,
      updatedAt: new Date(),
      errorMessage: null,
    },
  });
}

async function processRefundSingle(op: OperationRecord) {
  const payload = op.payload || {};
  const purchaseId =
    op.purchaseId ||
    (typeof payload.purchaseId === "string" ? payload.purchaseId : null) ||
    (typeof payload.purchaseId === "string" ? payload.purchaseId : null);
  const eventId =
    op.eventId ??
    (typeof payload.eventId === "number"
      ? payload.eventId
      : typeof payload.eventId === "string"
        ? Number(payload.eventId)
        : null);
  const paymentIntentId =
    op.paymentIntentId ||
    (typeof payload.paymentIntentId === "string" ? payload.paymentIntentId : null);
  const reasonRaw = typeof payload.reason === "string" ? payload.reason.toUpperCase() : null;
  const reason: RefundReason = (["CANCELLED", "DELETED", "DATE_CHANGED"] as string[]).includes(
    reasonRaw ?? "",
  )
    ? (reasonRaw as RefundReason)
    : "CANCELLED";
  const refundedBy = typeof payload.refundedBy === "string" ? payload.refundedBy : "system";

  if (!purchaseId || !eventId) {
    throw new Error("Missing purchaseId or eventId for PROCESS_REFUND_SINGLE");
  }

  const res = await refundPurchase({
    purchaseId,
    paymentIntentId,
    eventId,
    reason,
    refundedBy,
    auditPayload: { operationId: op.id },
  });

  if (!res) {
    throw new Error("Refund not created (saleSummary missing or Stripe failure)");
  }

  await paymentEventRepo(prisma).updateMany({
    where: {
      OR: [
        purchaseId ? { purchaseId } : undefined,
        paymentIntentId ? { stripePaymentIntentId: paymentIntentId } : undefined,
      ].filter(Boolean) as any,
    },
    data: {
      status: "REFUNDED",
      errorMessage: null,
      updatedAt: new Date(),
    },
  });

  await markEntitlementsStatusByPurchase(purchaseId, "REVOKED");
}

async function processMarkDispute(op: OperationRecord) {
  const payload = op.payload || {};
  const paymentIntentId =
    op.paymentIntentId ||
    (typeof payload.paymentIntentId === "string" ? payload.paymentIntentId : null);
  const purchaseId =
    op.purchaseId || (typeof payload.purchaseId === "string" ? payload.purchaseId : null);
  const saleSummaryId =
    typeof payload.saleSummaryId === "number"
      ? payload.saleSummaryId
      : typeof payload.saleSummaryId === "string" && Number.isFinite(Number(payload.saleSummaryId))
        ? Number(payload.saleSummaryId)
        : null;
  const reason = typeof payload.reason === "string" ? payload.reason : null;

  if (!saleSummaryId && !paymentIntentId && !purchaseId) {
    throw new Error("MARK_DISPUTE missing identifiers");
  }

  let targetSummaryId = saleSummaryId;
  if (!targetSummaryId) {
    const sale = await prisma.saleSummary.findFirst({
      where: {
        OR: [
          paymentIntentId ? { paymentIntentId } : undefined,
          purchaseId ? { purchaseId } : undefined,
        ].filter(Boolean) as Prisma.SaleSummaryWhereInput[],
      },
      select: { id: true, paymentIntentId: true, purchaseId: true },
    });
    targetSummaryId = sale?.id ?? null;
  }

  if (!targetSummaryId) {
    throw new Error("SaleSummary not found for dispute");
  }

  await markSaleDisputed({
    saleSummaryId: targetSummaryId,
    paymentIntentId,
    purchaseId,
    reason: reason ?? "Dispute received",
  });

  if (purchaseId) {
    await markEntitlementsStatusByPurchase(purchaseId, "SUSPENDED");
  }
}

async function processSendEmailReceipt(op: OperationRecord) {
  const payload = op.payload || {};
  const purchaseId =
    op.purchaseId || (typeof payload.purchaseId === "string" ? payload.purchaseId : null);
  const targetEmailRaw =
    typeof payload.email === "string" ? payload.email : typeof payload.targetEmail === "string" ? payload.targetEmail : null;
  const userId = typeof payload.userId === "string" ? payload.userId : null;

  if (!purchaseId) {
    throw new Error("SEND_EMAIL_RECEIPT missing purchaseId");
  }

  let targetEmail = targetEmailRaw;
  if (!targetEmail && userId) {
    try {
      const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
      if (!error) {
        targetEmail = data.user?.email ?? null;
      }
    } catch {
      // ignore fetch error; will fail below if still missing
    }
  }

  if (!targetEmail) throw new Error("SEND_EMAIL_RECEIPT missing email");

  const sale = await prisma.saleSummary.findFirst({
    where: { OR: [{ purchaseId }, { paymentIntentId: purchaseId }] },
    select: {
      id: true,
      eventId: true,
      purchaseId: true,
      paymentIntentId: true,
      totalCents: true,
      currency: true,
    },
  });
  if (!sale) throw new Error("SaleSummary not found for email receipt");

  const event = await prisma.event.findUnique({
    where: { id: sale.eventId },
    select: {
      title: true,
      slug: true,
      startsAt: true,
      endsAt: true,
      locationName: true,
      locationCity: true,
      address: true,
      locationSource: true,
      locationFormattedAddress: true,
      locationComponents: true,
      locationOverrides: true,
    },
  });
  if (!event) throw new Error("Event not found for email receipt");

  const ticketsCount = await prisma.ticket.count({
    where: { purchaseId: sale.purchaseId ?? sale.paymentIntentId ?? purchaseId },
  });

  await sendPurchaseConfirmationEmail({
    to: targetEmail,
    eventTitle: event.title,
    eventSlug: event.slug,
    startsAt: event.startsAt?.toISOString() ?? null,
    endsAt: event.endsAt?.toISOString() ?? null,
    locationName: event.locationName ?? null,
    locationCity: event.locationCity ?? null,
    address: event.address ?? null,
    locationSource: event.locationSource ?? null,
    locationFormattedAddress: event.locationFormattedAddress ?? null,
    locationComponents:
      event.locationComponents && typeof event.locationComponents === "object"
        ? (event.locationComponents as Record<string, unknown>)
        : null,
    locationOverrides:
      event.locationOverrides && typeof event.locationOverrides === "object"
        ? (event.locationOverrides as Record<string, unknown>)
        : null,
    ticketsCount,
    ticketUrl: absUrl("/me/carteira?section=wallet"),
  });
}

async function processSendNotificationPurchase(op: OperationRecord) {
  const payload = op.payload || {};
  const purchaseId =
    op.purchaseId || (typeof payload.purchaseId === "string" ? payload.purchaseId : null);
  const userId =
    typeof payload.userId === "string" ? payload.userId : typeof payload.targetUserId === "string" ? payload.targetUserId : null;
  const eventId =
    op.eventId ??
    (typeof payload.eventId === "number"
      ? payload.eventId
      : typeof payload.eventId === "string"
        ? Number(payload.eventId)
        : null);

  if (!purchaseId || !userId) throw new Error("SEND_NOTIFICATION_PURCHASE missing purchaseId or userId");

  try {
    const eventTemplate = eventId
      ? await prisma.event.findUnique({ where: { id: eventId }, select: { templateType: true } })
      : null;
    const ticketCtaLabel = eventTemplate?.templateType === "PADEL" ? "Ver inscrições" : "Ver bilhetes";

    await createNotification({
      userId,
      type: NotificationType.EVENT_SALE,
      title: "Compra confirmada",
      body: eventId ? `A tua compra para o evento ${eventId} foi confirmada.` : "Compra confirmada.",
      ctaUrl: absUrl("/me/carteira?section=wallet"),
      ctaLabel: ticketCtaLabel,
      payload: { purchaseId, eventId },
    });
  } catch (err) {
    console.warn("[SEND_NOTIFICATION_PURCHASE] falhou", err);
    throw err;
  }
}

async function processApplyPromoRedemption(op: OperationRecord) {
  const payload = op.payload || {};
  const purchaseId =
    op.purchaseId || (typeof payload.purchaseId === "string" ? payload.purchaseId : null);
  const paymentIntentId =
    op.paymentIntentId ||
    (typeof payload.paymentIntentId === "string" ? payload.paymentIntentId : null);
  const promoCodeId =
    typeof payload.promoCodeId === "number"
      ? payload.promoCodeId
      : typeof payload.promoCodeId === "string"
        ? Number(payload.promoCodeId)
        : null;
  const userId =
    typeof payload.userId === "string" ? payload.userId : null;
  const guestEmail =
    typeof payload.guestEmail === "string" ? payload.guestEmail : null;

  await applyPromoRedemptionOperation({
    purchaseId,
    paymentIntentId,
    promoCodeId,
    userId,
    guestEmail,
  });
}
export const POST = withApiEnvelope(_POST);
