// app/api/stripe/webhook/route.ts
// Stripe webhook ingress (records outbox + delegates to consumers).

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { getAppBaseUrl } from "@/lib/appBaseUrl";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { respondPlainText } from "@/lib/http/envelope";
import { getRequestContext } from "@/lib/http/requestContext";
import { jsonWrap } from "@/lib/api/wrapResponse";
import {
  EntitlementStatus,
  EntitlementType,
  FeeMode,
  PadelPairingPaymentStatus,
  PadelPairingSlotStatus,
  PadelPairingStatus,
  PadelPaymentMode,
  PadelRegistrationStatus,
  PaymentMode,
  PaymentEventSource,
  Prisma,
  PromoType,
  SaleSummaryStatus,
  StoreOrderStatus,
  TicketStatus,
} from "@prisma/client";
import {
  constructStripeWebhookEvent,
  retrieveCharge,
  retrievePaymentIntent,
} from "@/domain/finance/gateway/stripeGateway";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendPurchaseConfirmationEmail } from "@/lib/emailSender";
import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js/min";
import { computeCombinedFees } from "@/lib/fees";
import { getStripeBaseFees } from "@/lib/platformSettings";
import { normalizePaymentScenario } from "@/lib/paymentScenario";
import { checkoutMetadataSchema, normalizeItemsForMetadata, parseCheckoutItems } from "@/lib/checkoutSchemas";
import { paymentEventRepo, saleLineRepo, saleSummaryRepo } from "@/domain/finance/readModelConsumer";
import { computeGraceUntil } from "@/domain/padelDeadlines";
import { appendEventLog } from "@/domain/eventLog/append";
import { recordOutboxEvent } from "@/domain/outbox/producer";
import { consumeStripeWebhookEvent } from "@/domain/finance/outbox";
import { ensureEntriesForConfirmedPairing } from "@/domain/tournaments/ensureEntriesForConfirmedPairing";
import { resolveOwner } from "@/lib/ownership/resolveOwner";
import { mapRegistrationToPairingLifecycle, upsertPadelRegistrationForPairing } from "@/domain/padelRegistration";
import { getLatestPolicyVersionForEvent } from "@/lib/checkin/accessPolicy";
import {
  queuePartnerPaid,
  queueDeadlineExpired,
  queueOffsessionActionRequired,
} from "@/domain/notifications/splitPayments";

const webhookSecret = env.stripeWebhookSecret;
const FREE_PLACEHOLDER_INTENT_ID = "FREE_CHECKOUT";
const STRIPE_OUTBOX_TYPE = "payment.webhook.received";

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
  const orgId = parseNumber(metadata.organizationId);
  if (orgId) return orgId;

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

async function recordStripeWebhookOutbox(event: Stripe.Event) {
  const metadata = extractStripeMetadata(event);
  const correlationId =
    (typeof metadata.purchaseId === "string" && metadata.purchaseId.trim() !== "" && metadata.purchaseId.trim()) ||
    (typeof metadata.paymentId === "string" && metadata.paymentId.trim() !== "" && metadata.paymentId.trim()) ||
    resolvePaymentIntentId(event) ||
    event.id;
  const organizationId = await resolveOrganizationIdFromStripeEvent(event);
  if (!organizationId) {
    console.warn("[Webhook] organizationId em falta, a ignorar outbox", {
      eventId: event.id,
      eventType: event.type,
    });
    return { ok: false, reason: "ORG_NOT_RESOLVED" } as const;
  }
  const sourceType = typeof metadata.sourceType === "string" && metadata.sourceType.trim() !== "" ? metadata.sourceType : null;
  const sourceId = typeof metadata.sourceId === "string" && metadata.sourceId.trim() !== "" ? metadata.sourceId : null;
  const paymentIntentId = resolvePaymentIntentId(event);
  const purchaseId = typeof metadata.purchaseId === "string" && metadata.purchaseId.trim() !== "" ? metadata.purchaseId.trim() : null;
  const paymentId = typeof metadata.paymentId === "string" && metadata.paymentId.trim() !== "" ? metadata.paymentId.trim() : null;

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
    if (!log) return { ok: true, deduped: true };
    await recordOutboxEvent(
      {
        eventId: eventLogId,
        eventType: STRIPE_OUTBOX_TYPE,
        payload: { stripeEventId: event.id, stripeEventType: event.type },
        causationId: event.id,
        correlationId: correlationId ?? null,
      },
      tx,
    );
    return { ok: true, deduped: false };
  });
}

async function _POST(req: NextRequest) {
  const ctx = getRequestContext(req);
  const logCtx = { requestId: ctx.requestId, correlationId: ctx.correlationId };
  if (!webhookSecret) {
    console.error("[Webhook] Missing STRIPE webhook secret", logCtx);
    return respondPlainText(ctx, "Webhook secret not configured", { status: 500 });
  }
  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    console.error("[Webhook] Missing signature header", logCtx);
    return respondPlainText(ctx, "Missing signature", { status: 400 });
  }

  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = constructStripeWebhookEvent(body, sig, webhookSecret);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown signature validation error";
    console.error("[Webhook] Invalid signature:", message, logCtx);
    return respondPlainText(ctx, "Invalid signature", { status: 400 });
  }

  console.log("[Webhook] Event recebido:", {
    id: event.id,
    type: event.type,
    ...logCtx,
  });

  try {
    const outbox = await recordStripeWebhookOutbox(event);
    if (!outbox.ok) {
      return respondPlainText(ctx, "ORG_NOT_RESOLVED", { status: 422 });
    }
    if (outbox.deduped) {
      console.warn("[Webhook] Duplicate event ignored", {
        id: event.id,
        type: event.type,
        ...logCtx,
      });
    }
  } catch (err) {
    console.error("[Webhook] Error processing event:", err, logCtx);
    return respondPlainText(ctx, "WEBHOOK_PROCESSING_ERROR", { status: 500 });
  }

  return jsonWrap({ ok: true, received: true }, { status: 200, ctx });
}

export async function handleStripeEvent(event: Stripe.Event) {
  return consumeStripeWebhookEvent(event);
}

type PromoSnapshot = { code: string; label?: string | null; type: PromoType | null; value: number | null };
async function loadPromoSnapshots(ids: number[]) {
  const promos = await prisma.promoCode.findMany({
    where: { id: { in: ids } },
    select: { id: true, code: true, type: true, value: true },
  });
  const map = new Map<number, PromoSnapshot>();
  promos.forEach((p) => {
    map.set(p.id, { code: p.code, label: p.code, type: p.type, value: p.value });
  });
  return map;
}
type EventWithTickets = Prisma.EventGetPayload<{
  include: { ticketTypes: true };
}>;

type ParsedItem = { ticketTypeId: number; quantity: number };
type BreakdownLine = {
  ticketTypeId: number;
  quantity: number;
  unitPriceCents: number;
  discountPerUnitCents?: number;
  lineTotalCents?: number;
  lineGrossCents?: number;
  lineNetCents?: number;
  platformFeeCents?: number;
  promoCodeId?: number;
};
type BreakdownPayload = {
  lines: BreakdownLine[];
  subtotalCents: number;
  discountCents: number;
  platformFeeCents: number;
  cardPlatformFeeCents?: number;
  cardPlatformFeeBps?: number;
  paymentMethod?: string;
  totalCents: number;
  feeMode?: string;
  currency?: string;
  feeBpsApplied?: number;
  feeFixedApplied?: number;
};

