// app/api/webhooks/stripe/route.ts
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

const stripeSecret = process.env.STRIPE_SECRET_KEY!;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

const stripe = new Stripe(stripeSecret, { apiVersion: "2025-10-29.clover" });

export async function POST(req: NextRequest) {
  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return new Response("Missing signature", { status: 400 });
  }

  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    console.error("[Webhook] Invalid signature:", err);
    return new Response("Invalid signature", { status: 400 });
  }

  try {
    switch (event.type) {
      case "payment_intent.succeeded": {
        const intent = event.data.object as Stripe.PaymentIntent;
        await fulfillPayment(intent);
        break;
      }

      default:
        break;
    }
  } catch (err) {
    console.error("[Webhook] Error processing event:", err);
  }

  return NextResponse.json({ received: true });
}

async function fulfillPayment(intent: Stripe.PaymentIntent) {
  const metadata = intent.metadata || {};
  const eventIdStr = metadata.eventId;
  const eventSlug = metadata.eventSlug;
  const ticketId = metadata.ticketId;
  const qtyStr = metadata.quantity;
  const userIdMeta = metadata.userId || null;

  if (!ticketId || (!eventIdStr && !eventSlug)) {
    console.warn("[fulfillPayment] Missing metadata:", metadata);
    return;
  }

  const quantity = Math.max(1, Number.parseInt(qtyStr || "1", 10) || 1);

  // Fetch event
  let eventRecord = null as any;

  if (eventIdStr) {
    const id = Number(eventIdStr);
    eventRecord = await prisma.event.findUnique({
      where: { id },
      include: { tickets: true },
    });
  }

  if (!eventRecord && eventSlug) {
    eventRecord = await prisma.event.findUnique({
      where: { slug: eventSlug },
      include: { tickets: true },
    });
  }

  if (!eventRecord) {
    console.warn("[fulfillPayment] Event not found");
    return;
  }

  // Validate ticket exists
  const ticket = eventRecord.tickets.find((t: any) => t.id === ticketId);
  if (!ticket) {
    console.warn("[fulfillPayment] Ticket not found:", ticketId);
    return;
  }

  // Validate stock
  if (ticket.totalQuantity !== null && ticket.totalQuantity !== undefined) {
    const remaining = ticket.totalQuantity - ticket.soldQuantity;
    if (remaining <= 0 || quantity > remaining) {
      console.warn("[fulfillPayment] Insufficient stock:", { remaining, quantity });
      return;
    }
  }

  const unitPrice = Number(ticket.price ?? 0);
  const totalPrice = unitPrice * quantity;

  const finalUserId =
    typeof userIdMeta === "string" && userIdMeta.trim() !== "" ? userIdMeta : null;

  // Check if already fulfilled (idempotency)
  const existing = await prisma.ticketPurchase.findFirst({
    where: {
      stripePaymentIntentId: intent.id,
    },
  });

  if (existing) {
    console.log("[fulfillPayment] Already fulfilled (idempotent)", intent.id);
    return;
  }

  await prisma.$transaction([
    prisma.ticketPurchase.create({
      data: {
        stripePaymentIntentId: intent.id,
        ticketId: ticket.id,
        eventId: eventRecord.id,
        userId: finalUserId,
        quantity,
        pricePaid: totalPrice,
        currency: ticket.currency,
        qrToken: crypto.randomUUID(),
      },
    }),
    prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        soldQuantity: { increment: quantity },
      },
    }),
    prisma.ticketReservation.updateMany({
      where: {
        ticketId: ticket.id,
        eventId: eventRecord.id,
        userId: finalUserId,
        status: "ACTIVE",
      },
      data: { status: "COMPLETED" },
    }),
  ]);

  console.log("[fulfillPayment] Purchase recorded:", {
    ticketId: ticket.id,
    eventId: eventRecord.id,
    quantity,
    userId: finalUserId,
    intentId: intent.id,
  });
}