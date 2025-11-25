// app/api/payments/intent/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-10-29.clover",
});

type CheckoutItem = {
  ticketId: string;
  quantity: number;
};

type Body = {
  slug?: string;
  items?: CheckoutItem[];
  total?: number | null;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as Body | null;

    if (!body || !body.slug || !Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Dados inválidos." },
        { status: 400 },
      );
    }

    const { slug, items, total } = body;

    // Validar que o evento existe (e obter o id para metadata)
    const event = await prisma.event.findUnique({
      where: { slug },
      select: { id: true, slug: true },
    });

    if (!event) {
      return NextResponse.json(
        { ok: false, error: "Evento não encontrado." },
        { status: 404 },
      );
    }

    // Autenticação do utilizador
    const supabase = await createSupabaseServer();
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id ?? null;

    if (!userId) {
      return NextResponse.json(
        { ok: false, error: "Precisas de iniciar sessão." },
        { status: 401 },
      );
    }

    // Valida tickets e calcula montante a partir da DB (não confiamos no total do cliente)
    // ATENÇÃO: ticket.price está guardado em CÊNTIMOS na DB.
    let amountInCents = 0;

    for (const item of items) {
      const ticketTypeId = Number(item.ticketId);

      if (!Number.isFinite(ticketTypeId)) {
        return NextResponse.json(
          { ok: false, error: "ID de bilhete inválido." },
          { status: 400 },
        );
      }

      const ticketType = await prisma.ticketType.findFirst({
        where: {
          id: ticketTypeId,
          eventId: event.id,
          status: "ON_SALE",
        },
        select: {
          id: true,
          price: true,
          currency: true,
          totalQuantity: true,
          soldQuantity: true,
        },
      });

      if (!ticketType) {
        return NextResponse.json(
          { ok: false, error: "Um dos bilhetes não foi encontrado ou não pertence a este evento." },
          { status: 400 },
        );
      }

      const qty = Number(item.quantity ?? 0);
      if (!qty || qty < 1) {
        return NextResponse.json(
          { ok: false, error: "Quantidade inválida." },
          { status: 400 },
        );
      }

      // Stock validation before creating intent
      if (
        ticketType.totalQuantity !== null &&
        ticketType.totalQuantity !== undefined
      ) {
        const remaining = ticketType.totalQuantity - ticketType.soldQuantity;
        if (remaining < qty) {
          return NextResponse.json(
            { ok: false, error: "Stock insuficiente para um dos bilhetes." },
            { status: 400 },
          );
        }
      }

      const priceCents = Number(ticketType.price);
      if (!Number.isFinite(priceCents) || priceCents <= 0) {
        return NextResponse.json(
          { ok: false, error: "Preço inválido no servidor." },
          { status: 500 },
        );
      }

      // price está em cêntimos → somamos direto
      amountInCents += priceCents * qty;
    }

    if (amountInCents <= 0) {
      return NextResponse.json(
        { ok: false, error: "Montante inválido." },
        { status: 400 },
      );
    }

    // Criar PaymentIntent (amountInCents já está em cêntimos)
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: "eur",
      metadata: {
        eventId: String(event.id),
        eventSlug: String(event.slug),
        userId: String(userId),
        items: JSON.stringify(items),
      },
      automatic_payment_methods: { enabled: true },
    });

    return NextResponse.json({
      ok: true,
      clientSecret: paymentIntent.client_secret,
      amount: amountInCents,
      paymentIntentId: paymentIntent.id,
    });
  } catch (err) {
    console.error("Erro PaymentIntent:", err);
    return NextResponse.json(
      { ok: false, error: "Erro ao criar PaymentIntent." },
      { status: 500 },
    );
  }
}