export async function fulfillPayment(intent: Stripe.PaymentIntent, stripeEventId?: string) {
  // [ORYA PATCH v1] Webhook reforçado e preparado para múltiplos bilhetes com total segurança.
  const meta = (intent.metadata ?? {}) as Record<string, string>;
  let parsedBreakdown: BreakdownPayload | null = null;
  if (typeof meta.breakdown === "string") {
    try {
      const parsed = JSON.parse(meta.breakdown);
      if (parsed && Array.isArray(parsed.lines)) {
        parsedBreakdown = {
          lines: parsed.lines as BreakdownLine[],
          subtotalCents: Number(parsed.subtotalCents ?? 0),
          discountCents: Number(parsed.discountCents ?? 0),
          platformFeeCents: Number(parsed.platformFeeCents ?? 0),
          cardPlatformFeeCents: Number(parsed.cardPlatformFeeCents ?? 0),
          cardPlatformFeeBps: Number(parsed.cardPlatformFeeBps ?? 0),
          paymentMethod: typeof parsed.paymentMethod === "string" ? parsed.paymentMethod : undefined,
          totalCents: Number(parsed.totalCents ?? 0),
          feeMode: parsed.feeMode,
          currency: parsed.currency ?? "EUR",
        };
      }
    } catch (err) {
      console.warn("[fulfillPayment] breakdown inválido no metadata", err);
    }
  }

  const paymentScenario = normalizePaymentScenario(
    typeof meta.paymentScenario === "string" ? meta.paymentScenario : null,
  );
  const scenario = typeof (meta as Record<string, unknown>)?.scenario === "string" ? (meta as Record<string, unknown>).scenario : null;
  const hasPadelPairingMeta =
    Number.isFinite(Number((meta as Record<string, unknown>)?.pairingId)) ||
    Number.isFinite(Number((meta as Record<string, unknown>)?.slotId));

  // Resale: processar aqui (deixámos de usar checkout.session.completed)
  if (paymentScenario === "RESALE") {
    const resaleId = typeof meta.resaleId === "string" ? meta.resaleId : null;
    const ticketId = typeof meta.ticketId === "string" ? meta.ticketId : null;
    const buyerUserId = typeof meta.buyerUserId === "string" ? meta.buyerUserId : null;

    if (!resaleId || !ticketId || !buyerUserId) {
      console.error("[fulfillPayment][RESALE] Metadata incompleta", { resaleId, ticketId, buyerUserId, intentId: intent.id });
      return;
    }

    try {
      await prisma.$transaction(async (tx) => {
        const resale = await tx.ticketResale.findUnique({
          where: { id: resaleId },
          include: { ticket: true },
        });

        if (!resale || !resale.ticket) {
          console.error("[fulfillPayment][RESALE] Revenda não encontrada", { resaleId });
          return;
        }

        // Idempotência: se já não estiver LISTED, não repetimos a operação
        if (resale.status !== "LISTED") {
          console.log("[fulfillPayment][RESALE] Revenda já processada ou num estado inválido", {
            resaleId,
            status: resale.status,
          });
          return;
        }

        await tx.ticketResale.update({
          where: { id: resale.id },
          data: {
            status: "SOLD",
            completedAt: new Date(),
          },
        });

        await tx.ticket.update({
          where: { id: resale.ticketId },
          data: {
            userId: buyerUserId,
            status: "ACTIVE",
          },
        });

        const paymentEventAnchor = purchaseId ?? stripeEventId ?? intent.id;
        await paymentEventRepo(tx).upsert({
          where: { purchaseId: paymentEventAnchor },
          update: {
            status: "OK",
            amountCents: intent.amount,
            eventId: resale.ticket.eventId,
            userId: buyerUserId,
            updatedAt: new Date(),
            errorMessage: null,
            mode: intent.livemode ? PaymentMode.LIVE : PaymentMode.TEST,
            isTest: !intent.livemode,
            purchaseId: paymentEventAnchor,
            source: PaymentEventSource.WEBHOOK,
            dedupeKey: paymentEventAnchor,
            attempt: { increment: 1 },
          },
          create: {
            stripePaymentIntentId: intent.id,
            status: "OK",
            amountCents: intent.amount,
            eventId: resale.ticket.eventId,
            userId: buyerUserId,
            mode: intent.livemode ? PaymentMode.LIVE : PaymentMode.TEST,
            isTest: !intent.livemode,
            purchaseId: paymentEventAnchor,
            source: PaymentEventSource.WEBHOOK,
            dedupeKey: paymentEventAnchor,
            attempt: 1,
          },
        });
      });

      console.log("[fulfillPayment][RESALE] processada com sucesso", { resaleId, ticketId, buyerUserId });
    } catch (err) {
      console.error("[fulfillPayment][RESALE] erro", err);
    }

    return;
  }

  const rawUserId = typeof meta.userId === "string" ? meta.userId.trim() : "";
  const rawOwnerUserId = typeof meta.ownerUserId === "string" ? meta.ownerUserId.trim() : "";
  const userId = rawUserId !== "" ? rawUserId : rawOwnerUserId !== "" ? rawOwnerUserId : null;
  const guestEmail =
    typeof meta.guestEmail === "string"
      ? meta.guestEmail.trim().toLowerCase()
      : "";
  const guestName =
    typeof meta.guestName === "string" ? meta.guestName.trim() : "";
  const guestPhoneRaw =
    typeof meta.guestPhone === "string" ? meta.guestPhone.trim() : "";
  const promoCodeId =
    typeof meta.promoCode === "string" && meta.promoCode.trim() !== ""
      ? meta.promoCode.trim()
      : "";
  // Padel SPLIT/FULL: tratar logo aqui e sair
  if (paymentScenario === "GROUP_SPLIT" && hasPadelPairingMeta) {
    await handlePadelSplitPayment(intent, stripeEventId);
    return;
  }
  if (paymentScenario === "GROUP_FULL" && hasPadelPairingMeta) {
    await handlePadelFullPayment(intent, stripeEventId);
    return;
  }
  if (scenario === "GROUP_SPLIT_SECOND_CHARGE") {
    await handleSecondCharge(intent, stripeEventId);
    return;
  }

  const normalizePhone = (phone: string | null | undefined, defaultCountry: CountryCode = "PT") => {
    if (!phone) return null;
    const cleaned = phone.trim();
    if (!cleaned) return null;
    const parsed = parsePhoneNumberFromString(cleaned, defaultCountry);
    if (parsed && parsed.isPossible() && parsed.isValid()) {
      return parsed.number;
    }
    const regexPT = /^(?:\+351)?9[1236]\d{7}$/;
    if (regexPT.test(cleaned)) {
      const digits = cleaned.replace(/[^\d]/g, "");
      return digits.startsWith("351") ? `+${digits}` : `+351${digits}`;
    }
    return null;
  };
  const guestPhone = normalizePhone(guestPhoneRaw);
  const purchaseId =
    typeof meta.purchaseId === "string" && meta.purchaseId.trim() !== ""
      ? meta.purchaseId.trim()
      : null;

  console.log("[fulfillPayment] Início", {
    intentId: intent.id,
    stripeEventId,
    userId,
    purchaseId,
    meta,
  });

  // Segurança extra: só processamos intents que vieram da nossa app
  if (!userId && !guestEmail) {
    console.warn(
      "[fulfillPayment] payment_intent sem userId nem guestEmail em metadata, a ignorar",
      intent.id
    );
    return;
  }

  // --------- PARSE DOS ITENS ---------
  let items: ParsedItem[] = [];

  const parseItemsString = (value: string) => {
    try {
      const parsed = JSON.parse(value);
      const normalized = parseCheckoutItems(parsed);
      if (normalized.length) {
        items = normalized.map((it) => ({
          ticketTypeId: it.ticketTypeId,
          quantity: it.quantity,
        }));
      }
    } catch (err) {
      console.error("[Webhook] Failed to parse metadata.items:", err);
    }
  };

  if (typeof meta.items === "string") parseItemsString(meta.items);
  if (items.length === 0 && typeof meta.itemsJson === "string") parseItemsString(meta.itemsJson);

  if (items.length === 0 && typeof meta.ticketId === "string") {
    const qty = Math.max(1, Number(meta.quantity ?? 1));
    const ticketTypeId = Number(meta.ticketId);
    if (!Number.isNaN(ticketTypeId)) {
      items = [{ ticketTypeId, quantity: qty }];
    }
  }

  if (items.length === 0) {
    console.warn("[fulfillPayment] No items in metadata", meta);
    return;
  }

  console.log("[fulfillPayment] Itens depois do parse:", items);

  // --------- EVENTO ---------
  let eventRecord: EventWithTickets | null = null;

  if (meta.eventId) {
    const idNum = Number(meta.eventId);
    if (!Number.isNaN(idNum)) {
      eventRecord = await prisma.event.findUnique({
        where: { id: idNum },
        include: { ticketTypes: true },
      });
    }
  }

  if (!eventRecord && typeof meta.eventSlug === "string") {
    eventRecord = await prisma.event.findUnique({
      where: { slug: meta.eventSlug },
      include: { ticketTypes: true },
    });
  }

  if (!eventRecord) {
    console.warn("[fulfillPayment] Event not found via metadata:", meta);
    return;
  }

  console.log("[fulfillPayment] Event encontrado:", {
    eventId: eventRecord.id,
    title: eventRecord.title,
  });

  const ticketTypeMap = new Map<number, { price: number; currency: string | null }>(
    eventRecord.ticketTypes.map((t) => [t.id, { price: t.price, currency: t.currency }]),
  );

  let normalizedItems = parsedBreakdown?.lines?.length
    ? normalizeItemsForMetadata(
        parsedBreakdown.lines.map((line) => ({
          ticketTypeId: line.ticketTypeId,
          quantity: Math.max(1, Number(line.quantity ?? 1)),
          unitPriceCents:
            Number(line.unitPriceCents ?? 0) ||
            (ticketTypeMap.get(line.ticketTypeId)?.price ?? 0),
          currency:
            (line as { currency?: string })?.currency ??
            ticketTypeMap.get(line.ticketTypeId)?.currency ??
            "EUR",
        })),
      )
    : [];

  if (!normalizedItems.length) {
    normalizedItems = normalizeItemsForMetadata(
      items.map((item) => {
        const tt = ticketTypeMap.get(item.ticketTypeId);
        return {
          ticketTypeId: item.ticketTypeId,
          quantity: item.quantity,
          unitPriceCents: tt?.price ?? 0,
          currency: tt?.currency ?? "EUR",
        };
      }),
    );
  }

  const metadataValidation = checkoutMetadataSchema.safeParse({
    paymentScenario,
    purchaseId: purchaseId ?? intent.id,
    items: normalizedItems,
    eventId: eventRecord.id,
    eventSlug: eventRecord.slug,
    pairingId: hasPadelPairingMeta ? Number((meta as Record<string, unknown>)?.pairingId ?? 0) || undefined : undefined,
    owner: {
      userId: userId ?? undefined,
      guestEmail: guestEmail || undefined,
      guestName: guestName || undefined,
      guestPhone: guestPhone || undefined,
      ownerUserId: typeof (meta as Record<string, unknown>)?.ownerUserId === "string" ? (meta as Record<string, unknown>)?.ownerUserId : undefined,
      ownerIdentityId:
        typeof (meta as Record<string, unknown>)?.ownerIdentityId === "string"
          ? (meta as Record<string, unknown>)?.ownerIdentityId
          : undefined,
      emailNormalized:
        typeof (meta as Record<string, unknown>)?.emailNormalized === "string"
          ? (meta as Record<string, unknown>)?.emailNormalized
          : undefined,
    },
  });

  if (!metadataValidation.success) {
    console.warn("[fulfillPayment] INVALID_METADATA", {
      intentId: intent.id,
      purchaseId,
      errors: metadataValidation.error.flatten(),
    });
    return;
  }

  const purchaseAnchor = metadataValidation.data.purchaseId;
  const ownerMeta = metadataValidation.data.owner;
  const ownerResolved = await resolveOwner({
    sessionUserId: ownerMeta?.ownerUserId ?? userId ?? undefined,
    guestEmail: ownerMeta?.emailNormalized ?? guestEmail ?? undefined,
  });
  const ownerUserId = ownerResolved.ownerUserId ?? ownerMeta?.ownerUserId ?? userId ?? null;
  const ownerIdentityId = ownerResolved.ownerIdentityId ?? ownerMeta?.ownerIdentityId ?? null;

  const basePlatformFeeCents = Number(meta.platformFeeCents ?? 0);
  const cardPlatformFeeMetaCents = Number(meta.cardPlatformFeeCents ?? 0);
  const platformFeeTotal = basePlatformFeeCents;
  const platformFeeForEvents = basePlatformFeeCents + cardPlatformFeeMetaCents;
  const totalTicketsRequested = items.reduce(
    (sum, item) => sum + Math.max(1, Number(item.quantity ?? 0)),
    0
  );

  const perTicketPlatformFee =
    totalTicketsRequested > 0
      ? Math.floor(platformFeeTotal / totalTicketsRequested)
      : 0;
  let feeRemainder =
    totalTicketsRequested > 0 ? platformFeeTotal % totalTicketsRequested : 0;

  // Pré-calcular valores por linha (gross/net/desconto) para gravar SaleLines e tickets de forma consistente
  const computedLineMap = new Map<
    number,
    {
      grossCents: number;
      netCents: number;
      discountAllocCents: number;
      discountPerUnitCents: number;
      platformFeeCents: number;
      quantity: number;
      unitPriceCents: number;
    }
  >();
  if (parsedBreakdown?.lines?.length) {
    const subtotal = Math.max(0, parsedBreakdown.subtotalCents ?? 0);
    const totalDiscount = Math.max(0, parsedBreakdown.discountCents ?? 0);
    let remainingDiscount = totalDiscount;

    parsedBreakdown.lines.forEach((line, idx) => {
      const qty = Math.max(1, Number(line.quantity ?? 1));
      const linePlatformFee = Number(line.platformFeeCents ?? 0);
      const gross = Number(
        line.lineTotalCents ??
          line.lineGrossCents ??
          (line.unitPriceCents != null ? line.unitPriceCents * qty : 0),
      );

      let alloc = 0;
      if (subtotal > 0 && totalDiscount > 0) {
        const proportional = Math.floor((gross * totalDiscount) / subtotal);
        const isLast = idx === parsedBreakdown.lines.length - 1;
        alloc = isLast ? Math.max(0, remainingDiscount) : Math.min(remainingDiscount, proportional);
      }
      remainingDiscount -= alloc;

      const net = Math.max(0, gross - alloc);
      const unitPrice = Number(line.unitPriceCents ?? Math.round(gross / qty));
      const discountPerUnit = Math.floor(alloc / qty);

      computedLineMap.set(line.ticketTypeId, {
        grossCents: gross,
        netCents: net,
        discountAllocCents: alloc,
        discountPerUnitCents: discountPerUnit,
        platformFeeCents: linePlatformFee,
        quantity: qty,
        unitPriceCents: unitPrice,
      });
    });
  }

  // --------- IDEMPOTÊNCIA (permite múltiplos bilhetes por pagamento) ---------
  const already = await prisma.ticket.findFirst({
    where: { stripePaymentIntentId: intent.id },
  });

  if (already && !process.env.ENABLE_WORKER_PAYMENTS) {
    console.log("[fulfillPayment] INTENT JÁ PROCESSADO — evitando duplicação:", intent.id);
    try {
      await paymentEventRepo(prisma).updateMany({
        where: { stripePaymentIntentId: intent.id },
        data: {
          status: "OK",
          purchaseId: purchaseAnchor,
          stripeEventId: stripeEventId ?? undefined,
          source: PaymentEventSource.WEBHOOK,
          dedupeKey: purchaseAnchor ?? stripeEventId ?? intent.id,
          attempt: { increment: 1 },
          updatedAt: new Date(),
          errorMessage: null,
          mode: intent.livemode ? PaymentMode.LIVE : PaymentMode.TEST,
          isTest: !intent.livemode,
        },
      });
    } catch (logErr) {
      console.warn("[fulfillPayment] Falha ao marcar paymentEvent como OK num retry", logErr);
    }
    return;
  }

  // Marcar log como PROCESSING (idempotência/auditoria)
  try {
    const paymentEventAnchor = purchaseAnchor ?? stripeEventId ?? intent.id;
    const updateData = {
      status: "PROCESSING",
      eventId: eventRecord.id,
      purchaseId: paymentEventAnchor,
      stripeEventId: stripeEventId ?? undefined,
      source: PaymentEventSource.WEBHOOK,
      dedupeKey: paymentEventAnchor,
      attempt: { increment: 1 },
      amountCents: intent.amount ?? null,
      platformFeeCents: platformFeeForEvents ?? null,
      userId,
      errorMessage: null,
      updatedAt: new Date(),
      mode: intent.livemode ? PaymentMode.LIVE : PaymentMode.TEST,
      isTest: !intent.livemode,
    };
    const createData = {
      stripePaymentIntentId: intent.id,
      status: "PROCESSING",
      purchaseId: paymentEventAnchor,
      stripeEventId: stripeEventId ?? undefined,
      source: PaymentEventSource.WEBHOOK,
      dedupeKey: paymentEventAnchor,
      attempt: 1,
      eventId: eventRecord.id,
      userId,
      amountCents: intent.amount ?? null,
      platformFeeCents: platformFeeForEvents ?? null,
      mode: intent.livemode ? PaymentMode.LIVE : PaymentMode.TEST,
      isTest: !intent.livemode,
    };
    const updated = await paymentEventRepo(prisma).updateMany({
      where: purchaseAnchor
        ? { OR: [{ stripePaymentIntentId: intent.id }, { purchaseId: purchaseAnchor }] }
        : { stripePaymentIntentId: intent.id },
      data: updateData,
    });
    if (updated.count === 0) {
      await paymentEventRepo(prisma).upsert({
        where: { purchaseId: paymentEventAnchor },
        update: updateData,
        create: createData,
      });
    }
  } catch (logErr) {
    console.warn("[fulfillPayment] Não foi possível registar paymentEvent", logErr);
  }

  // --------- PREPARAR CRIAÇÃO DE BILHETES + STOCK ---------
  let createdTicketsCount = 0;
  let saleSummaryId: number | null = null;
  const stripeBaseFees = await getStripeBaseFees();
  const estimateStripeFee = (amountCents: number) =>
    Math.max(0, Math.round((amountCents * (stripeBaseFees.feeBps ?? 0)) / 10_000) + (stripeBaseFees.feeFixedCents ?? 0));

  // Sanity-check opcional: garantir que breakdown bate com o amount recebido
  if (parsedBreakdown && typeof intent.amount_received === "number") {
    const combined = computeCombinedFees({
      amountCents: parsedBreakdown.subtotalCents ?? 0,
      discountCents: parsedBreakdown.discountCents ?? 0,
      feeMode: (parsedBreakdown.feeMode as FeeMode | null) ?? FeeMode.ADDED,
      platformFeeBps: parsedBreakdown.feeBpsApplied ?? 0,
      platformFeeFixedCents: parsedBreakdown.feeFixedApplied ?? 0,
      stripeFeeBps: stripeBaseFees.feeBps ?? 0,
      stripeFeeFixedCents: stripeBaseFees.feeFixedCents ?? 0,
    });
    const expectedTotal =
      (combined.totalCents ?? 0) + Math.max(0, parsedBreakdown.cardPlatformFeeCents ?? 0);

    const drift = Math.abs(expectedTotal - intent.amount_received);
    if (drift > 2) {
      console.warn("[fulfillPayment] Divergência entre breakdown.totalCents e amount_received", {
        intentId: intent.id,
        breakdownTotal: parsedBreakdown.totalCents,
        recalculatedTotal: expectedTotal,
        amountReceived: intent.amount_received,
      });
    }
  }

  // Tentar obter a fee real do Stripe via balance_transaction
  let stripeFeeCents: number | null = null;
  try {
    if (intent.latest_charge) {
      const charge = await retrieveCharge(intent.latest_charge as string, {
        expand: ["balance_transaction"],
      });
      const balanceTx = charge.balance_transaction as Stripe.BalanceTransaction | null;
      if (balanceTx?.fee != null) stripeFeeCents = balanceTx.fee;
    }
  } catch (err) {
    console.warn("[fulfillPayment] Não foi possível obter balance_transaction; a usar estimativa", err);
  }

  await prisma.$transaction(async (tx) => {
    // Persistir breakdown se existir
    if (parsedBreakdown) {
      const promoIds = new Set<number>();
      parsedBreakdown.lines.forEach((l) => {
        if (l.promoCodeId) promoIds.add(l.promoCodeId);
      });
      if (promoCodeId && Number.isFinite(Number(promoCodeId))) {
        promoIds.add(Number(promoCodeId));
      }
      const promoSnapshots =
        promoIds.size > 0 ? await loadPromoSnapshots(Array.from(promoIds)) : new Map<number, PromoSnapshot>();
      const summaryPromo =
        promoCodeId && Number.isFinite(Number(promoCodeId))
          ? promoSnapshots.get(Number(promoCodeId)) ?? null
          : null;

      try {
        const feeMode = parsedBreakdown.feeMode as FeeMode | undefined;
        const stripeFee = stripeFeeCents ?? estimateStripeFee(parsedBreakdown.totalCents ?? 0);
        const cardPlatformFeeCents = parsedBreakdown.cardPlatformFeeCents ?? 0;
        const netCents = Math.max(
          0,
          (parsedBreakdown.totalCents ?? 0) -
            (parsedBreakdown.platformFeeCents ?? 0) -
            cardPlatformFeeCents -
            stripeFee,
        );
        const summary = await saleSummaryRepo(tx).upsert({
          where: { paymentIntentId: intent.id },
          update: {
            eventId: eventRecord.id,
            userId: ownerUserId ?? null,
            ownerUserId: ownerUserId ?? null,
            ownerIdentityId: ownerIdentityId ?? null,
            purchaseId: purchaseAnchor,
            promoCodeId: promoCodeId ? Number(promoCodeId) : null,
            promoCodeSnapshot: summaryPromo?.code ?? null,
            promoLabelSnapshot: summaryPromo?.label ?? summaryPromo?.code ?? null,
            promoTypeSnapshot: summaryPromo?.type ?? null,
            promoValueSnapshot: summaryPromo?.value ?? null,
            subtotalCents: parsedBreakdown.subtotalCents,
            discountCents: parsedBreakdown.discountCents,
            platformFeeCents: parsedBreakdown.platformFeeCents,
            cardPlatformFeeCents: cardPlatformFeeCents,
            stripeFeeCents: stripeFee,
            totalCents: parsedBreakdown.totalCents,
            netCents,
            feeMode: feeMode,
            paymentMethod: parsedBreakdown.paymentMethod ?? null,
            currency: parsedBreakdown.currency ?? "EUR",
          },
          create: {
            paymentIntentId: intent.id,
            eventId: eventRecord.id,
            userId: ownerUserId ?? null,
            ownerUserId: ownerUserId ?? null,
            ownerIdentityId: ownerIdentityId ?? null,
            purchaseId: purchaseAnchor,
            promoCodeId: promoCodeId ? Number(promoCodeId) : null,
            promoCodeSnapshot: summaryPromo?.code ?? null,
            promoLabelSnapshot: summaryPromo?.label ?? summaryPromo?.code ?? null,
            promoTypeSnapshot: summaryPromo?.type ?? null,
            promoValueSnapshot: summaryPromo?.value ?? null,
            subtotalCents: parsedBreakdown.subtotalCents,
            discountCents: parsedBreakdown.discountCents,
            platformFeeCents: parsedBreakdown.platformFeeCents,
            cardPlatformFeeCents: cardPlatformFeeCents,
            stripeFeeCents: stripeFee,
            totalCents: parsedBreakdown.totalCents,
            netCents,
            feeMode: feeMode,
            paymentMethod: parsedBreakdown.paymentMethod ?? null,
            currency: parsedBreakdown.currency ?? "EUR",
          },
        });
        saleSummaryId = summary.id;

        // limpar linhas anteriores e regravar
        await saleLineRepo(tx).deleteMany({ where: { saleSummaryId: summary.id } });
        for (const line of parsedBreakdown.lines) {
          const linePromo = line.promoCodeId ? promoSnapshots.get(line.promoCodeId) ?? null : summaryPromo;
          const computed = computedLineMap.get(line.ticketTypeId);
          const grossCents =
            computed?.grossCents ??
            line.lineGrossCents ??
            line.lineTotalCents ??
            (line.unitPriceCents != null && line.quantity != null ? line.unitPriceCents * line.quantity : 0);
          const netCents =
            computed?.netCents ??
            (grossCents != null && parsedBreakdown.discountCents != null && parsedBreakdown.subtotalCents
              ? Math.max(
                  0,
                  grossCents -
                    Math.floor(
                      (grossCents * parsedBreakdown.discountCents) /
                        Math.max(1, parsedBreakdown.subtotalCents),
                    ),
                )
              : grossCents);
          await saleLineRepo(tx).create({
            data: {
              saleSummaryId: summary.id,
              eventId: eventRecord.id,
              ticketTypeId: line.ticketTypeId,
              promoCodeId: line.promoCodeId ?? (promoCodeId ? Number(promoCodeId) : null),
              promoCodeSnapshot: linePromo?.code ?? null,
              promoLabelSnapshot: linePromo?.label ?? linePromo?.code ?? null,
              promoTypeSnapshot: linePromo?.type ?? null,
              promoValueSnapshot: linePromo?.value ?? null,
              quantity: line.quantity,
              unitPriceCents: computed?.unitPriceCents ?? line.unitPriceCents,
              discountPerUnitCents: computed?.discountPerUnitCents ?? line.discountPerUnitCents ?? 0,
              grossCents: grossCents,
              netCents: netCents,
              platformFeeCents: computed?.platformFeeCents ?? line.platformFeeCents ?? 0,
            },
          });
        }
      } catch (err) {
        console.warn("[fulfillPayment] Falha ao persistir saleSummary/saleLines", err);
      }
    }

    if (promoCodeId && saleSummaryId) {
      try {
        const promo = await tx.promoCode.findUnique({
          where: { id: Number(promoCodeId) },
          select: { id: true, maxUses: true, perUserLimit: true },
        });
        // Re-check limites em transação (best-effort contra race)
        const totalUses = await tx.promoRedemption.count({ where: { promoCodeId: Number(promoCodeId) } });
        const userUses =
          ownerUserId || guestEmail
            ? await tx.promoRedemption.count({
                where: {
                  promoCodeId: Number(promoCodeId),
                  OR: [{ userId: ownerUserId ?? undefined }, { guestEmail: guestEmail || undefined }],
                },
              })
            : 0;
        const exceedsGlobal = promo?.maxUses != null && totalUses >= promo.maxUses;
          const exceedsUser = promo?.perUserLimit != null && userUses >= promo.perUserLimit;
          if (!exceedsGlobal && !exceedsUser) {
            try {
              await tx.promoRedemption.upsert({
                where: {
                  purchaseId_promoCodeId: {
                    purchaseId: purchaseAnchor ?? undefined,
                    promoCodeId: Number(promoCodeId),
                  },
                },
                update: {
                  userId: ownerUserId ?? null,
                  guestEmail: guestEmail || null,
                },
                create: {
                  promoCodeId: Number(promoCodeId),
                  userId: ownerUserId ?? null,
                  guestEmail: guestEmail || null,
                  purchaseId: purchaseAnchor ?? null,
                },
              });
            } catch (err) {
              const isUnique =
                err &&
                typeof err === "object" &&
                "code" in err &&
                (err as { code: string }).code === "P2002";
              if (!isUnique) throw err;
              console.warn("[fulfillPayment] promoRedemption unique conflict ignorado", {
                promoCodeId,
                purchaseId: purchaseAnchor ?? null,
                userId: ownerUserId ?? null,
                guestEmail,
              });
            }
        } else {
          console.warn("[fulfillPayment] promoRedemption não criada por limite atingido", {
            promoCodeId,
            totalUses,
            userUses,
          });
        }
      } catch (err) {
        console.warn("[fulfillPayment] Não foi possível registar promo redemption (tx)", err);
      }
    }

    for (const item of items) {
      const ticketType = eventRecord.ticketTypes.find((t) => t.id === item.ticketTypeId);
      if (!ticketType) {
        console.warn("[fulfillPayment] TicketType not found:", item.ticketTypeId);
        continue;
      }

      const qty = Math.max(1, Number(item.quantity ?? 0));
      if (!qty) continue;

      if (
        ticketType.totalQuantity !== null &&
        ticketType.totalQuantity !== undefined
      ) {
        const remaining = ticketType.totalQuantity - ticketType.soldQuantity;
        if (remaining <= 0 || qty > remaining) {
          console.warn("[fulfillPayment] Insufficient stock for:", {
            ticketTypeId: ticketType.id,
            remaining,
            requested: qty,
          });
          continue;
        }
      }

      const existingTickets = await tx.ticket.findMany({
        where: { purchaseId: purchaseAnchor, ticketTypeId: ticketType.id },
        select: { emissionIndex: true },
      });
      const existingIndexes = new Set<number>(existingTickets.map((t) => t.emissionIndex ?? 0));

      for (let i = 0; i < qty; i++) {
        if (existingIndexes.has(i)) {
          continue;
        }
        // Gerar QR seguro para cada bilhete
        const token = crypto.randomUUID();
        const feeForThisTicket =
          perTicketPlatformFee + (feeRemainder > 0 ? 1 : 0);
        if (feeRemainder > 0) feeRemainder -= 1;

        const lineFromBreakdown = parsedBreakdown?.lines.find(
          (l) => l.ticketTypeId === ticketType.id,
        );
        const computedLine = computedLineMap.get(ticketType.id);
        const lineQty = computedLine?.quantity ?? lineFromBreakdown?.quantity ?? qty;
        const lineNetCents =
          computedLine?.netCents ??
          lineFromBreakdown?.lineNetCents ??
          lineFromBreakdown?.lineTotalCents ??
          ticketType.price * lineQty;
        const pricePerTicketCents = Math.round(
          lineNetCents / Math.max(1, lineQty),
        );

        const ticket = await tx.ticket.create({
          data: {
            userId: ownerUserId ?? null,
            ownerUserId: ownerUserId ?? null,
            ownerIdentityId: ownerIdentityId ?? null,
            eventId: eventRecord.id,
            ticketTypeId: ticketType.id,
            status: "ACTIVE",
            purchasedAt: new Date(),
            qrSecret: token,
            pricePaid: pricePerTicketCents,
            currency: ticketType.currency,
            platformFeeCents: feeForThisTicket,
            totalPaidCents: pricePerTicketCents + feeForThisTicket,
            stripePaymentIntentId: intent.id,
            purchaseId: purchaseAnchor ?? intent.id,
            saleSummaryId: saleSummaryId ?? null,
            emissionIndex: i,
          },
        });

        if (!ownerUserId && guestEmail) {
          await tx.guestTicketLink.upsert({
            where: { ticketId: ticket.id },
            update: {
              guestEmail,
              guestName: guestName || "Convidado",
              guestPhone: guestPhone || null,
            },
            create: {
              ticketId: ticket.id,
              guestEmail,
              guestName: guestName || "Convidado",
              guestPhone: guestPhone || null,
            },
          });
        }

        createdTicketsCount += 1;
      }

      await tx.ticketType.update({
        where: { id: ticketType.id },
        data: {
          soldQuantity: { increment: qty },
        },
      });
    }

    if (createdTicketsCount === 0) {
      // Nada criado, marcamos paymentEvent como erro
      await paymentEventRepo(tx).updateMany({
        where: { stripePaymentIntentId: intent.id },
        data: {
          status: "ERROR",
          errorMessage: "Nenhum bilhete processado (stock/itens inválidos).",
          purchaseId: purchaseAnchor,
          stripeEventId: stripeEventId ?? undefined,
          source: PaymentEventSource.WEBHOOK,
          dedupeKey: purchaseAnchor ?? stripeEventId ?? intent.id,
          attempt: { increment: 1 },
          updatedAt: new Date(),
        },
      });
      return;
    }

    // Reservas apenas se a compra foi feita com sessão (guest não cria reservas)
    if (ownerUserId) {
      await tx.ticketReservation.updateMany({
        where: {
          eventId: eventRecord.id,
          userId: ownerUserId,
          status: "ACTIVE",
        },
        data: { status: "COMPLETED" },
      });
    }

    await paymentEventRepo(tx).updateMany({
      where: { stripePaymentIntentId: intent.id },
      data: {
        status: "OK",
        updatedAt: new Date(),
        errorMessage: null,
        purchaseId: purchaseAnchor,
        stripeEventId: stripeEventId ?? undefined,
        source: PaymentEventSource.WEBHOOK,
        dedupeKey: purchaseAnchor ?? stripeEventId ?? intent.id,
        attempt: { increment: 1 },
      },
    });
  });

  if (createdTicketsCount === 0) {
    console.warn("[fulfillPayment] No valid items to process");
    return;
  }

  console.log("[fulfillPayment] OK, items processados:", {
    intentId: intent.id,
    userId,
    items,
  });

  // Enviar email de confirmação (best-effort)
  const targetEmail = userId ? await fetchUserEmail(userId) : guestEmail || null;
  if (targetEmail) {
    const baseUrl = getAppBaseUrl();

    try {
      await sendPurchaseConfirmationEmail({
        to: targetEmail,
        eventTitle: eventRecord.title,
        eventSlug: eventRecord.slug,
        startsAt: eventRecord.startsAt?.toISOString() ?? null,
        endsAt: eventRecord.endsAt?.toISOString() ?? null,
        locationName: eventRecord.locationName ?? null,
        locationCity: eventRecord.locationCity ?? null,
        address: eventRecord.address ?? null,
        locationSource: eventRecord.locationSource ?? null,
        locationFormattedAddress: eventRecord.locationFormattedAddress ?? null,
        locationComponents:
          eventRecord.locationComponents && typeof eventRecord.locationComponents === "object"
            ? (eventRecord.locationComponents as Record<string, unknown>)
            : null,
        locationOverrides:
          eventRecord.locationOverrides && typeof eventRecord.locationOverrides === "object"
            ? (eventRecord.locationOverrides as Record<string, unknown>)
            : null,
        ticketsCount: createdTicketsCount,
        ticketUrl: userId ? `${baseUrl}/me/carteira?section=wallet` : `${baseUrl}/`,
      });
      console.log("[fulfillPayment] Email de confirmação enviado para", targetEmail);
    } catch (emailErr) {
      console.error("[fulfillPayment] Falha ao enviar email de confirmação", emailErr);
    }
  } else {
    console.warn("[fulfillPayment] Email do comprador não encontrado para envio de recibo");
  }

  return;
}

