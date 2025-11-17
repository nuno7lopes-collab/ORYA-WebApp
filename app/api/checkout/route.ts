// app/api/checkout/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import Stripe from "stripe";
import { createSupabaseServer } from "@/lib/supabaseServer";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
  console.warn(
    "[checkout] STRIPE_SECRET_KEY não definido. O endpoint vai falhar em runtime até configurares a env.",
  );
}

const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, {
      apiVersion: "2025-10-29.clover",
    })
  : null;

function getBaseUrl(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (origin) return origin;

  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }

  // fallback para dev local
  return "http://localhost:3000";
}

export async function POST(req: NextRequest) {
  try {
    if (!stripe) {
      return NextResponse.json(
        {
          ok: false,
          error: "Stripe não está configurado. Falta STRIPE_SECRET_KEY.",
        },
        { status: 500 },
      );
    }

    // Buscar user atual do Supabase (se estiver autenticado)
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
        "[/api/checkout] Não foi possível obter user do Supabase.",
        e,
      );
    }

    // Se não houver utilizador autenticado, não deixamos avançar para pagamento
    if (!userId) {
      return NextResponse.json(
        {
          ok: false,
          error: "Precisas de iniciar sessão para comprar bilhetes.",
          code: "NOT_AUTHENTICATED",
        },
        { status: 401 },
      );
    }

    let reservationId: string | undefined;

    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      const body = (await req.json().catch(() => ({}))) as Record<
        string,
        unknown
      >;

      if (typeof body.reservationId === "string") {
        reservationId = body.reservationId;
      }
    } else {
      const formData = await req.formData();
      const rawReservationId = formData.get("reservationId");

      if (typeof rawReservationId === "string") {
        reservationId = rawReservationId;
      }
    }

    if (!reservationId) {
      return NextResponse.json(
        {
          ok: false,
          error: "Dados em falta. Precisas de enviar reservationId.",
          code: "RESERVATION_ID_MISSING",
        },
        { status: 400 },
      );
    }

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
          error: "Reserva não encontrada. Volta à página do evento e tenta novamente.",
          code: "RESERVATION_NOT_FOUND",
        },
        { status: 404 },
      );
    }

    // Garantir que a reserva pertence ao user atual (se tiver userId)
    if (reservation.userId && reservation.userId !== userId) {
      return NextResponse.json(
        {
          ok: false,
          error: "Esta reserva não pertence à tua conta.",
          code: "RESERVATION_WRONG_USER",
        },
        { status: 403 },
      );
    }

    // Verificar se a reserva ainda está ativa e não expirou
    const nowDate = new Date();
    if (reservation.status !== "ACTIVE" || reservation.expiresAt <= nowDate) {
      // Opcional: marcar como expirada se o tempo já passou
      if (reservation.status === "ACTIVE" && reservation.expiresAt <= nowDate) {
        try {
          await prisma.ticketReservation.update({
            where: { id: reservation.id },
            data: { status: "EXPIRED" },
          });
        } catch (e) {
          console.warn("[/api/checkout] Falha ao marcar reserva como expirada:", e);
        }
      }

      return NextResponse.json(
        {
          ok: false,
          error:
            "O tempo desta reserva já terminou. Volta à página do evento e tenta novamente.",
          code: "RESERVATION_EXPIRED",
        },
        { status: 400 },
      );
    }

    const event = reservation.event;
    const ticket = reservation.ticket;
    const qty = reservation.quantity;

    // 2) Validar estado da wave / bilhete
    if (!ticket.available || !ticket.isVisible) {
      return NextResponse.json(
        {
          ok: false,
          error: "Este bilhete não está disponível neste momento.",
          code: "TICKET_UNAVAILABLE",
        },
        { status: 400 },
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
        { status: 400 },
      );
    }

    if (endsAt && now > endsAt) {
      return NextResponse.json(
        {
          ok: false,
          error: "As vendas para esta wave já encerraram.",
          code: "SALES_CLOSED",
        },
        { status: 400 },
      );
    }

    // Stock
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
          { status: 400 },
        );
      }

      if (qty > remaining) {
        return NextResponse.json(
          {
            ok: false,
            error: `Só restam ${remaining} bilhetes nesta wave.`,
            code: "INSUFFICIENT_STOCK",
          },
          { status: 400 },
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
        { status: 400 },
      );
    }

    const currency = (ticket as any).currency
      ? String((ticket as any).currency).toUpperCase()
      : "EUR";

    const totalCents = unitPriceCents * qty;

    const baseUrl = getBaseUrl(req);

    // 3) Criar sessão de checkout na Stripe
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          quantity: qty,
          price_data: {
            currency: currency.toLowerCase(),
            unit_amount: unitPriceCents,
            product_data: {
              name: `${event.title} — ${ticket.name}`,
              metadata: {
                eventId: String(event.id),
                eventSlug: event.slug ?? "",
                ticketId: ticket.id,
              },
            },
          },
        },
      ],
      metadata: {
        eventId: String(event.id),
        eventSlug: event.slug ?? "",
        ticketId: ticket.id,
        qty: String(qty),
        userId: userId ?? "",
        reservationId: reservation.id,
      },
      customer_email: userEmail ?? undefined,
      success_url:
        `${baseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}` +
        `&event=${encodeURIComponent(event.slug ?? "")}` +
        `&eventTitle=${encodeURIComponent(event.title)}` +
        `&ticketName=${encodeURIComponent(ticket.name)}` +
        `&qty=${qty}` +
        `&amount=${(totalCents / 100).toFixed(2)}` +
        `&currency=${encodeURIComponent(currency)}`,
      cancel_url:
        `${baseUrl}/checkout/cancel?event=${encodeURIComponent(
          event.slug ?? "",
        )}` +
        `&ticketName=${encodeURIComponent(ticket.name)}` +
        `&qty=${qty}` +
        `&amount=${(totalCents / 100).toFixed(2)}` +
        `&currency=${encodeURIComponent(currency)}`,
    });

    if (!session.url) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Não foi possível criar a sessão de checkout. Tenta novamente dentro de instantes.",
        },
        { status: 500 },
      );
    }

    // Se o pedido veio de um form (ou sem content-type explícito), fazemos redirect direto.
    if (
      !contentType ||
      contentType.includes("application/x-www-form-urlencoded") ||
      contentType.includes("multipart/form-data")
    ) {
      return NextResponse.redirect(session.url, { status: 303 });
    }

    // Para pedidos JSON (ex: fetch no client), devolvemos a URL em JSON.
    return NextResponse.json(
      {
        ok: true,
        url: session.url,
      },
      { status: 200 },
    );
  } catch (err: unknown) {
    console.error("[checkout] Erro inesperado:", err);
    return NextResponse.json(
      {
        ok: false,
        error: "Ocorreu um erro ao preparar o checkout.",
      },
      { status: 500 },
    );
  }
}