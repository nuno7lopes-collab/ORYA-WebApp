// app/api/checkout/create-intent/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import Stripe from "stripe";
import { createSupabaseServer } from "@/lib/supabaseServer";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
  console.warn(
    "[create-intent] STRIPE_SECRET_KEY não definido. O endpoint vai falhar até configurares a env."
  );
}

const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, {
      apiVersion: "2025-10-29.clover",
    })
  : null;

export async function POST(req: NextRequest) {
  try {
    if (!stripe) {
      return NextResponse.json(
        {
          ok: false,
          error: "Stripe não está configurado. Falta STRIPE_SECRET_KEY.",
        },
        { status: 500 }
      );
    }

    // 1) User autenticado via Supabase
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
        "[create-intent] Não foi possível obter user do Supabase.",
        e
      );
    }

    if (!userId) {
      return NextResponse.json(
        {
          ok: false,
          error: "Precisas de iniciar sessão para comprar bilhetes.",
          code: "NOT_AUTHENTICATED",
        },
        { status: 401 }
      );
    }

    const body = (await req.json().catch(() => null)) as
      | { reservationId?: string }
      | null;

    const reservationId = body?.reservationId;

    if (!reservationId || typeof reservationId !== "string") {
      return NextResponse.json(
        {
          ok: false,
          error: "reservationId em falta.",
          code: "RESERVATION_ID_MISSING",
        },
        { status: 400 }
      );
    }

    // 2) Buscar reserva + ticket + evento
    const reservation = await prisma.ticketReservation.findUnique({
      where: { id: reservationId },
      include: {
        ticket: true,
        event: true,
      },
    });

    if (!reservation) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Reserva não encontrada. Volta à página do evento e tenta novamente.",
          code: "RESERVATION_NOT_FOUND",
        },
        { status: 404 }
      );
    }

    // Garantir que a reserva pertence a este user (se tiver userId associado)
    if (reservation.userId && reservation.userId !== userId) {
      return NextResponse.json(
        {
          ok: false,
          error: "Esta reserva não pertence à tua conta.",
          code: "RESERVATION_WRONG_USER",
        },
        { status: 403 }
      );
    }

    const nowDate = new Date();
    if (reservation.status !== "ACTIVE" || reservation.expiresAt <= nowDate) {
      // opcional: marcar como expirada
      if (reservation.status === "ACTIVE" && reservation.expiresAt <= nowDate) {
        try {
          await prisma.ticketReservation.update({
            where: { id: reservation.id },
            data: { status: "EXPIRED" },
          });
        } catch (e) {
          console.warn(
            "[create-intent] Falha ao marcar reserva como expirada:",
            e
          );
        }
      }

      return NextResponse.json(
        {
          ok: false,
          error:
            "O tempo desta reserva já terminou. Volta à página do evento e tenta novamente.",
          code: "RESERVATION_EXPIRED",
        },
        { status: 400 }
      );
    }

    const event = reservation.event;
    const ticket = reservation.ticket;
    const qty = reservation.quantity;

    // 3) Validar estado da wave
    if (!ticket.available || !ticket.isVisible) {
      return NextResponse.json(
        {
          ok: false,
          error: "Este bilhete não está disponível neste momento.",
          code: "TICKET_UNAVAILABLE",
        },
        { status: 400 }
      );
    }

    const now = Date.now();
    const startsAt = ticket.startsAt ? new Date(ticket.startsAt).getTime() : 0;
    const endsAt = ticket.endsAt ? new Date(ticket.endsAt).getTime() : null;

    if (startsAt && now < startsAt) {
      return NextResponse.json(
        {
          ok: false,
          error: "As vendas para esta wave ainda não abriram.",
          code: "SALES_NOT_STARTED",
        },
        { status: 400 }
      );
    }

    if (endsAt && now > endsAt) {
      return NextResponse.json(
        {
          ok: false,
          error: "As vendas para esta wave já encerraram.",
          code: "SALES_CLOSED",
        },
        { status: 400 }
      );
    }

    // 4) Stock
    if (
      ticket.totalQuantity !== null &&
      ticket.totalQuantity !== undefined &&
      ticket.totalQuantity > 0
    ) {
      const remaining = ticket.totalQuantity - ticket.soldQuantity;
      if (remaining <= 0) {
        return NextResponse.json(
          {
            ok: false,
            error: "Esta wave está esgotada.",
            code: "SOLD_OUT",
          },
          { status: 400 }
        );
      }

      if (qty > remaining) {
        return NextResponse.json(
          {
            ok: false,
            error: `Só restam ${remaining} bilhetes nesta wave.`,
            code: "INSUFFICIENT_STOCK",
          },
          { status: 400 }
        );
      }
    }

    const unitPriceCents = ticket.price ?? 0;

    if (unitPriceCents <= 0) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Preço do bilhete inválido. Verifica a configuração desta wave.",
          code: "INVALID_PRICE",
        },
        { status: 400 }
      );
    }

    const currency = ticket.currency
      ? String(ticket.currency).toUpperCase()
      : "EUR";

    const totalCents = unitPriceCents * qty;

    // 5) Criar PaymentIntent na Stripe
    const intent = await stripe.paymentIntents.create({
      amount: totalCents,
      currency: currency.toLowerCase(),
      metadata: {
        checkoutType: "ORYA_NATIVE",
        eventId: String(event.id),
        eventSlug: event.slug ?? "",
        ticketId: ticket.id,
        quantity: String(qty),
        userId: userId ?? "",
        reservationId: reservation.id,
      },
      receipt_email: userEmail ?? undefined,
    });

    if (!intent.client_secret) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Não foi possível iniciar o pagamento. Tenta novamente dentro de instantes.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        clientSecret: intent.client_secret,
        intentId: intent.id,
        event: {
          id: event.id,
          slug: event.slug,
          title: event.title,
        },
        ticket: {
          id: ticket.id,
          name: ticket.name,
          price: unitPriceCents,
          currency,
          quantity: qty,
        },
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[create-intent] Erro inesperado:", err);
    return NextResponse.json(
      {
        ok: false,
        error: "Ocorreu um erro ao preparar o pagamento.",
      },
      { status: 500 }
    );
  }
}