async function fetchUserEmail(userId: string) {
  try {
    const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (error) {
      console.warn("[fetchUserEmail] erro ao obter user", error);
      return null;
    }
    return data.user?.email ?? null;
  } catch (err) {
    console.warn("[fetchUserEmail] erro inesperado", err);
    return null;
  }
}

async function handlePadelSplitPayment(intent: Stripe.PaymentIntent, stripeEventId?: string) {
  const meta = (intent.metadata ?? {}) as Record<string, string>;
  const pairingId = Number(meta.pairingId);
  const slotId = Number(meta.slotId);
  const ticketTypeId = Number(meta.ticketTypeId);
  const eventId = Number(meta.eventId);
  const userId =
    typeof meta.userId === "string"
      ? meta.userId
      : typeof meta.ownerUserId === "string"
        ? meta.ownerUserId
        : null;
  const purchaseId =
    typeof meta.purchaseId === "string" && meta.purchaseId.trim() !== ""
      ? meta.purchaseId.trim()
      : null;

  if (!Number.isFinite(pairingId) || !Number.isFinite(slotId) || !Number.isFinite(ticketTypeId) || !Number.isFinite(eventId)) {
    console.warn("[handlePadelSplitPayment] metadata incompleta", meta);
    return;
  }

  const ticketType = await prisma.ticketType.findUnique({
    where: { id: ticketTypeId },
    select: { id: true, price: true, currency: true, soldQuantity: true, totalQuantity: true, eventId: true },
  });
  if (!ticketType || ticketType.eventId !== eventId) {
    console.warn("[handlePadelSplitPayment] ticketType inválido", { ticketTypeId, eventId });
    return;
  }

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      title: true,
      coverImageUrl: true,
      locationName: true,
      startsAt: true,
      timezone: true,
    },
  });
  if (!event) {
    console.warn("[handlePadelSplitPayment] evento inválido", { eventId });
    return;
  }

  const amountCents = intent.amount_received ?? intent.amount ?? ticketType.price;
  let stripeFeeForIntentValue = 0;
  try {
    if (intent.latest_charge) {
      const charge = await retrieveCharge(intent.latest_charge as string, {
        expand: ["balance_transaction"],
      });
      const balanceTx = charge.balance_transaction as Stripe.BalanceTransaction | null;
      if (balanceTx?.fee != null) stripeFeeForIntentValue = balanceTx.fee;
    }
  } catch (err) {
    console.warn("[handlePadelSplitPayment] Não foi possível obter balance_transaction; a usar estimativa", err);
  }
  if (!stripeFeeForIntentValue) {
    const stripeBaseFees = await getStripeBaseFees();
    stripeFeeForIntentValue = Math.max(
      0,
      Math.round((amountCents * (stripeBaseFees.feeBps ?? 0)) / 10_000) + (stripeBaseFees.feeFixedCents ?? 0),
    );
  }

  if (ticketType.totalQuantity !== null && ticketType.totalQuantity !== undefined) {
    const remaining = ticketType.totalQuantity - ticketType.soldQuantity;
    if (remaining < 1) {
      console.warn("[handlePadelSplitPayment] stock insuficiente", {
        ticketTypeId,
        remaining,
        pairingId,
      });
      await prisma.$transaction(async (tx) => {
        const updated = await tx.padelPairing.update({
          where: { id: pairingId },
          data: {
            pairingStatus: PadelPairingStatus.CANCELLED,
            guaranteeStatus: "FAILED",
          },
          select: { id: true, eventId: true, organizationId: true },
        });
        await upsertPadelRegistrationForPairing(tx, {
          pairingId: updated.id,
          organizationId: updated.organizationId,
          eventId: updated.eventId,
          status: PadelRegistrationStatus.CANCELLED,
          reason: "STOCK_INSUFFICIENT",
        });
        await tx.padelPairingHold.updateMany({
          where: { pairingId, status: "ACTIVE" },
          data: { status: "CANCELLED" },
        });
        const paymentEventAnchor = purchaseId ?? stripeEventId ?? intent.id;
        await paymentEventRepo(tx).upsert({
          where: { purchaseId: paymentEventAnchor },
          update: {
            status: "ERROR",
            errorMessage: "Stock insuficiente para completar inscrição Padel.",
            updatedAt: new Date(),
            purchaseId: paymentEventAnchor,
            source: PaymentEventSource.WEBHOOK,
            dedupeKey: paymentEventAnchor,
            attempt: { increment: 1 },
          },
          create: {
            stripePaymentIntentId: intent.id,
            status: "ERROR",
            amountCents: intent.amount,
            eventId,
            userId: userId ?? undefined,
            purchaseId: paymentEventAnchor,
            errorMessage: "Stock insuficiente para completar inscrição Padel.",
            source: PaymentEventSource.WEBHOOK,
            dedupeKey: paymentEventAnchor,
            attempt: 1,
            mode: intent.livemode ? PaymentMode.LIVE : PaymentMode.TEST,
            isTest: !intent.livemode,
          },
        });
      });
      return;
    }
  }

  const qrSecret = crypto.randomUUID();
  const rotatingSeed = crypto.randomUUID();
  await prisma.$transaction(async (tx) => {
    const pairing = await tx.padelPairing.findUnique({
      where: { id: pairingId },
      include: { slots: true },
    });
    if (!pairing || pairing.payment_mode !== PadelPaymentMode.SPLIT) {
      throw new Error("PAIRING_NOT_SPLIT");
    }
    if (pairing.pairingStatus === "CANCELLED") {
      throw new Error("PAIRING_CANCELLED");
    }
    const slot = pairing.slots.find((s) => s.id === slotId);
    if (!slot) throw new Error("SLOT_NOT_FOUND");
    if (slot.paymentStatus === PadelPairingPaymentStatus.PAID) {
      // já processado
      return;
    }

    // cria ticket para o slot
    const ticket = await tx.ticket.create({
      data: {
        eventId,
        ticketTypeId,
        pricePaid: ticketType.price,
        totalPaidCents: amountCents,
        currency: ticketType.currency || intent.currency.toUpperCase(),
        stripePaymentIntentId: intent.id,
        purchaseId: purchaseId ?? intent.id,
        status: "ACTIVE",
        qrSecret,
        rotatingSeed,
        userId: userId ?? undefined,
        ownerUserId: userId ?? null,
        ownerIdentityId: null,
        pairingId,
        padelSplitShareCents: ticketType.price,
        emissionIndex: 0,
      },
    });

    await tx.ticketType.update({
      where: { id: ticketTypeId },
      data: { soldQuantity: ticketType.soldQuantity + 1 },
    });

    const saleSummary =
      (purchaseId
        ? await tx.saleSummary.findUnique({ where: { purchaseId } })
        : null) ||
      (await tx.saleSummary.findUnique({ where: { paymentIntentId: intent.id } }));

    const summaryData = {
      eventId,
      userId: userId ?? null,
      ownerUserId: userId ?? null,
      ownerIdentityId: null,
      purchaseId: purchaseId ?? intent.id,
      subtotalCents: ticketType.price,
      discountCents: 0,
      platformFeeCents: 0,
      stripeFeeCents: stripeFeeForIntentValue,
      totalCents: amountCents,
      netCents: amountCents,
      feeMode: null as any,
      currency: (ticketType.currency || intent.currency || "EUR").toUpperCase(),
      status: "PAID" as const,
    };

    const sale = saleSummary
      ? await saleSummaryRepo(tx).update({
          where: { id: saleSummary.id },
          data: { ...summaryData, paymentIntentId: intent.id },
        })
      : await saleSummaryRepo(tx).create({
          data: { ...summaryData, paymentIntentId: intent.id },
        });

    await saleLineRepo(tx).deleteMany({ where: { saleSummaryId: sale.id } });
    const saleLine = await saleLineRepo(tx).create({
      data: {
        saleSummaryId: sale.id,
        eventId,
        ticketTypeId: ticketType.id,
        promoCodeId: null,
        quantity: 1,
        unitPriceCents: ticketType.price,
        discountPerUnitCents: 0,
        grossCents: amountCents,
        netCents: amountCents,
        platformFeeCents: 0,
      },
    });

    await tx.ticket.update({
      where: { id: ticket.id },
      data: { saleSummaryId: sale.id },
    });

    const policyVersionApplied = await getLatestPolicyVersionForEvent(eventId, tx);
    const ownerKey = userId ? `user:${userId}` : "unknown";
    const entitlementPurchaseId = sale.purchaseId ?? sale.paymentIntentId ?? intent.id;
    await tx.entitlement.upsert({
      where: {
        purchaseId_saleLineId_lineItemIndex_ownerKey_type: {
          purchaseId: entitlementPurchaseId,
          saleLineId: saleLine.id,
          lineItemIndex: 0,
          ownerKey,
          type: EntitlementType.PADEL_ENTRY,
        },
      },
      update: {
        status: EntitlementStatus.ACTIVE,
        ownerUserId: userId ?? null,
        ownerIdentityId: null,
        eventId,
        policyVersionApplied,
        snapshotTitle: event.title,
        snapshotCoverUrl: event.coverImageUrl,
        snapshotVenueName: event.locationName,
        snapshotStartAt: event.startsAt,
        snapshotTimezone: event.timezone,
        ticketId: ticket.id,
      },
      create: {
        purchaseId: entitlementPurchaseId,
        saleLineId: saleLine.id,
        lineItemIndex: 0,
        ownerKey,
        ownerUserId: userId ?? null,
        ownerIdentityId: null,
        type: EntitlementType.PADEL_ENTRY,
        status: EntitlementStatus.ACTIVE,
        eventId,
        policyVersionApplied,
        snapshotTitle: event.title,
        snapshotCoverUrl: event.coverImageUrl,
        snapshotVenueName: event.locationName,
        snapshotStartAt: event.startsAt,
        snapshotTimezone: event.timezone,
        ticketId: ticket.id,
      },
    });

    const now = new Date();
    const shouldSetPartner =
      slot.slot_role === "PARTNER" &&
      userId &&
      pairing.player1UserId !== userId &&
      (!pairing.player2UserId || pairing.player2UserId === userId);
    const shouldFillSlot = slot.slot_role === "PARTNER" ? shouldSetPartner : Boolean(userId);

    const updated = await tx.padelPairing.update({
      where: { id: pairingId },
      data: {
        ...(shouldSetPartner
          ? {
              player2UserId: userId ?? undefined,
              partnerInviteToken: null,
              partnerLinkToken: null,
              partnerInviteUsedAt: now,
              partnerAcceptedAt: now,
              partnerPaidAt: now,
            }
          : {}),
        slots: {
          update: {
            where: { id: slotId },
            data: {
              ticketId: ticket.id,
              profileId: shouldFillSlot ? userId ?? undefined : undefined,
              paymentStatus: PadelPairingPaymentStatus.PAID,
              slotStatus: shouldFillSlot ? PadelPairingSlotStatus.FILLED : slot.slotStatus,
            },
          },
        },
      },
      include: { slots: true },
    });

    const allPaid = updated.slots.every((s) => s.paymentStatus === PadelPairingPaymentStatus.PAID);
    const nextRegistrationStatus = allPaid
      ? PadelRegistrationStatus.CONFIRMED
      : PadelRegistrationStatus.PENDING_PAYMENT;

    await upsertPadelRegistrationForPairing(tx, {
      pairingId,
      organizationId: updated.organizationId,
      eventId: updated.eventId,
      status: nextRegistrationStatus,
      paymentMode: updated.payment_mode,
      isFullyPaid: allPaid,
      reason: "PAYMENT_WEBHOOK",
    });

    const stillPending = updated.slots.some((s) => s.slotStatus === "PENDING" || s.paymentStatus === "UNPAID");
    if (!stillPending && updated.pairingStatus !== "COMPLETE") {
      const confirmed = await tx.padelPairing.update({
        where: { id: pairingId },
        data: { pairingStatus: "COMPLETE" },
        select: { id: true, player1UserId: true, player2UserId: true },
      });
      await ensureEntriesForConfirmedPairing(confirmed.id);
      const captainUserId = confirmed.player1UserId ?? userId ?? undefined;
      if (captainUserId) {
        await queuePartnerPaid(pairingId, captainUserId, userId ?? undefined);
      }
    }

    // log payment_event
    const paymentEventAnchor = purchaseId ?? stripeEventId ?? intent.id;
    await paymentEventRepo(tx).upsert({
      where: { purchaseId: paymentEventAnchor },
      update: {
        status: "OK",
        amountCents: intent.amount,
        eventId,
        userId: userId ?? undefined,
        updatedAt: new Date(),
        errorMessage: null,
        mode: intent.livemode ? PaymentMode.LIVE : PaymentMode.TEST,
        isTest: !intent.livemode,
        stripeFeeCents: stripeFeeForIntentValue,
        purchaseId: paymentEventAnchor,
        source: PaymentEventSource.WEBHOOK,
        dedupeKey: paymentEventAnchor,
        attempt: { increment: 1 },
      },
      create: {
        stripePaymentIntentId: intent.id,
        status: "OK",
        amountCents: intent.amount,
        eventId,
        userId: userId ?? undefined,
        mode: intent.livemode ? PaymentMode.LIVE : PaymentMode.TEST,
        isTest: !intent.livemode,
        stripeFeeCents: stripeFeeForIntentValue,
        purchaseId: paymentEventAnchor,
        source: PaymentEventSource.WEBHOOK,
        dedupeKey: paymentEventAnchor,
        attempt: 1,
      },
    });
  });
}

