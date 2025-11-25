// app/api/stripe/webhook/route.ts

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { env } from "@/lib/env";
import { Prisma } from "@prisma/client";

const stripeSecret = env.stripeSecretKey;
const webhookSecret = env.stripeWebhookSecret;

const stripe = new Stripe(stripeSecret, { apiVersion: "2025-10-29.clover" });

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

type EventWithTickets = Prisma.EventGetPayload<{
  include: { ticketTypes: true };
}>;

type ParsedItem = { ticketId: number; quantity: number };

async function fulfillPayment(intent: Stripe.PaymentIntent) {
  // [ORYA PATCH v1] Webhook reforçado e preparado para múltiplos bilhetes com total segurança.
  const meta = intent.metadata ?? {};

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

  console.log("[fulfillPayment] Início", {
    intentId: intent.id,
    userId,
    meta,
  });

  // Segurança extra: só processamos intents que vieram da nossa app
  if (!userId) {
    console.warn(
      "[fulfillPayment] payment_intent sem userId em metadata, a ignorar",
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
            const ticketId = Number(
              (entry as { ticketId?: unknown })?.ticketId,
            );
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
            const ticketId = Number(
              (entry as { ticketId?: unknown })?.ticketId,
            );
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

  // --------- IDEMPOTÊNCIA (permite múltiplos bilhetes por pagamento) ---------
  const already = await prisma.ticket.findFirst({
    where: { stripePaymentIntentId: intent.id },
  });

  if (already) {
    console.log(
      "[fulfillPayment] INTENT JÁ PROCESSADO — evitar duplicação mas permitir múltiplos bilhetes dentro do mesmo intent:",
      intent.id
    );
    return;
  }

  // --------- PREPARAR CRIAÇÃO DE BILHETES + STOCK ---------
  const purchasesToCreate: Prisma.PrismaPromise<unknown>[] = [];
  const stockUpdates: Prisma.PrismaPromise<unknown>[] = [];

  for (const item of items) {
    const ticketType = eventRecord.ticketTypes.find(
      (t) => t.id === item.ticketId
    );
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

      purchasesToCreate.push(
        prisma.ticket.create({
          data: {
            userId,
            eventId: eventRecord.id,
            ticketTypeId: ticketType.id,
            status: "ACTIVE",
            purchasedAt: new Date(),
            qrSecret: token,
            pricePaid: ticketType.price,
            currency: ticketType.currency,
            stripePaymentIntentId: intent.id,
          },
        })
      );
    }

    stockUpdates.push(
      prisma.ticketType.update({
        where: { id: ticketType.id },
        data: {
          soldQuantity: { increment: qty },
        },
      })
    );
  }

  if (purchasesToCreate.length === 0) {
    console.warn("[fulfillPayment] No valid items to process");
    return;
  }

  console.log("[fulfillPayment] A executar transaction:", {
    purchasesCount: purchasesToCreate.length,
    stockUpdatesCount: stockUpdates.length,
  });

  await prisma.$transaction([
    ...purchasesToCreate,
    ...stockUpdates,
    prisma.ticketReservation.updateMany({
      where: {
        eventId: eventRecord.id,
        userId,
        status: "ACTIVE",
      },
      data: { status: "COMPLETED" },
    }),
    // Fim da transação — sistema seguro e idempotente
  ]);

  console.log("[fulfillPayment] OK, items processados:", {
    intentId: intent.id,
    userId,
    items,
  });
}
