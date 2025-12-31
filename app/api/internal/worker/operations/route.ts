export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripeClient";
import { handleRefund } from "@/app/api/stripe/webhook/route";
import { OperationType } from "../types";
import { refundPurchase } from "@/lib/refunds/refundService";
import { PaymentEventSource, RefundReason, EntitlementType, EntitlementStatus, Prisma } from "@prisma/client";
import { FulfillPayload } from "@/lib/operations/types";
import { fulfillPaidIntent } from "@/lib/operations/fulfillPaid";
import { markSaleDisputed } from "@/domain/finance/disputes";
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
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createNotification } from "@/lib/notifications";
import { NotificationType } from "@prisma/client";
import { applyPromoRedemptionOperation } from "@/lib/operations/applyPromoRedemption";
import { normalizeEmail } from "@/lib/utils/email";

const MAX_ATTEMPTS = 5;
const BATCH_SIZE = 5;
const INTERNAL_HEADER = "X-ORYA-CRON-SECRET";

const RAW_BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "https://app.orya.pt";
const BASE_URL = RAW_BASE_URL.startsWith("http") ? RAW_BASE_URL : `https://${RAW_BASE_URL}`;
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

async function issueEntitlementsForLine(
  tx: Prisma.TransactionClient,
  args: {
    purchaseId: string;
    saleLineId: number;
    event: { id: number; title: string; locationName: string; coverImageUrl: string | null; startsAt: Date; timezone: string };
    quantity: number;
    ownerUserId?: string | null;
    ownerIdentityId?: string | null;
    guestEmail?: string | null;
    type: EntitlementType;
  },
) {
  const ownerKey = buildOwnerKey({
    ownerUserId: args.ownerUserId ?? null,
    ownerIdentityId: args.ownerIdentityId ?? null,
    guestEmail: args.guestEmail ?? null,
  });
  const qty = Math.max(1, Number(args.quantity ?? 0));
  for (let i = 0; i < qty; i++) {
    await tx.entitlement.upsert({
      where: {
        purchaseId_saleLineId_lineItemIndex_ownerKey_type: {
          purchaseId: args.purchaseId,
          saleLineId: args.saleLineId,
          lineItemIndex: i,
          ownerKey,
          type: args.type,
        },
      },
      update: {
        status: EntitlementStatus.ACTIVE,
        ownerUserId: args.ownerUserId ?? null,
        ownerIdentityId: args.ownerIdentityId ?? null,
        eventId: args.event.id,
        snapshotTitle: args.event.title,
        snapshotCoverUrl: args.event.coverImageUrl,
        snapshotVenueName: args.event.locationName,
        snapshotStartAt: args.event.startsAt,
        snapshotTimezone: args.event.timezone,
      },
      create: {
        purchaseId: args.purchaseId,
        saleLineId: args.saleLineId,
        lineItemIndex: i,
        ownerKey,
        ownerUserId: args.ownerUserId ?? null,
        ownerIdentityId: args.ownerIdentityId ?? null,
        eventId: args.event.id,
        type: args.type,
        status: EntitlementStatus.ACTIVE,
        snapshotTitle: args.event.title,
        snapshotCoverUrl: args.event.coverImageUrl,
        snapshotVenueName: args.event.locationName,
        snapshotStartAt: args.event.startsAt,
        snapshotTimezone: args.event.timezone,
      },
    });
  }
}

