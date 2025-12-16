// app/api/stripe/webhook/route.ts

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { Prisma, PadelPairingPaymentStatus, PadelPairingSlotStatus, PadelPaymentMode, TicketStatus, FeeMode, PromoType, PaymentEventSource, PadelPairingLifecycleStatus, PadelPairingStatus, SaleSummaryStatus } from "@prisma/client";
import { stripe } from "@/lib/stripeClient";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendPurchaseConfirmationEmail } from "@/lib/emailSender";
import { parsePhoneNumberFromString } from "libphonenumber-js/min";
import { computePricing } from "@/lib/pricing";
import { getStripeBaseFees } from "@/lib/platformSettings";
import { normalizePaymentScenario } from "@/lib/paymentScenario";
import { checkoutMetadataSchema, normalizeItemsForMetadata, parseCheckoutItems } from "@/lib/checkoutSchemas";
import { computeGraceUntil } from "@/domain/padelDeadlines";
import { ensureEntriesForConfirmedPairing } from "@/domain/tournaments/ensureEntriesForConfirmedPairing";
import { resolveOwner } from "@/lib/ownership/resolveOwner";
import {
  queuePartnerPaid,
  queueDeadlineExpired,
  queueOffsessionActionRequired,
} from "@/domain/notifications/splitPayments";
import {
  queueMatchChanged,
  queueMatchResult,
  queueNextOpponent,
  queueBracketPublished,
  queueTournamentEve,
  queueEliminated,
  queueChampion,
} from "@/domain/notifications/tournament";

const webhookSecret = env.stripeWebhookSecret;

export async function POST(req: NextRequest) {
  const sig = req.headers.get("stripe-signature");

  if (!sig) {
    console.error("[Webhook] Missing signature header");
    return new Response("Missing signature", { status: 400 });
  }

  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown signature validation error";
    console.error("[Webhook] Invalid signature:", message);
    return new Response("Invalid signature", { status: 400 });
  }

  console.log("[Webhook] Event recebido:", {
    id: event.id,
    type: event.type,
  });

  try {
    switch (event.type) {
      /**
       * F5-13 – checkout.session.completed (REVENDAS)
       *
       * Aqui tratamos apenas sessões com paymentScenario=RESALE
       * (revenda de bilhetes entre utilizadores).
       */
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const metadata = session.metadata || {};
        const paymentScenario = normalizePaymentScenario(
          typeof metadata["paymentScenario"] === "string" ? metadata["paymentScenario"] : null
        );

        if (paymentScenario !== "RESALE") {
          console.log("[Webhook] checkout.session.completed sem RESALE, a ignorar neste fluxo.");
          break;
        }

        const resaleId = metadata["resaleId"];
        const ticketId = metadata["ticketId"];
        const buyerUserId = metadata["buyerUserId"];

        if (!resaleId || !ticketId || !buyerUserId) {
          console.error(
            "[Webhook][RESALE] Metadata incompleta em checkout.session.completed",
            { resaleId, ticketId, buyerUserId }
          );
          break;
        }

        try {
          await prisma.$transaction(async (tx) => {
            const resale = await tx.ticketResale.findUnique({
              where: { id: resaleId as string },
              include: { ticket: true },
            });

            if (!resale || !resale.ticket) {
              console.error("[Webhook][RESALE] Revenda não encontrada", {
                resaleId,
              });
              return;
            }

            // Idempotência: se já não estiver LISTED, não repetimos a operação
            if (resale.status !== "LISTED") {
              console.log(
                "[Webhook][RESALE] Revenda já processada ou num estado inválido",
                { resaleId, status: resale.status }
              );
              return;
            }

            // Atualizar revenda para SOLD
            await tx.ticketResale.update({
              where: { id: resale.id },
              data: {
                status: "SOLD",
                completedAt: new Date(),
              },
            });

            // Mudar o dono do bilhete para o comprador
            await tx.ticket.update({
              where: { id: resale.ticketId },
              data: {
                userId: buyerUserId as string,
                status: "ACTIVE",
              },
            });
          });

          console.log("[Webhook][RESALE] Revenda processada com sucesso", {
            resaleId,
            ticketId,
            buyerUserId,
          });
        } catch (err) {
          console.error("[Webhook][RESALE] Erro ao processar revenda:", err);
          // mesmo com erro, devolvemos 200 no final para não ter retries infinitos
        }

        break;
      }

      case "payment_intent.succeeded": {
        const intent = event.data.object as Stripe.PaymentIntent;
        console.log("[Webhook] payment_intent.succeeded", {
          id: intent.id,
          amount: intent.amount,
          currency: intent.currency,
          metadata: intent.metadata,
        });
        await fulfillPayment(intent, event.id);
        break;
      }

      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        console.log("[Webhook] charge.refunded", {
          id: charge.id,
          payment_intent: charge.payment_intent,
        });
        await handleRefund(charge);
        break;
      }

      default: {
        // outros eventos, por agora, podem ser ignorados
        console.log("[Webhook] Evento ignorado:", event.type);
        break;
      }
    }
  } catch (err) {
    console.error("[Webhook] Error processing event:", err);
    // devolvemos 200 na mesma para o Stripe não re-tentar para sempre
  }

  return NextResponse.json({ received: true });
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
  totalCents: number;
  feeMode?: string;
  currency?: string;
  feeBpsApplied?: number;
  feeFixedApplied?: number;
};