async function handleSecondCharge(intent: Stripe.PaymentIntent, stripeEventId?: string) {
  const meta = (intent.metadata ?? {}) as Record<string, string>;
  const pairingId = Number(meta.pairingId);
  if (!Number.isFinite(pairingId)) {
    console.warn("[handleSecondCharge] pairingId ausente no metadata", meta);
    return;
  }
  const now = new Date();

  if (intent.status === "succeeded") {
    await prisma.$transaction(async (tx) => {
      await tx.padelPairingSlot.updateMany({
        where: { pairingId, slotStatus: { in: ["PENDING", "FILLED"] } },
        data: { paymentStatus: PadelPairingPaymentStatus.PAID },
      });
      const slots = await tx.padelPairingSlot.findMany({
        where: { pairingId },
        select: { slotStatus: true },
      });
      const allFilled = slots.length > 0 && slots.every((slot) => slot.slotStatus === "FILLED");
      const pairingStatus = allFilled ? PadelPairingStatus.COMPLETE : PadelPairingStatus.INCOMPLETE;
      const confirmed = await tx.padelPairing.update({
        where: { id: pairingId },
        data: {
          pairingStatus,
          guaranteeStatus: "SUCCEEDED",
          secondChargePaymentIntentId: intent.id,
          captainSecondChargedAt: now,
          partnerPaidAt: now,
          graceUntilAt: null,
        },
      });
      await upsertPadelRegistrationForPairing(tx, {
        pairingId,
        organizationId: confirmed.organizationId,
        eventId: confirmed.eventId,
        status: PadelRegistrationStatus.CONFIRMED,
        paymentMode: confirmed.payment_mode,
        secondChargeConfirmed: true,
        reason: "SECOND_CHARGE_CONFIRMED",
      });
      if (allFilled) {
        await ensureEntriesForConfirmedPairing(confirmed.id);
      }
      await tx.padelPairingHold.updateMany({
        where: { pairingId, status: "ACTIVE" },
        data: { status: "CANCELLED" },
      });
      const paymentEventAnchor =
        ((meta as Record<string, unknown>)?.purchaseId as string | undefined) ?? stripeEventId ?? intent.id;
      await paymentEventRepo(tx).upsert({
        where: { purchaseId: paymentEventAnchor },
        update: {
          status: "OK",
          updatedAt: now,
          amountCents: intent.amount,
          purchaseId: paymentEventAnchor,
          stripeFeeCents: 0,
          source: PaymentEventSource.WEBHOOK,
          dedupeKey: paymentEventAnchor,
          attempt: { increment: 1 },
        },
        create: {
          stripePaymentIntentId: intent.id,
          status: "OK",
          amountCents: intent.amount,
          eventId: Number(meta.eventId) || undefined,
          userId: typeof meta.userId === "string" ? meta.userId : undefined,
          purchaseId: paymentEventAnchor,
          source: PaymentEventSource.WEBHOOK,
          dedupeKey: paymentEventAnchor,
          attempt: 1,
          stripeFeeCents: 0,
          mode: intent.livemode ? PaymentMode.LIVE : PaymentMode.TEST,
          isTest: !intent.livemode,
        },
      });
    });
    return;
  }

  if (intent.status === "requires_action") {
    await prisma.padelPairing.update({
      where: { id: pairingId },
      data: {
        guaranteeStatus: "REQUIRES_ACTION",
        graceUntilAt: computeGraceUntil(now),
        secondChargePaymentIntentId: intent.id,
      },
    });
    // Notificar capitão que precisa de ação (SCA)
    const pairing = await prisma.padelPairing.findUnique({ where: { id: pairingId }, select: { player1UserId: true, player2UserId: true } });
    const targets = [pairing?.player1UserId, pairing?.player2UserId].filter(Boolean) as string[];
    if (targets.length) {
      await queueOffsessionActionRequired(pairingId, targets);
    }
    return;
  }

  if (intent.status === "requires_payment_method" || intent.status === "canceled") {
    await prisma.$transaction(async (tx) => {
      const updated = await tx.padelPairing.update({
        where: { id: pairingId },
        data: {
          guaranteeStatus: "FAILED",
          pairingStatus: PadelPairingStatus.CANCELLED,
          graceUntilAt: null,
        },
        select: { id: true, eventId: true, organizationId: true },
      });
      await upsertPadelRegistrationForPairing(tx, {
        pairingId: updated.id,
        organizationId: updated.organizationId,
        eventId: updated.eventId,
        status: PadelRegistrationStatus.EXPIRED,
        reason: "SECOND_CHARGE_FAILED",
      });
      await tx.padelPairingHold.updateMany({
        where: { pairingId, status: "ACTIVE" },
        data: { status: "CANCELLED" },
      });
    });
    const pairing = await prisma.padelPairing.findUnique({ where: { id: pairingId }, select: { player1UserId: true, player2UserId: true } });
    const targets = [pairing?.player1UserId, pairing?.player2UserId].filter(Boolean) as string[];
    if (targets.length) {
      await queueDeadlineExpired(pairingId, targets);
    }
    return;
  }
}