async function markEntitlementsStatusByPurchase(purchaseId: string, status: EntitlementStatus) {
  await prisma.entitlement.updateMany({
    where: { purchaseId },
    data: { status },
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
          ticketsCount: tpl?.ticketsCount ?? 1,
          ticketUrl: tpl?.ticketUrl ? absUrl(tpl.ticketUrl) : absUrl("/me/carteira"),
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
          ticketUrl: tpl?.ticketUrl ? absUrl(tpl.ticketUrl) : absUrl("/me/carteira"),
        });
        break;
      }
      case "CLAIM_GUEST": {
        await sendClaimEmail({
          to: recipient,
          eventTitle: tpl?.eventTitle ?? "Claim concluído",
          ticketUrl: tpl?.ticketUrl ? absUrl(tpl.ticketUrl) : absUrl("/me/carteira"),
        });
        break;
      }
      case "REFUND": {
        await sendRefundEmail({
          to: recipient,
          eventTitle: tpl?.eventTitle ?? "Refund ORYA",
          amountRefundedBaseCents: tpl?.amountRefundedBaseCents ?? null,
          reason: tpl?.reason ?? null,
          ticketUrl: tpl?.ticketUrl ? absUrl(tpl.ticketUrl) : absUrl("/me/carteira"),
        });
        break;
      }
      case "IMPORTANT_UPDATE": {
        await sendImportantUpdateEmail({
          to: recipient,
          eventTitle: tpl?.eventTitle ?? "Atualização ORYA",
          message: tpl?.message ?? "Atualização relevante sobre o teu acesso.",
          ticketUrl: tpl?.ticketUrl ? absUrl(tpl.ticketUrl) : absUrl("/me/carteira"),
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

function requireInternalSecret(req: NextRequest) {
  const provided = req.headers.get(INTERNAL_HEADER);
  const expected = process.env.ORYA_CRON_SECRET;
  if (!expected || !provided || provided !== expected) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }
  return null;
}

export async function POST(req: NextRequest) {
  const unauthorized = requireInternalSecret(req);
  if (unauthorized) return unauthorized;

  const results = await runOperationsBatch();
  return NextResponse.json({ ok: true, processed: results.length, results }, { status: 200 });
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
    await prisma.operation.update({
      where: { id: op.id },
      data: {
        status: "RUNNING",
        attempts: { increment: 1 },
        lockedAt: now,
        updatedAt: now,
      },
    });

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
    default:
      throw new Error(`Unsupported operationType=${op.operationType}`);
  }
}

async function performPaymentFulfillment(intent: Stripe.PaymentIntent, stripeEventId?: string) {
  const handledService = await fulfillServiceBookingIntent(intent as Stripe.PaymentIntent);
  const handledResale = await fulfillResaleIntent(intent as Stripe.PaymentIntent);
  const handledPadelSplit = await fulfillPadelSplitIntent(intent as Stripe.PaymentIntent, null);
  const handledPadelFull = await fulfillPadelFullIntent(intent as Stripe.PaymentIntent);
  const handledSecondCharge = await fulfillPadelSecondCharge(intent as Stripe.PaymentIntent);
  const handledPaid =
    handledService || handledResale || handledPadelSplit || handledPadelFull || handledSecondCharge
      ? true
      : await fulfillPaidIntent(intent as Stripe.PaymentIntent, stripeEventId);

  return handledService || handledResale || handledPadelSplit || handledPadelFull || handledSecondCharge || handledPaid;
}

async function processStripeEvent(op: OperationRecord) {
  const payload = op.payload || {};
  const eventType = typeof payload.stripeEventType === "string" ? payload.stripeEventType : null;
  if (eventType === "payment_intent.succeeded") {
    const piId =
      op.paymentIntentId ||
      (typeof payload.paymentIntentId === "string" ? payload.paymentIntentId : null);
    if (!piId) throw new Error("Missing paymentIntentId");
    const intent = await stripe.paymentIntents.retrieve(piId, { expand: ["latest_charge"] });
    try {
      const handled = await performPaymentFulfillment(intent as Stripe.PaymentIntent, op.stripeEventId ?? undefined);
      if (!handled) {
        throw new Error("PAYMENT_INTENT_NOT_HANDLED");
      }
      await prisma.paymentEvent.updateMany({
        where: { stripePaymentIntentId: piId },
        data: {
          status: "OK",
          errorMessage: null,
          updatedAt: new Date(),
        },
      });
      return;
    } catch (err) {
      await prisma.paymentEvent.updateMany({
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
    const charge = await stripe.charges.retrieve(chargeId);
    return handleRefund(charge as Stripe.Charge);
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
      ? await stripe.paymentIntents.retrieve(piId, { expand: ["latest_charge"] })
      : await stripe.paymentIntents.retrieve(piId, { expand: ["latest_charge"] });

  try {
    const handled = await performPaymentFulfillment(intent as Stripe.PaymentIntent, op.stripeEventId ?? undefined);
    if (!handled) {
      throw new Error("PAYMENT_INTENT_NOT_HANDLED");
    }
    await prisma.paymentEvent.updateMany({
      where: { stripePaymentIntentId: piId },
      data: {
        status: "OK",
        errorMessage: null,
        updatedAt: new Date(),
      },
    });
  } catch (err) {
    await prisma.paymentEvent.updateMany({
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
  const subtotalCents = Number(payload.subtotalCents ?? 0);
  const discountCents = Number(payload.discountCents ?? 0);
  const platformFeeCents = Number(payload.platformFeeCents ?? 0);
  const feeMode = typeof payload.feeMode === "string" ? (payload.feeMode as string) : null;

  const event = await prisma.event.findUnique({ where: { id: eventId }, include: { ticketTypes: true } });
  if (!event) throw new Error("Event not found");

  const ticketTypeMap = new Map(event.ticketTypes.map((t) => [t.id, t]));

  const saleSummary = await prisma.saleSummary.upsert({
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

  await prisma.saleLine.deleteMany({ where: { saleSummaryId: saleSummary.id } });

  for (const line of lines) {
    const saleLine = await prisma.saleLine.create({
      data: {
        saleSummaryId: saleSummary.id,
        eventId: event.id,
        ticketTypeId: line.ticketTypeId,
        promoCodeId,
        quantity: line.quantity,
        unitPriceCents: line.unitPriceCents,
        discountPerUnitCents: 0,
        grossCents: line.unitPriceCents * line.quantity,
        netCents: 0,
        platformFeeCents,
      },
      select: { id: true },
    });

    const tt = ticketTypeMap.get(line.ticketTypeId);
    if (!tt) continue;

    // Entitlements (SSOT)
    await issueEntitlementsForLine(prisma, {
      purchaseId,
      saleLineId: saleLine.id,
      event: {
        id: event.id,
        title: event.title,
        locationName: event.locationName,
        coverImageUrl: event.coverImageUrl,
        startsAt: event.startsAt,
        timezone: event.timezone,
      } as any,
      quantity: line.quantity,
      ownerUserId: userId,
      ownerIdentityId,
      type: EntitlementType.EVENT_TICKET,
    } as any);

    await prisma.ticketType.update({
      where: { id: tt.id },
      data: { soldQuantity: { increment: line.quantity } },
    });
  }

  // Marcar PaymentEvent como OK (free flow)
  await prisma.paymentEvent.updateMany({
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

  await prisma.paymentEvent.updateMany({
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

  await markEntitlementsStatusByPurchase(purchaseId, EntitlementStatus.REFUNDED);
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
    await markEntitlementsStatusByPurchase(purchaseId, EntitlementStatus.SUSPENDED);
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
    select: { title: true, slug: true, startsAt: true, endsAt: true, locationName: true },
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
    ticketsCount,
    ticketUrl: absUrl("/me/carteira"),
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
    await createNotification({
      userId,
      type: NotificationType.EVENT_SALE,
      title: "Compra confirmada",
      body: eventId ? `A tua compra para o evento ${eventId} foi confirmada.` : "Compra confirmada.",
      ctaUrl: absUrl("/me/carteira"),
      ctaLabel: "Ver bilhetes",
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