export async function fulfillPayment(intent: Stripe.PaymentIntent, stripeEventId?: string) {
  // [ORYA PATCH v1] Webhook reforçado e preparado para múltiplos bilhetes com total segurança.
  const meta = intent.metadata ?? {};
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

  // Se por algum motivo um PaymentIntent de revenda vier parar aqui, ignoramos
  if (paymentScenario === "RESALE") {
    console.log(
      "[fulfillPayment] Intent de revenda recebido em fulfillPayment, a ignorar (tratado via checkout.session.completed).",
      { intentId: intent.id }
    );
    return;
  }

  const rawUserId = typeof meta.userId === "string" ? meta.userId.trim() : "";
  const rawOwnerUserId = typeof (meta as Record<string, unknown>)?.ownerUserId === "string"
    ? (meta as Record<string, unknown>)?.ownerUserId?.trim()
    : "";
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
    await handlePadelSplitPayment(intent);
    return;
  }
  if (paymentScenario === "GROUP_FULL" && hasPadelPairingMeta) {
    await handlePadelFullPayment(intent);
    return;
  }
  if (scenario === "GROUP_SPLIT_SECOND_CHARGE") {
    await handleSecondCharge(intent);
    return;
  }

  const normalizePhone = (phone: string | null | undefined, defaultCountry = "PT") => {
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
    sessionUserId: ownerMeta?.ownerUserId ?? ownerMeta?.userId ?? userId ?? undefined,
    guestEmail: ownerMeta?.emailNormalized ?? ownerMeta?.guestEmail ?? guestEmail ?? undefined,
  });
  const ownerUserId = ownerResolved.ownerUserId ?? ownerMeta?.ownerUserId ?? ownerMeta?.userId ?? userId ?? null;
  const ownerIdentityId = ownerResolved.ownerIdentityId ?? ownerMeta?.ownerIdentityId ?? null;

  const platformFeeTotal = Number(meta.platformFeeCents ?? 0);
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

  if (already) {
    console.log(
      "[fulfillPayment] INTENT JÁ PROCESSADO — evitar duplicação mas permitir múltiplos bilhetes dentro do mesmo intent:",
      intent.id
    );
    try {
      await prisma.paymentEvent.updateMany({
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
          mode: intent.livemode ? "LIVE" : "TEST",
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
    const updated = await prisma.paymentEvent.updateMany({
      where: { stripePaymentIntentId: intent.id },
      data: {
        status: "PROCESSING",
        eventId: eventRecord.id,
        purchaseId: purchaseAnchor,
        stripeEventId: stripeEventId ?? undefined,
        source: PaymentEventSource.WEBHOOK,
        dedupeKey: purchaseAnchor ?? stripeEventId ?? intent.id,
        attempt: { increment: 1 },
        amountCents: intent.amount ?? null,
        platformFeeCents: platformFeeTotal ?? null,
        userId,
        errorMessage: null,
        updatedAt: new Date(),
        mode: intent.livemode ? "LIVE" : "TEST",
        isTest: !intent.livemode,
      },
    });
    if (updated.count === 0) {
      await prisma.paymentEvent.create({
        data: {
          stripePaymentIntentId: intent.id,
          status: "PROCESSING",
          purchaseId: purchaseAnchor,
          stripeEventId: stripeEventId ?? undefined,
          source: PaymentEventSource.WEBHOOK,
          dedupeKey: purchaseAnchor ?? stripeEventId ?? intent.id,
          attempt: 1,
          eventId: eventRecord.id,
          userId,
          amountCents: intent.amount ?? null,
          platformFeeCents: platformFeeTotal ?? null,
          mode: intent.livemode ? "LIVE" : "TEST",
          isTest: !intent.livemode,
        },
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
    const recalculated = computePricing(parsedBreakdown.subtotalCents, parsedBreakdown.discountCents, {
      eventFeeModeOverride: null,
      eventFeeMode: parsedBreakdown.feeMode as FeeMode | null,
      organizerFeeMode: parsedBreakdown.feeMode as FeeMode | null,
      platformDefaultFeeMode: parsedBreakdown.feeMode as FeeMode | null,
      eventPlatformFeeBpsOverride: parsedBreakdown.feeBpsApplied ?? null,
      eventPlatformFeeFixedCentsOverride: parsedBreakdown.feeFixedApplied ?? null,
      organizerPlatformFeeBps: parsedBreakdown.feeBpsApplied ?? null,
      organizerPlatformFeeFixedCents: parsedBreakdown.feeFixedApplied ?? null,
      platformDefaultFeeBps: parsedBreakdown.feeBpsApplied ?? 0,
      platformDefaultFeeFixedCents: parsedBreakdown.feeFixedApplied ?? 0,
    });

    if (recalculated.totalCents !== intent.amount_received) {
      console.warn("[fulfillPayment] Divergência entre breakdown.totalCents e amount_received", {
        intentId: intent.id,
        breakdownTotal: parsedBreakdown.totalCents,
        recalculatedTotal: recalculated.totalCents,
        amountReceived: intent.amount_received,
      });
    }
  }

  // Tentar obter a fee real do Stripe via balance_transaction
  let stripeFeeCents: number | null = null;
  try {
    if (intent.latest_charge) {
      const charge = await stripe.charges.retrieve(intent.latest_charge as string, {
        expand: ["balance_transaction"],
      });
      const balanceTx = charge.balance_transaction as Stripe.BalanceTransaction | null;
      if (balanceTx?.fee != null) stripeFeeCents = balanceTx.fee;
    }
  } catch (err) {
    console.warn("[fulfillPayment] Não foi possível obter balance_transaction; a usar estimativa", err);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const stripeFeeForIntentValue =
    stripeFeeCents ??
    estimateStripeFee(parsedBreakdown?.totalCents ?? intent.amount_received ?? intent.amount ?? 0);

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
        const netCents = Math.max(
          0,
          (parsedBreakdown.totalCents ?? 0) - (parsedBreakdown.platformFeeCents ?? 0) - stripeFee,
        );
        const summary = await tx.saleSummary.upsert({
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
            stripeFeeCents: stripeFee,
            totalCents: parsedBreakdown.totalCents,
            netCents,
            feeMode: feeMode,
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
            stripeFeeCents: stripeFee,
            totalCents: parsedBreakdown.totalCents,
            netCents,
            feeMode: feeMode,
            currency: parsedBreakdown.currency ?? "EUR",
          },
        });
        saleSummaryId = summary.id;

        // limpar linhas anteriores e regravar
        await tx.saleLine.deleteMany({ where: { saleSummaryId: summary.id } });
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
          await tx.saleLine.create({
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
          await tx.promoRedemption.create({
            data: {
              promoCodeId: Number(promoCodeId),
              userId: ownerUserId ?? null,
              guestEmail: guestEmail || null,
            },
          });
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

      for (let i = 0; i < qty; i++) {
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
      await tx.paymentEvent.updateMany({
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

    await tx.paymentEvent.updateMany({
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
    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL ??
      process.env.NEXT_PUBLIC_APP_URL ??
      "https://app.orya.pt";

    try {
      await sendPurchaseConfirmationEmail({
        to: targetEmail,
        eventTitle: eventRecord.title,
        eventSlug: eventRecord.slug,
        startsAt: eventRecord.startsAt?.toISOString() ?? null,
        endsAt: eventRecord.endsAt?.toISOString() ?? null,
        locationName: eventRecord.locationName ?? null,
        ticketsCount: createdTicketsCount,
        ticketUrl: userId ? `${baseUrl}/me/tickets` : `${baseUrl}/`,
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

async function handlePadelSplitPayment(intent: Stripe.PaymentIntent) {
  const meta = intent.metadata ?? {};
  const pairingId = Number(meta.pairingId);
  const slotId = Number(meta.slotId);
  const ticketTypeId = Number(meta.ticketTypeId);
  const eventId = Number(meta.eventId);
  const userId = typeof meta.userId === "string" ? meta.userId : null;
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
    select: { id: true, price: true, currency: true, soldQuantity: true, eventId: true },
  });
  if (!ticketType || ticketType.eventId !== eventId) {
    console.warn("[handlePadelSplitPayment] ticketType inválido", { ticketTypeId, eventId });
    return;
  }

  const qrSecret = crypto.randomUUID();
  const rotatingSeed = crypto.randomUUID();
  await prisma.$transaction(async (tx) => {
    const pairing = await tx.padelPairing.findUnique({
      where: { id: pairingId },
      include: { slots: true },
    });
    if (!pairing || pairing.paymentMode !== PadelPaymentMode.SPLIT) {
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
        totalPaidCents: intent.amount,
        currency: ticketType.currency || intent.currency.toUpperCase(),
        stripePaymentIntentId: intent.id,
        status: "ACTIVE",
        qrSecret,
        rotatingSeed,
        userId: userId ?? undefined,
        ownerUserId: userId ?? null,
        ownerIdentityId: null,
        pairingId,
        padelSplitShareCents: ticketType.price,
      },
    });

    await tx.ticketType.update({
      where: { id: ticketTypeId },
      data: { soldQuantity: ticketType.soldQuantity + 1 },
    });

    const updated = await tx.padelPairing.update({
      where: { id: pairingId },
      data: {
        slots: {
          update: {
            where: { id: slotId },
            data: {
              ticketId: ticket.id,
              profileId: userId ?? undefined,
              paymentStatus: PadelPairingPaymentStatus.PAID,
              slotStatus: userId ? PadelPairingSlotStatus.FILLED : slot.slotStatus,
            },
          },
        },
      },
      include: { slots: true },
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
    await tx.paymentEvent.upsert({
      where: { stripePaymentIntentId: intent.id },
      update: {
        status: "OK",
        amountCents: intent.amount,
        eventId,
        userId: userId ?? undefined,
        updatedAt: new Date(),
        errorMessage: null,
        mode: intent.livemode ? "LIVE" : "TEST",
        isTest: !intent.livemode,
        stripeFeeCents: stripeFeeForIntentValue,
        purchaseId: purchaseId ?? intent.id,
        source: PaymentEventSource.WEBHOOK,
        dedupeKey: purchaseId ?? intent.id,
        attempt: { increment: 1 },
      },
      create: {
        stripePaymentIntentId: intent.id,
        status: "OK",
        amountCents: intent.amount,
        eventId,
        userId: userId ?? undefined,
        mode: intent.livemode ? "LIVE" : "TEST",
        isTest: !intent.livemode,
        stripeFeeCents: stripeFeeForIntentValue,
        purchaseId: purchaseId ?? intent.id,
        source: PaymentEventSource.WEBHOOK,
        dedupeKey: purchaseId ?? intent.id,
        attempt: 1,
      },
    });
  });
}

async function handleSecondCharge(intent: Stripe.PaymentIntent) {
  const meta = intent.metadata ?? {};
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
      const confirmed = await tx.padelPairing.update({
        where: { id: pairingId },
        data: {
          lifecycleStatus: PadelPairingLifecycleStatus.CONFIRMED_CAPTAIN_FULL,
          pairingStatus: PadelPairingStatus.COMPLETE,
          guaranteeStatus: "SUCCEEDED",
          secondChargePaymentIntentId: intent.id,
          captainSecondChargedAt: now,
          partnerPaidAt: now,
          graceUntilAt: null,
          partnerInviteToken: null,
          partnerLinkToken: null,
          partnerLinkExpiresAt: null,
        },
      });
      await ensureEntriesForConfirmedPairing(confirmed.id);
      await tx.padelPairingHold.updateMany({
        where: { pairingId, status: "ACTIVE" },
        data: { status: "CANCELLED" },
      });
      await tx.paymentEvent.upsert({
        where: { stripePaymentIntentId: intent.id },
        update: {
          status: "OK",
          updatedAt: now,
          amountCents: intent.amount,
          purchaseId: (meta as Record<string, unknown>)?.purchaseId as string | undefined ?? intent.id,
          stripeFeeCents: 0,
          source: PaymentEventSource.WEBHOOK,
          dedupeKey: (meta as Record<string, unknown>)?.purchaseId as string | undefined ?? intent.id,
          attempt: { increment: 1 },
        },
        create: {
          stripePaymentIntentId: intent.id,
          status: "OK",
          amountCents: intent.amount,
          eventId: Number(meta.eventId) || undefined,
          userId: typeof meta.userId === "string" ? meta.userId : undefined,
          purchaseId: (meta as Record<string, unknown>)?.purchaseId as string | undefined ?? intent.id,
          source: PaymentEventSource.WEBHOOK,
          dedupeKey: (meta as Record<string, unknown>)?.purchaseId as string | undefined ?? intent.id,
          attempt: 1,
          stripeFeeCents: 0,
          mode: intent.livemode ? "LIVE" : "TEST",
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
      await tx.padelPairing.update({
        where: { id: pairingId },
        data: {
          guaranteeStatus: "FAILED",
          lifecycleStatus: PadelPairingLifecycleStatus.CANCELLED_INCOMPLETE,
          pairingStatus: PadelPairingStatus.CANCELLED,
          graceUntilAt: null,
        },
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

async function handlePadelFullPayment(intent: Stripe.PaymentIntent) {
  const meta = intent.metadata ?? {};
  const pairingId = Number(meta.pairingId);
  const ticketTypeId = Number(meta.ticketTypeId);
  const eventId = Number(meta.eventId);
  const userId = typeof meta.userId === "string" ? meta.userId : null;

  if (!Number.isFinite(pairingId) || !Number.isFinite(ticketTypeId) || !Number.isFinite(eventId)) {
    console.warn("[handlePadelFullPayment] metadata incompleta", meta);
    return;
  }

  const ticketType = await prisma.ticketType.findUnique({
    where: { id: ticketTypeId },
    select: { id: true, price: true, currency: true, soldQuantity: true, eventId: true },
  });
  if (!ticketType || ticketType.eventId !== eventId) {
    console.warn("[handlePadelFullPayment] ticketType inválido", { ticketTypeId, eventId });
    return;
  }

  const qr1 = crypto.randomUUID();
  const qr2 = crypto.randomUUID();
  const rot1 = crypto.randomUUID();
  const rot2 = crypto.randomUUID();

  await prisma.$transaction(async (tx) => {
    const pairing = await tx.padelPairing.findUnique({
      where: { id: pairingId },
      include: { slots: true },
    });
    if (!pairing || pairing.paymentMode !== PadelPaymentMode.FULL) {
      throw new Error("PAIRING_NOT_FULL");
    }
    if (pairing.pairingStatus === "CANCELLED") {
      throw new Error("PAIRING_CANCELLED");
    }

    const captainSlot = pairing.slots.find((s) => s.slotRole === "CAPTAIN");
    const partnerSlot = pairing.slots.find((s) => s.slotRole === "PARTNER");
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
        status: "ACTIVE",
        qrSecret: qr1,
        rotatingSeed: rot1,
        userId: userId ?? undefined,
        ownerUserId: userId ?? null,
        ownerIdentityId: null,
        pairingId,
        padelSplitShareCents: ticketType.price,
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
        status: "ACTIVE",
        qrSecret: qr2,
        rotatingSeed: rot2,
        pairingId,
        padelSplitShareCents: ticketType.price,
        ownerUserId: userId ?? null,
        ownerIdentityId: null,
      },
    });

    await tx.ticketType.update({
      where: { id: ticketTypeId },
      data: { soldQuantity: ticketType.soldQuantity + 2 },
    });

    await tx.padelPairing.update({
      where: { id: pairingId },
      data: {
        pairingStatus: "INCOMPLETE",
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
                slotStatus: PadelPairingSlotStatus.PENDING,
              },
            },
          ],
        },
      },
    });

    await tx.paymentEvent.upsert({
      where: { stripePaymentIntentId: intent.id },
      update: {
        status: "OK",
        amountCents: intent.amount,
        eventId,
        userId: userId ?? undefined,
        updatedAt: new Date(),
        errorMessage: null,
        mode: intent.livemode ? "LIVE" : "TEST",
        isTest: !intent.livemode,
        purchaseId: purchaseId ?? intent.id,
        source: PaymentEventSource.WEBHOOK,
        dedupeKey: purchaseId ?? intent.id,
        attempt: { increment: 1 },
      },
      create: {
        stripePaymentIntentId: intent.id,
        status: "OK",
        amountCents: intent.amount,
        eventId,
        userId: userId ?? undefined,
        mode: intent.livemode ? "LIVE" : "TEST",
        isTest: !intent.livemode,
        purchaseId: purchaseId ?? intent.id,
        source: PaymentEventSource.WEBHOOK,
        dedupeKey: purchaseId ?? intent.id,
        attempt: 1,
      },
    });
  });
}

async function handleRefund(charge: Stripe.Charge) {
  const paymentIntentId =
    typeof charge.payment_intent === "string"
      ? charge.payment_intent
      : charge.payment_intent?.id;

  if (!paymentIntentId) {
    console.warn("[handleRefund] charge.refunded sem payment_intent");
    return;
  }

  // Obter metadata do payment intent para identificar PADEL_SPLIT
  const intent = await stripe.paymentIntents.retrieve(paymentIntentId, { expand: ["latest_charge"] }).catch(() => null);

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
    select: { id: true, promoCodeId: true },
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
    prisma.paymentEvent.updateMany({
      where: { stripePaymentIntentId: paymentIntentId },
      data: {
        status: "REFUNDED",
        errorMessage: null,
        updatedAt: new Date(),
        mode: charge.livemode ? "LIVE" : "TEST",
        isTest: !charge.livemode,
      },
    }),
    ...(saleSummary?.id
      ? [
          prisma.promoRedemption.updateMany({
            where: { saleSummaryId: saleSummary.id },
            data: { cancelledAt: new Date() },
          }),
          prisma.saleSummary.update({
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

    await tx.paymentEvent.updateMany({
      where: { stripePaymentIntentId: paymentIntentId },
      data: {
        status: "REFUNDED",
        updatedAt: new Date(),
        errorMessage: null,
        mode: livemode ? "LIVE" : "TEST",
        isTest: !livemode,
      },
    });

    if (saleSummary?.id) {
      await tx.saleSummary.update({
        where: { id: saleSummary.id },
        data: { status: SaleSummaryStatus.REFUNDED, updatedAt: new Date() },
      });
    }
  });
}
