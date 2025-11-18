// app/api/webhooks/stripe/route.ts
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";

const stripeSecret = process.env.STRIPE_SECRET_KEY;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

const stripe = stripeSecret ? new Stripe(stripeSecret) : null as unknown as Stripe;

export async function POST(req: NextRequest) {
  if (!stripeSecret || !webhookSecret) {
    console.error(
      "[/api/webhooks/stripe] STRIPE_SECRET_KEY ou STRIPE_WEBHOOK_SECRET em falta.",
    );
    return new Response("Stripe não configurado", { status: 500 });
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    console.warn("[/api/webhooks/stripe] Header stripe-signature em falta.");
    return new Response("Missing stripe-signature", { status: 400 });
  }

  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    console.error("[/api/webhooks/stripe] Falha na verificação da assinatura", err);
    return new Response("Invalid signature", { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutSessionCompleted(session);
        break;
      }
      default:
        // Por agora ignoramos outros eventos
        break;
    }
  } catch (err) {
    console.error(
      "[/api/webhooks/stripe] Erro a tratar evento",
      event.type,
      err,
    );
    // Respondemos 200 na mesma para não levar com retries infinitos.
  }

  return NextResponse.json({ received: true }, { status: 200 });
}


type WebhookTicket = {
  id: string;
  totalQuantity: number | null | undefined;
  soldQuantity: number;
  price: number | null | undefined;
  currency: string | null | undefined;
};

async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session,
) {
  // Só seguimos se o pagamento estiver mesmo pago
  if (session.payment_status !== "paid") {
    console.log(
      "[handleCheckoutSessionCompleted] Ignorado porque payment_status != paid",
      session.payment_status,
    );
    return;
  }

  const metadata = session.metadata || {};
  const eventIdStr = metadata.eventId;
  const eventSlug = metadata.eventSlug;
  const ticketId = metadata.ticketId;
  const quantityStr = metadata.quantity;
  const userIdMeta = metadata.userId || "";

  if (!ticketId || (!eventIdStr && !eventSlug)) {
    console.warn(
      "[handleCheckoutSessionCompleted] Metadata em falta",
      metadata,
    );
    return;
  }

  const quantity = Math.max(
    1,
    Number.parseInt(quantityStr || "1", 10) || 1,
  );

  // 1) Buscar evento (por id se existir, senão por slug)
  let eventRecord = null as null | (Awaited<
    ReturnType<typeof prisma.event.findUnique>
  > & { tickets: Awaited<ReturnType<typeof prisma.ticket.findMany>> });

  if (eventIdStr) {
    const eventId = Number.parseInt(eventIdStr, 10);
    if (Number.isFinite(eventId)) {
      eventRecord = (await prisma.event.findUnique({
        where: { id: eventId },
        include: { tickets: true },
      })) as typeof eventRecord;
    }
  }

  if (!eventRecord && eventSlug) {
    eventRecord = (await prisma.event.findUnique({
      where: { slug: eventSlug },
      include: { tickets: true },
    })) as typeof eventRecord;
  }

  if (!eventRecord) {
    console.warn(
      "[handleCheckoutSessionCompleted] Evento não encontrado",
      { eventIdStr, eventSlug },
    );
    return;
  }

  const ticket = eventRecord.tickets.find(
    (t: WebhookTicket) => t.id === ticketId,
  );
  if (!ticket) {
    console.warn(
      "[handleCheckoutSessionCompleted] Bilhete não encontrado",
      { ticketId },
    );
    return;
  }

  // 2) Revalidar stock
  if (
    ticket.totalQuantity !== null &&
    ticket.totalQuantity !== undefined
  ) {
    const remaining = ticket.totalQuantity - ticket.soldQuantity;
    if (remaining <= 0 || quantity > remaining) {
      console.warn(
        "[handleCheckoutSessionCompleted] Stock insuficiente na webhook",
        { remaining, quantity },
      );
      return;
    }
  }

  const unitPrice = Number(ticket.price ?? 0);
  const totalPrice = unitPrice * quantity;

  const finalUserId =
    typeof userIdMeta === "string" && userIdMeta.trim() !== ""
      ? userIdMeta
      : null;

  // 3) Criar TicketPurchase + atualizar soldQuantity em transaction
  await prisma.$transaction([
    prisma.ticketPurchase.create({
      data: {
        ticketId: ticket.id,
        eventId: eventRecord.id,
        userId: finalUserId,
        quantity,
        pricePaid: totalPrice,
        currency: ticket.currency,
      },
    }),
    prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        soldQuantity: {
          increment: quantity,
        },
      },
    }),
  ]);

  console.log(
    "[handleCheckoutSessionCompleted] Compra registada com sucesso",
    {
      sessionId: session.id,
      eventId: eventRecord.id,
      ticketId: ticket.id,
      quantity,
      userId: finalUserId,
    },
  );
}