async function handlePadelFullPayment(intent: Stripe.PaymentIntent, stripeEventId?: string) {
  const meta = intent.metadata ?? {};
  const pairingId = Number(meta.pairingId);
  const ticketTypeId = Number(meta.ticketTypeId);
  const eventId = Number(meta.eventId);
  const userId =
    typeof meta.userId === "string"
      ? meta.userId
      : typeof meta.ownerUserId === "string"
        ? meta.ownerUserId
        : null;
  const purchaseId =
    typeof meta.purchaseId === "string" && meta.purchaseId.trim() !== ""
      ? meta.purchaseId.trim()
      : null;

  if (!Number.isFinite(pairingId) || !Number.isFinite(ticketTypeId) || !Number.isFinite(eventId)) {
    console.warn("[handlePadelFullPayment] metadata incompleta", meta);
    return;
  }

  const ticketType = await prisma.ticketType.findUnique({
    where: { id: ticketTypeId },
    select: { id: true, price: true, currency: true, soldQuantity: true, totalQuantity: true, eventId: true },
  });
  if (!ticketType || ticketType.eventId !== eventId) {
    console.warn("[handlePadelFullPayment] ticketType inválido", { ticketTypeId, eventId });
    return;
  }

  if (ticketType.totalQuantity !== null && ticketType.totalQuantity !== undefined) {
    const remaining = ticketType.totalQuantity - ticketType.soldQuantity;
    if (remaining < 2) {
      console.warn("[handlePadelFullPayment] stock insuficiente", {
        ticketTypeId,
        remaining,
        pairingId,
      });
      await prisma.$transaction(async (tx) => {
        const updated = await tx.padelPairing.update({
          where: { id: pairingId },
          data: {
            pairingStatus: PadelPairingStatus.CANCELLED,
            guaranteeStatus: "FAILED",
          },
          select: { id: true, eventId: true, organizationId: true },
        });
        await upsertPadelRegistrationForPairing(tx, {
          pairingId: updated.id,
          organizationId: updated.organizationId,
          eventId: updated.eventId,
          status: PadelRegistrationStatus.CANCELLED,
          reason: "STOCK_INSUFFICIENT",
        });
        await tx.padelPairingHold.updateMany({
          where: { pairingId, status: "ACTIVE" },
          data: { status: "CANCELLED" },
        });
        const paymentEventAnchor = purchaseId ?? stripeEventId ?? intent.id;
        await paymentEventRepo(tx).upsert({
          where: { purchaseId: paymentEventAnchor },
          update: {
            status: "ERROR",
            errorMessage: "Stock insuficiente para completar inscrição Padel.",
            updatedAt: new Date(),
            purchaseId: paymentEventAnchor,
            source: PaymentEventSource.WEBHOOK,
            dedupeKey: paymentEventAnchor,
            attempt: { increment: 1 },
          },
          create: {
            stripePaymentIntentId: intent.id,
            status: "ERROR",
            amountCents: intent.amount,
            eventId,
            userId: userId ?? undefined,
            purchaseId: paymentEventAnchor,
            errorMessage: "Stock insuficiente para completar inscrição Padel.",
            source: PaymentEventSource.WEBHOOK,
            dedupeKey: paymentEventAnchor,
            attempt: 1,
            mode: intent.livemode ? PaymentMode.LIVE : PaymentMode.TEST,
            isTest: !intent.livemode,
          },
        });
      });
      return;
    }
  }

  const existingTicket = await prisma.ticket.findFirst({
    where: { stripePaymentIntentId: intent.id },
    select: { id: true },
  });
  if (existingTicket) {
    await paymentEventRepo(prisma).updateMany({
      where: { stripePaymentIntentId: intent.id },
      data: {
        status: "OK",
        updatedAt: new Date(),
        errorMessage: null,
        purchaseId: purchaseId ?? intent.id,
        source: PaymentEventSource.WEBHOOK,
        dedupeKey: purchaseId ?? intent.id,
        attempt: { increment: 1 },
      },
    });
    return;
  }

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      organizationId: true,
      title: true,
      coverImageUrl: true,
      locationName: true,
      startsAt: true,
      timezone: true,
    },
  });
  if (!event) {
    console.warn("[handlePadelFullPayment] evento inválido", { eventId });
    return;
  }
  if (!event.organizationId) {
    console.warn("[handlePadelFullPayment] evento sem organizationId", { eventId });
    return;
  }
  const eventOrganizationId = event.organizationId;

  const qr1 = crypto.randomUUID();
  const qr2 = crypto.randomUUID();
  const rot1 = crypto.randomUUID();
  const rot2 = crypto.randomUUID();

  let shouldEnsureEntries = false;
  await prisma.$transaction(async (tx) => {
    const pairing = await tx.padelPairing.findUnique({
      where: { id: pairingId },
      include: { slots: true },
    });
    if (!pairing || pairing.payment_mode !== PadelPaymentMode.FULL) {
      throw new Error("PAIRING_NOT_FULL");
    }
    if (pairing.pairingStatus === "CANCELLED") {
      throw new Error("PAIRING_CANCELLED");
    }

    const captainSlot = pairing.slots.find((s) => s.slot_role === "CAPTAIN");
    const partnerSlot = pairing.slots.find((s) => s.slot_role === "PARTNER");
    if (!captainSlot || !partnerSlot) throw new Error("SLOTS_INVALID");

    // Cria 2 tickets (capitão e parceiro vazio)
    const ticketCaptain = await tx.ticket.create({
      data: {
        eventId,
        ticketTypeId,
        pricePaid: ticketType.price,
        totalPaidCents: ticketType.price,
        currency: ticketType.currency || intent.currency.toUpperCase(),
        stripePaymentIntentId: intent.id,
        purchaseId: purchaseId ?? intent.id,
        status: "ACTIVE",
        qrSecret: qr1,
        rotatingSeed: rot1,
        userId: userId ?? undefined,
        ownerUserId: userId ?? null,
        ownerIdentityId: null,
        pairingId,
        padelSplitShareCents: ticketType.price,
        emissionIndex: 0,
      },
    });

    const ticketPartner = await tx.ticket.create({
      data: {
        eventId,
        ticketTypeId,
        pricePaid: ticketType.price,
        totalPaidCents: ticketType.price,
        currency: ticketType.currency || intent.currency.toUpperCase(),
        stripePaymentIntentId: intent.id,
        purchaseId: purchaseId ?? intent.id,
        status: "ACTIVE",
        qrSecret: qr2,
        rotatingSeed: rot2,
        pairingId,
        padelSplitShareCents: ticketType.price,
        ownerUserId: userId ?? null,
        ownerIdentityId: null,
        emissionIndex: 1,
      },
    });

    await tx.ticketType.update({
      where: { id: ticketTypeId },
      data: { soldQuantity: ticketType.soldQuantity + 2 },
    });

    const saleSummary =
      (purchaseId
        ? await tx.saleSummary.findUnique({ where: { purchaseId } })
        : null) ||
      (await tx.saleSummary.findUnique({ where: { paymentIntentId: intent.id } }));

    const summaryData = {
      eventId,
      userId: userId ?? null,
      ownerUserId: userId ?? null,
      ownerIdentityId: null,
      purchaseId: purchaseId ?? intent.id,
      subtotalCents: ticketType.price * 2,
      discountCents: 0,
      platformFeeCents: 0,
      stripeFeeCents: 0,
      totalCents: intent.amount ?? ticketType.price * 2,
      netCents: intent.amount ?? ticketType.price * 2,
      feeMode: null as any,
      currency: (ticketType.currency || intent.currency || "EUR").toUpperCase(),
      status: "PAID" as const,
    };

    const sale = saleSummary
      ? await saleSummaryRepo(tx).update({
          where: { id: saleSummary.id },
          data: { ...summaryData, paymentIntentId: intent.id },
        })
      : await saleSummaryRepo(tx).create({
          data: { ...summaryData, paymentIntentId: intent.id },
        });

    await saleLineRepo(tx).deleteMany({ where: { saleSummaryId: sale.id } });
    const saleLine = await saleLineRepo(tx).create({
      data: {
        saleSummaryId: sale.id,
        eventId,
        ticketTypeId: ticketType.id,
        promoCodeId: null,
        quantity: 2,
        unitPriceCents: ticketType.price,
        discountPerUnitCents: 0,
        grossCents: intent.amount ?? ticketType.price * 2,
        netCents: intent.amount ?? ticketType.price * 2,
        platformFeeCents: 0,
      },
    });

    const policyVersionApplied = await getLatestPolicyVersionForEvent(eventId, tx);
    const ownerKey = userId ? `user:${userId}` : "unknown";
    const entitlementPurchaseId = sale.purchaseId ?? sale.paymentIntentId ?? intent.id;
    const entitlementBase = {
      purchaseId: entitlementPurchaseId,
      saleLineId: saleLine.id,
      ownerKey,
      ownerUserId: userId ?? null,
      ownerIdentityId: null,
      type: EntitlementType.PADEL_ENTRY,
      status: EntitlementStatus.ACTIVE,
      eventId,
      policyVersionApplied,
      snapshotTitle: event.title,
      snapshotCoverUrl: event.coverImageUrl,
      snapshotVenueName: event.locationName,
      snapshotStartAt: event.startsAt,
      snapshotTimezone: event.timezone,
    };

    await tx.entitlement.upsert({
      where: {
        purchaseId_saleLineId_lineItemIndex_ownerKey_type: {
          purchaseId: entitlementPurchaseId,
          saleLineId: saleLine.id,
          lineItemIndex: 0,
          ownerKey,
          type: EntitlementType.PADEL_ENTRY,
        },
      },
      update: { ...entitlementBase, ticketId: ticketCaptain.id },
      create: { ...entitlementBase, lineItemIndex: 0, ticketId: ticketCaptain.id },
    });

    await tx.entitlement.upsert({
      where: {
        purchaseId_saleLineId_lineItemIndex_ownerKey_type: {
          purchaseId: entitlementPurchaseId,
          saleLineId: saleLine.id,
          lineItemIndex: 1,
          ownerKey,
          type: EntitlementType.PADEL_ENTRY,
        },
      },
      update: { ...entitlementBase, ticketId: ticketPartner.id },
      create: { ...entitlementBase, lineItemIndex: 1, ticketId: ticketPartner.id },
    });

    await tx.ticket.updateMany({
      where: { id: { in: [ticketCaptain.id, ticketPartner.id] } },
      data: { saleSummaryId: sale.id },
    });

    const partnerFilled = Boolean(partnerSlot.profileId || partnerSlot.playerProfileId);
    const partnerSlotStatus = partnerFilled ? PadelPairingSlotStatus.FILLED : PadelPairingSlotStatus.PENDING;
    const pairingStatus = partnerSlotStatus === PadelPairingSlotStatus.FILLED ? "COMPLETE" : "INCOMPLETE";

    const registrationStatus = PadelRegistrationStatus.CONFIRMED;
    await tx.padelPairing.update({
      where: { id: pairingId },
      data: {
        pairingStatus,
        slots: {
          update: [
            {
              where: { id: captainSlot.id },
              data: {
                ticketId: ticketCaptain.id,
                profileId: userId ?? captainSlot.profileId ?? undefined,
                paymentStatus: PadelPairingPaymentStatus.PAID,
                slotStatus: PadelPairingSlotStatus.FILLED,
              },
            },
            {
              where: { id: partnerSlot.id },
              data: {
                ticketId: ticketPartner.id,
                paymentStatus: PadelPairingPaymentStatus.PAID,
                slotStatus: partnerSlotStatus,
              },
            },
          ],
        },
      },
    });

    await upsertPadelRegistrationForPairing(tx, {
      pairingId,
      organizationId: eventOrganizationId,
      eventId,
      status: registrationStatus,
      paymentMode: PadelPaymentMode.FULL,
      isFullyPaid: true,
      reason: "CAPTAIN_FULL_PAYMENT",
    });

    shouldEnsureEntries = partnerFilled;

    const paymentEventAnchor = purchaseId ?? stripeEventId ?? intent.id;
    await paymentEventRepo(tx).upsert({
      where: { purchaseId: paymentEventAnchor },
      update: {
        status: "OK",
        amountCents: intent.amount,
        eventId,
        userId: userId ?? undefined,
        updatedAt: new Date(),
        errorMessage: null,
        mode: intent.livemode ? PaymentMode.LIVE : PaymentMode.TEST,
        isTest: !intent.livemode,
        purchaseId: paymentEventAnchor,
        source: PaymentEventSource.WEBHOOK,
        dedupeKey: paymentEventAnchor,
        attempt: { increment: 1 },
      },
      create: {
        stripePaymentIntentId: intent.id,
        status: "OK",
        amountCents: intent.amount,
        eventId,
        userId: userId ?? undefined,
        mode: intent.livemode ? PaymentMode.LIVE : PaymentMode.TEST,
        isTest: !intent.livemode,
        purchaseId: paymentEventAnchor,
        source: PaymentEventSource.WEBHOOK,
        dedupeKey: paymentEventAnchor,
        attempt: 1,
      },
    });
  });

  if (shouldEnsureEntries) {
    await ensureEntriesForConfirmedPairing(pairingId);
  }
}

