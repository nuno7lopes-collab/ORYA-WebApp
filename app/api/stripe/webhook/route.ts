// app/api/stripe/webhook/route.ts

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { Prisma, PadelPairingPaymentStatus, PadelPairingSlotStatus, PadelPaymentMode, TicketStatus, FeeMode } from "@prisma/client";
import { stripe } from "@/lib/stripeClient";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendPurchaseConfirmationEmail } from "@/lib/emailSender";
import { parsePhoneNumberFromString } from "libphonenumber-js/min";
import { computePricing } from "@/lib/pricing";

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
       * Aqui tratamos apenas o caso em que a sessão tem metadata.mode === "RESALE",
       * ou seja, compra de um bilhete em revenda entre utilizadores.
       */
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const metadata = session.metadata || {};
        const mode = metadata["mode"];

        if (mode !== "RESALE") {
          console.log(
            "[Webhook] checkout.session.completed sem mode=RESALE, a ignorar neste fluxo."
          );
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
        await fulfillPayment(intent);
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

type ParsedItem = { ticketId: number; quantity: number };
type BreakdownLine = {
  ticketTypeId: number;
  quantity: number;
  unitPriceCents: number;
  discountPerUnitCents?: number;
  lineGrossCents: number;
  lineNetCents: number;
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

export async function fulfillPayment(intent: Stripe.PaymentIntent) {
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

  // Se por algum motivo um PaymentIntent de revenda vier parar aqui, ignoramos
  if (meta.mode === "RESALE") {
    console.log(
      "[fulfillPayment] Intent de revenda recebido em fulfillPayment, a ignorar (tratado via checkout.session.completed).",
      { intentId: intent.id }
    );
    return;
  }

  const rawUserId = typeof meta.userId === "string" ? meta.userId.trim() : "";
  const userId = rawUserId !== "" ? rawUserId : null;
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
  if (meta.mode === "PADEL_SPLIT") {
    await handlePadelSplitPayment(intent);
    return;
  }
  if (meta.mode === "PADEL_FULL") {
    await handlePadelFullPayment(intent);
    return;
  }

  const promoCodeRaw =
    typeof meta.promoCodeRaw === "string" && meta.promoCodeRaw.trim() !== ""
      ? meta.promoCodeRaw.trim()
      : "";
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

  console.log("[fulfillPayment] Início", {
    intentId: intent.id,
    userId,
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

  if (typeof meta.items === "string") {
    try {
      const parsed = JSON.parse(meta.items);
      if (Array.isArray(parsed)) {
        items = parsed
          .map((entry) => {
            const rawId =
              (entry as { ticketId?: unknown })?.ticketId ??
              (entry as { ticketTypeId?: unknown })?.ticketTypeId;
            const ticketId = Number(rawId);
            const quantity = Number(
              (entry as { quantity?: unknown })?.quantity ?? 1,
            );
            if (!Number.isFinite(ticketId) || !Number.isFinite(quantity)) {
              return null;
            }
            return { ticketId, quantity: Math.max(1, quantity) };
          })
          .filter(Boolean) as ParsedItem[];
      }
    } catch (err) {
      console.error("[Webhook] Failed to parse metadata.items:", err);
    }
  }

  if (items.length === 0 && typeof meta.itemsJson === "string") {
    try {
      const parsed = JSON.parse(meta.itemsJson);
      if (Array.isArray(parsed)) {
        items = parsed
          .map((entry) => {
            const rawId =
              (entry as { ticketId?: unknown })?.ticketId ??
              (entry as { ticketTypeId?: unknown })?.ticketTypeId;
            const ticketId = Number(rawId);
            const quantity = Number(
              (entry as { quantity?: unknown })?.quantity ?? 1,
            );
            if (!Number.isFinite(ticketId) || !Number.isFinite(quantity)) {
              return null;
            }
            return { ticketId, quantity: Math.max(1, quantity) };
          })
          .filter(Boolean) as ParsedItem[];
      }
    } catch (err) {
      console.error("[Webhook] Failed to parse metadata.itemsJson:", err);
    }
  }

  if (items.length === 0 && typeof meta.ticketId === "string") {
    const qty = Math.max(1, Number(meta.quantity ?? 1));
    const ticketId = Number(meta.ticketId);
    if (!Number.isNaN(ticketId)) {
      items = [{ ticketId, quantity: qty }];
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

  // --------- Redemptions de promo (best-effort) ---------
  if (promoCodeId) {
    try {
      await prisma.promoRedemption.create({
        data: {
          promoCodeId: Number(promoCodeId),
          userId: userId ?? null,
          guestEmail: guestEmail || null,
        },
      });
    } catch (err) {
      const isP2002 =
        err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
      if (isP2002) {
        console.warn("[fulfillPayment] promoRedemption já existente para este user/código — a ignorar");
        // Opcional: se quisermos contar usos, poderíamos incrementar usageCount aqui (campo inexistente por agora)
      } else {
        console.warn("[fulfillPayment] Não foi possível registar promo redemption", {
          intentId: intent.id,
          promoCodeId,
          promoCodeRaw,
          err,
        });
      }
    }
  }

  // --------- PREPARAR CRIAÇÃO DE BILHETES + STOCK ---------
  let createdTicketsCount = 0;
  let saleSummaryId: number | null = null;

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
        const summary = await tx.saleSummary.upsert({
          where: { paymentIntentId: intent.id },
          update: {
            eventId: eventRecord.id,
            userId,
            promoCodeId: promoCodeId ? Number(promoCodeId) : null,
            promoCodeSnapshot: summaryPromo?.code ?? null,
            promoLabelSnapshot: summaryPromo?.label ?? summaryPromo?.code ?? null,
            promoTypeSnapshot: summaryPromo?.type ?? null,
            promoValueSnapshot: summaryPromo?.value ?? null,
            subtotalCents: parsedBreakdown.subtotalCents,
            discountCents: parsedBreakdown.discountCents,
            platformFeeCents: parsedBreakdown.platformFeeCents,
            totalCents: parsedBreakdown.totalCents,
            netCents: parsedBreakdown.totalCents - parsedBreakdown.platformFeeCents,
            feeMode: feeMode,
            currency: parsedBreakdown.currency ?? "EUR",
          },
          create: {
            paymentIntentId: intent.id,
            eventId: eventRecord.id,
            userId,
            promoCodeId: promoCodeId ? Number(promoCodeId) : null,
            promoCodeSnapshot: summaryPromo?.code ?? null,
            promoLabelSnapshot: summaryPromo?.label ?? summaryPromo?.code ?? null,
            promoTypeSnapshot: summaryPromo?.type ?? null,
            promoValueSnapshot: summaryPromo?.value ?? null,
            subtotalCents: parsedBreakdown.subtotalCents,
            discountCents: parsedBreakdown.discountCents,
            platformFeeCents: parsedBreakdown.platformFeeCents,
            totalCents: parsedBreakdown.totalCents,
            netCents: parsedBreakdown.totalCents - parsedBreakdown.platformFeeCents,
            feeMode: feeMode,
            currency: parsedBreakdown.currency ?? "EUR",
          },
        });
        saleSummaryId = summary.id;

        // limpar linhas anteriores e regravar
        await tx.saleLine.deleteMany({ where: { saleSummaryId: summary.id } });
        for (const line of parsedBreakdown.lines) {
          const linePromo = line.promoCodeId ? promoSnapshots.get(line.promoCodeId) ?? null : summaryPromo;
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
              unitPriceCents: line.unitPriceCents,
              discountPerUnitCents: line.discountPerUnitCents ?? 0,
              grossCents: line.lineGrossCents,
              netCents: line.lineNetCents,
              platformFeeCents: line.platformFeeCents ?? 0,
            },
          });
        }
      } catch (err) {
        console.warn("[fulfillPayment] Falha ao persistir saleSummary/saleLines", err);
      }
    }

    for (const item of items) {
      const ticketType = eventRecord.ticketTypes.find((t) => t.id === item.ticketId);
      if (!ticketType) {
        console.warn("[fulfillPayment] TicketType not found:", item.ticketId);
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

        const ticket = await tx.ticket.create({
          data: {
            userId,
            eventId: eventRecord.id,
            ticketTypeId: ticketType.id,
            status: "ACTIVE",
            purchasedAt: new Date(),
            qrSecret: token,
            pricePaid: parsedBreakdown
              ? Math.round(
                  (parsedBreakdown.lines.find((l) => l.ticketTypeId === ticketType.id)?.lineNetCents ?? ticketType.price) /
                    Math.max(1, parsedBreakdown.lines.find((l) => l.ticketTypeId === ticketType.id)?.quantity ?? 1)
                )
              : ticketType.price,
            currency: ticketType.currency,
            platformFeeCents: feeForThisTicket,
            totalPaidCents:
              (parsedBreakdown
                ? Math.round(
                    (parsedBreakdown.lines.find((l) => l.ticketTypeId === ticketType.id)?.lineNetCents ?? ticketType.price) /
                      Math.max(1, parsedBreakdown.lines.find((l) => l.ticketTypeId === ticketType.id)?.quantity ?? 1)
                  )
                : ticketType.price) + feeForThisTicket,
            stripePaymentIntentId: intent.id,
          },
        });

        if (!userId && guestEmail) {
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
          updatedAt: new Date(),
        },
      });
      return;
    }

    // Reservas apenas se a compra foi feita com sessão (guest não cria reservas)
    if (userId) {
      await tx.ticketReservation.updateMany({
        where: {
          eventId: eventRecord.id,
          userId,
          status: "ACTIVE",
        },
        data: { status: "COMPLETED" },
      });
    }

    await tx.paymentEvent.updateMany({
      where: { stripePaymentIntentId: intent.id },
      data: { status: "OK", updatedAt: new Date(), errorMessage: null },
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
      await tx.padelPairing.update({
        where: { id: pairingId },
        data: { pairingStatus: "COMPLETE" },
      });
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
      },
      create: {
        stripePaymentIntentId: intent.id,
        status: "OK",
        amountCents: intent.amount,
        eventId,
        userId: userId ?? undefined,
        mode: intent.livemode ? "LIVE" : "TEST",
        isTest: !intent.livemode,
      },
    });
  });
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
      },
      create: {
        stripePaymentIntentId: intent.id,
        status: "OK",
        amountCents: intent.amount,
        eventId,
        userId: userId ?? undefined,
        mode: intent.livemode ? "LIVE" : "TEST",
        isTest: !intent.livemode,
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

  const isPadelSplit = intent?.metadata?.mode === "PADEL_SPLIT";
  const tickets = await prisma.ticket.findMany({
    where: { stripePaymentIntentId: paymentIntentId },
    select: { id: true, ticketTypeId: true, eventId: true, status: true, pairingId: true },
  });

  if (!tickets.length) {
    console.warn("[handleRefund] Nenhum ticket associado ao payment_intent", paymentIntentId);
    return;
  }

  if (isPadelSplit) {
    await handlePadelSplitRefund(paymentIntentId, tickets);
    return;
  }

  const byType = tickets.reduce<Record<number, number>>((acc, t) => {
    acc[t.ticketTypeId] = (acc[t.ticketTypeId] ?? 0) + 1;
    return acc;
  }, {});

  const ticketTypeIds = Object.keys(byType).map((id) => Number(id));
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
  ]);

  console.log("[handleRefund] Tickets marcados como REFUNDED", {
    paymentIntentId,
    ticketCount: tickets.length,
  });
}

async function handlePadelSplitRefund(paymentIntentId: string, tickets: Array<{ id: string; pairingId: number | null }>) {
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
          inviteToken: newStatus === "CANCELLED" ? null : pairing.inviteToken,
        },
      });
    }

    await tx.paymentEvent.updateMany({
      where: { stripePaymentIntentId: paymentIntentId },
      data: {
        status: "REFUNDED",
        updatedAt: new Date(),
        errorMessage: null,
        mode: charge.livemode ? "LIVE" : "TEST",
        isTest: !charge.livemode,
      },
    });
  });
}
