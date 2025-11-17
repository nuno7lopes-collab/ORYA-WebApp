// app/api/checkout/stripe/webhook/route.ts
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

if (!stripeSecretKey) {
  console.warn(
    "[stripe-webhook] STRIPE_SECRET_KEY não definido. O webhook não vai funcionar até configurares a env.",
  );
}

if (!webhookSecret) {
  console.warn(
    "[stripe-webhook] STRIPE_WEBHOOK_SECRET não definido. O webhook não vai validar a assinatura até configurares a env.",
  );
}

const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;

export async function POST(req: NextRequest) {
  try {
    if (!stripe || !webhookSecret) {
      console.error(
        "[stripe-webhook] Stripe ou webhook secret não configurados.",
      );
      return new NextResponse("Stripe webhook não configurado.", {
        status: 500,
      });
    }

    const signature = req.headers.get("stripe-signature");

    if (!signature) {
      console.warn("[stripe-webhook] Header stripe-signature em falta.");
      return new NextResponse("Assinatura em falta.", { status: 400 });
    }

    const rawBody = await req.text();

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(
        rawBody,
        signature,
        webhookSecret,
      );
    } catch (err) {
      console.error("[stripe-webhook] Falha na validação da assinatura:", err);
      return new NextResponse("Assinatura inválida.", { status: 400 });
    }

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        const metadata = session.metadata || {};
        const eventIdRaw = metadata.eventId;
        const eventSlug = metadata.eventSlug;
        const ticketId = metadata.ticketId;
        const qtyRaw = metadata.qty;
        const userId = metadata.userId || null;
        const reservationId = metadata.reservationId;

        const eventId =
          typeof eventIdRaw === "string"
            ? Number.parseInt(eventIdRaw, 10)
            : undefined;
        const quantity =
          typeof qtyRaw === "string"
            ? Number.parseInt(qtyRaw, 10) || 1
            : 1;

        if (!eventId || !ticketId) {
          console.error(
            "[stripe-webhook] checkout.session.completed sem eventId ou ticketId na metadata.",
            { metadata },
          );
          return new NextResponse("Metadata em falta.", { status: 200 });
        }

        const amountTotal =
          typeof session.amount_total === "number"
            ? session.amount_total
            : null;
        const currency = session.currency
          ? session.currency.toUpperCase()
          : "EUR";

        try {
          await prisma.$transaction(async (tx) => {
            // Atualizar soldQuantity da wave / ticket
            await tx.ticket.update({
              where: { id: ticketId },
              data: {
                soldQuantity: {
                  increment: quantity,
                },
              },
            });

            // Criar registo de compra de acordo com o modelo TicketPurchase
            await tx.ticketPurchase.create({
              data: {
                eventId,
                ticketId,
                quantity,
                userId,
                pricePaid: amountTotal ?? 0,
                currency,
              },
            });

            // Marcar a reserva como COMPLETED (se existir e tiver vindo na metadata)
            if (typeof reservationId === "string" && reservationId.length > 0) {
              try {
                await tx.ticketReservation.update({
                  where: { id: reservationId },
                  data: {
                    status: "COMPLETED",
                  },
                });
              } catch (reservationErr) {
                console.warn(
                  "[stripe-webhook] Não foi possível atualizar a reserva para COMPLETED:",
                  {
                    reservationId,
                    reservationErr,
                  },
                );
              }
            }
          });

          console.log(
            "[stripe-webhook] Compra criada com sucesso via webhook.",
            {
              eventId,
              ticketId,
              quantity,
              userId,
              amountTotal,
              currency,
            },
          );
        } catch (dbErr) {
          console.error(
            "[stripe-webhook] Erro ao criar TicketPurchase / atualizar soldQuantity:",
            dbErr,
          );
          // Devolve 200 para evitar re-tentativas infinitas se o erro for lógico,
          // mas mantém log para investigação.
          return new NextResponse("Erro ao persistir compra.", {
            status: 200,
          });
        }

        break;
      }

      default: {
        console.log("[stripe-webhook] Evento ignorado:", event.type);
      }
    }

    return new NextResponse("Webhook processado.", { status: 200 });
  } catch (err) {
    console.error("[stripe-webhook] Erro inesperado:", err);
    return new NextResponse("Erro interno no webhook.", { status: 500 });
  }
}