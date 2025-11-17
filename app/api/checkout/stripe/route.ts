// app/api/checkout/stripe/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import Stripe from "stripe";

type StripeCheckoutBody = {
  eventSlug?: string;
  ticketId?: string;
  quantity?: number;
  successUrl?: string;
  cancelUrl?: string;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as StripeCheckoutBody | null;

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { success: false, error: "Body inválido." },
        { status: 400 },
      );
    }

    const eventSlug = body.eventSlug?.trim();
    const ticketId = body.ticketId;
    const quantityRaw = body.quantity;

    const quantity =
      typeof quantityRaw === "number" && quantityRaw > 0
        ? Math.floor(quantityRaw)
        : 1;

    if (!eventSlug) {
      return NextResponse.json(
        { success: false, error: "Slug do evento em falta." },
        { status: 400 },
      );
    }

    if (!ticketId) {
      return NextResponse.json(
        { success: false, error: "ticketId em falta." },
        { status: 400 },
      );
    }

    // -------------------------
    // 1) User Supabase (para metadata)
    // -------------------------
    let userId: string | null = null;
    let userEmail: string | null = null;

    try {
      const supabase = await createSupabaseServer();
      const { data: userData } = await supabase.auth.getUser();

      if (userData?.user) {
        userId = userData.user.id;
        userEmail = userData.user.email ?? null;
      }
    } catch (e) {
      console.warn(
        "[/api/checkout/stripe] Não foi possível obter user do Supabase (seguimos como anónimo).",
        e,
      );
    }

    // -------------------------
    // 2) Buscar evento + ticket
    // -------------------------
    const event = await prisma.event.findUnique({
      where: { slug: eventSlug },
      include: {
        tickets: true,
      },
    });

    if (!event) {
      return NextResponse.json(
        { success: false, error: "Evento não encontrado." },
        { status: 404 },
      );
    }

    const ticket = event.tickets.find((t) => t.id === ticketId);

    if (!ticket) {
      return NextResponse.json(
        { success: false, error: "Bilhete não encontrado para este evento." },
        { status: 404 },
      );
    }

    const now = new Date();

    // -------------------------
    // 3) Validar estado do bilhete / wave
    // -------------------------
    if (!ticket.available || !ticket.isVisible) {
      return NextResponse.json(
        { success: false, error: "Este bilhete não está disponível." },
        { status: 400 },
      );
    }

    if (ticket.startsAt && now < ticket.startsAt) {
      return NextResponse.json(
        { success: false, error: "Esta wave ainda não abriu." },
        { status: 400 },
      );
    }

    if (ticket.endsAt && now > ticket.endsAt) {
      return NextResponse.json(
        { success: false, error: "Esta wave já terminou." },
        { status: 400 },
      );
    }

    if (
      ticket.totalQuantity !== null &&
      ticket.totalQuantity !== undefined
    ) {
      const remaining = ticket.totalQuantity - ticket.soldQuantity;

      if (remaining <= 0) {
        return NextResponse.json(
          { success: false, error: "Esta wave está esgotada." },
          { status: 400 },
        );
      }

      if (quantity > remaining) {
        return NextResponse.json(
          {
            success: false,
            error: `Só há ${remaining} bilhete(s) disponíveis para esta wave.`,
          },
          { status: 400 },
        );
      }
    }

    // -------------------------
    // 4) Calcular total
    // -------------------------
    const unitPrice = Number(ticket.price ?? 0);
    const amount = unitPrice * quantity;

    // -------------------------
    // 5) Criar sessão real Stripe Checkout
    // -------------------------
    const stripeKey = process.env.STRIPE_SECRET_KEY;

    if (!stripeKey) {
      console.error(
        "[/api/checkout/stripe] STRIPE_SECRET_KEY em falta. Verifica o .env.local",
      );
      return NextResponse.json(
        {
          success: false,
          error:
            "Stripe não está configurado. Falta STRIPE_SECRET_KEY nas variáveis de ambiente.",
        },
        { status: 500 },
      );
    }

    // Tirámos o apiVersion explícito para evitar conflitos de typings.
    // Stripe vai usar a versão configurada na conta (perfeito para test mode).
    const stripe = new Stripe(stripeKey);

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

    const successUrl =
      body.successUrl ??
      `${baseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = body.cancelUrl ?? `${baseUrl}/checkout/cancel`;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: ticket.currency.toLowerCase(),
            product_data: {
              name: `${event.title} – ${ticket.name}`,
            },
            unit_amount: unitPrice * 100, // em cêntimos
          },
          quantity,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        eventId: String(event.id),
        eventSlug: event.slug,
        ticketId: ticket.id,
        quantity: String(quantity),
        userId: userId ?? "",
      },
      customer_email: userEmail ?? undefined,
    });

    if (!session.url) {
      return NextResponse.json(
        {
          success: false,
          error: "Não foi possível gerar URL de checkout Stripe.",
        },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        success: true,
        provider: "stripe",
        checkoutUrl: session.url,
        amount,
        currency: ticket.currency,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("[POST /api/checkout/stripe] ERROR", err);
    return NextResponse.json(
      { success: false, error: "Erro interno ao preparar checkout Stripe." },
      { status: 500 },
    );
  }
}