export async function handleRefund(charge: Stripe.Charge) {
  const paymentIntentId =
    typeof charge.payment_intent === "string"
      ? charge.payment_intent
      : charge.payment_intent?.id;

  if (!paymentIntentId) {
    console.warn("[handleRefund] charge.refunded sem payment_intent");
    return;
  }

  // Obter metadata do payment intent para identificar PADEL_SPLIT
  const intent = await retrievePaymentIntent(paymentIntentId, { expand: ["latest_charge"] }).catch(() => null);

  const paymentScenario = normalizePaymentScenario(
    typeof intent?.metadata?.paymentScenario === "string" ? intent?.metadata?.paymentScenario : null,
  );
  const isPadelSplit = paymentScenario === "GROUP_SPLIT";
  const tickets = await prisma.ticket.findMany({
    where: { stripePaymentIntentId: paymentIntentId },
    select: { id: true, ticketTypeId: true, eventId: true, status: true, pairingId: true },
  });

  if (!tickets.length) {
    console.warn("[handleRefund] Nenhum ticket associado ao payment_intent", paymentIntentId);
    return;
  }

  if (isPadelSplit) {
    await handlePadelSplitRefund(paymentIntentId, tickets, charge.livemode);
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

  await prisma.$transaction([
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

  console.log("[handleRefund] Tickets marcados como REFUNDED", {
    paymentIntentId,
    ticketCount: tickets.length,
  });
}

async function handlePadelSplitRefund(
  paymentIntentId: string,
  tickets: Array<{ id: string; pairingId: number | null }>,
  livemode: boolean,
) {
  const saleSummary = await prisma.saleSummary.findUnique({
    where: { paymentIntentId },
    select: { id: true },
  });
  const pairingIds = Array.from(new Set(tickets.map((t) => t.pairingId).filter(Boolean))) as number[];
  if (!pairingIds.length) return;

  await prisma.$transaction(async (tx) => {
    await tx.ticket.updateMany({
      where: { stripePaymentIntentId: paymentIntentId },
      data: { status: TicketStatus.REFUNDED },
    });

    for (const pairingId of pairingIds) {
      const pairing = await tx.padelPairing.findUnique({
        where: { id: pairingId },
        include: { slots: true },
      });
      if (!pairing) continue;

      const affectedSlots = pairing.slots.filter((s) => tickets.some((t) => t.id === s.ticketId));
      for (const slot of affectedSlots) {
        await tx.padelPairingSlot.update({
          where: { id: slot.id },
          data: { slotStatus: PadelPairingSlotStatus.CANCELLED, paymentStatus: PadelPairingPaymentStatus.UNPAID, ticketId: null },
        });
      }

      const hasPaid = pairing.slots.some(
        (s) => s.paymentStatus === PadelPairingPaymentStatus.PAID && !tickets.some((t) => t.id === s.ticketId),
      );
      const newStatus = hasPaid ? "INCOMPLETE" : "CANCELLED";

      await tx.padelPairing.update({
        where: { id: pairingId },
        data: {
          pairingStatus: newStatus,
          partnerInviteToken: newStatus === "CANCELLED" ? null : pairing.partnerInviteToken,
          partnerLinkToken: newStatus === "CANCELLED" ? null : pairing.partnerLinkToken,
          partnerLinkExpiresAt: newStatus === "CANCELLED" ? null : pairing.partnerLinkExpiresAt,
        },
      });
    }

    await paymentEventRepo(tx).updateMany({
      where: { stripePaymentIntentId: paymentIntentId },
      data: {
        status: "REFUNDED",
        updatedAt: new Date(),
        errorMessage: null,
        mode: livemode ? PaymentMode.LIVE : PaymentMode.TEST,
        isTest: !livemode,
      },
    });

    if (saleSummary?.id) {
      await saleSummaryRepo(tx).update({
        where: { id: saleSummary.id },
        data: { status: SaleSummaryStatus.REFUNDED, updatedAt: new Date() },
      });
    }
  });
}
export const POST = withApiEnvelope(_POST);
