// app/api/checkout/reserve/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";

const RESERVATION_MINUTES = 10;

type ReserveBody = {
  eventSlug?: string;
  ticketId?: string;
  qty?: number;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as ReserveBody | null;

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { ok: false, error: "Body inválido.", code: "INVALID_BODY" },
        { status: 400 },
      );
    }

    const eventSlug = body.eventSlug?.trim();
    const ticketId = body.ticketId?.trim();
    const qty =
      typeof body.qty === "number" && body.qty > 0
        ? Math.floor(body.qty)
        : 1;

    if (!eventSlug || !ticketId) {
      return NextResponse.json(
        {
          ok: false,
          error: "eventSlug e ticketId são obrigatórios.",
          code: "MISSING_FIELDS",
        },
        { status: 400 },
      );
    }

    // 1) User autenticado (obrigatório para reservar)
    let userId: string | null = null;
    try {
      const supabase = await createSupabaseServer();
      const { data: userData } = await supabase.auth.getUser();

      if (!userData?.user) {
        return NextResponse.json(
          {
            ok: false,
            error: "Precisas de iniciar sessão para reservar bilhetes.",
            code: "NOT_AUTHENTICATED",
          },
          { status: 401 },
        );
      }

      userId = userData.user.id;
    } catch (authErr) {
      console.error(
        "[POST /api/checkout/reserve] Erro ao obter utilizador do Supabase:",
        authErr,
      );
      return NextResponse.json(
        {
          ok: false,
          error:
            "Não foi possível validar a tua sessão. Tenta iniciar sessão novamente.",
          code: "AUTH_ERROR",
        },
        { status: 500 },
      );
    }

    // 2) Buscar evento + ticket
    const event = await prisma.event.findUnique({
      where: { slug: eventSlug },
      include: { tickets: true },
    });

    if (!event) {
      return NextResponse.json(
        { ok: false, error: "Evento não encontrado.", code: "EVENT_NOT_FOUND" },
        { status: 404 },
      );
    }

        const ticket = event.tickets.find(
      (t: { id: string }) => t.id === ticketId,
    );

    if (!ticket) {
      return NextResponse.json(
        {
          ok: false,
          error: "Bilhete não encontrado para este evento.",
          code: "TICKET_NOT_FOUND",
        },
        { status: 404 },
      );
    }

    const now = new Date();
    // LIMPEZA SOFT: Expirar reservas que já passaram o prazo
    await prisma.ticketReservation.updateMany({
      where: {
        status: "ACTIVE",
        expiresAt: { lt: now },
      },
      data: { status: "EXPIRED" },
    });


    // 🔧 C) Auto-heal de reservas expiradas — remover e permitir criar nova automaticamente
    // Se o utilizador tinha uma reserva antiga expirada, apagamos para evitar conflitos futuros
    await prisma.ticketReservation.deleteMany({
      where: {
        ticketId,
        eventId: event.id,
        userId,
        status: "EXPIRED",
      },
    });

    // Disponibilidade base
    if (!ticket.available || !ticket.isVisible) {
      return NextResponse.json(
        {
          ok: false,
          error: "Este bilhete não está disponível.",
          code: "TICKET_UNAVAILABLE",
        },
        { status: 400 },
      );
    }

    // 2.1) Janela temporal da wave (abertura/fecho)
    const nowMs = now.getTime();
    const startsAtMs = ticket.startsAt ? ticket.startsAt.getTime() : null;
    const endsAtMs = ticket.endsAt ? ticket.endsAt.getTime() : null;

    if (startsAtMs && nowMs < startsAtMs) {
      return NextResponse.json(
        {
          ok: false,
          error: "As reservas para esta wave ainda não abriram.",
          code: "SALES_NOT_STARTED",
        },
        { status: 400 },
      );
    }

    if (endsAtMs && nowMs > endsAtMs) {
      return NextResponse.json(
        {
          ok: false,
          error: "As reservas para esta wave já encerraram.",
          code: "SALES_CLOSED",
        },
        { status: 400 },
      );
    }

    // 3) Calcular stock real = total - sold - reservas ativas
    let remaining: number | null = null;

    if (
      ticket.totalQuantity !== null &&
      ticket.totalQuantity !== undefined
    ) {
      const activeReservations = await prisma.ticketReservation.aggregate({
        where: {
          ticketId: ticket.id,
          status: "ACTIVE",
          expiresAt: { gt: now },
        },
        _sum: { quantity: true },
      });

      const reservedQty = activeReservations._sum.quantity ?? 0;

      // 📌 A) Stock premium: ignorar soldQuantity e contar só reservas ativas
      // Isto faz com que ao apagar compras no Prisma Studio, o stock volte a 100% automaticamente.
      remaining = ticket.totalQuantity - reservedQty;

      if (remaining <= 0) {
        return NextResponse.json(
          {
            ok: false,
            error: "Não há mais lugares disponíveis nesta wave.",
            code: "SOLD_OUT",
          },
          { status: 400 },
        );
      }

      if (qty > remaining) {
        return NextResponse.json(
          {
            ok: false,
            error: `Só há ${remaining} bilhete(s) disponíveis nesta wave.`,
            code: "NOT_ENOUGH_STOCK",
          },
          { status: 400 },
        );
      }
    }

    // 4) Reutilizar reserva ativa do próprio user (se existir)
    let reservation = await prisma.ticketReservation.findFirst({
      where: {
        ticketId: ticket.id,
        eventId: event.id,
        userId,
        status: "ACTIVE",
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: "desc" },
    });

    // 🛑 D) Se já existe uma reserva ativa → não criar nova, não renovar timer
    if (reservation) {
      return NextResponse.json(
        {
          ok: true,
          reservationId: reservation.id,
          expiresAt: reservation.expiresAt.toISOString(),
          now: now.toISOString(),
        },
        { status: 200 },
      );
    }

    const newExpiresAt = new Date(
      now.getTime() + RESERVATION_MINUTES * 60 * 1000,
    );

    if (!reservation) {
      // Não existe reserva → criar nova com 10 minutos
      reservation = await prisma.ticketReservation.create({
        data: {
          ticketId: ticket.id,
          eventId: event.id,
          userId,
          quantity: qty,
          expiresAt: newExpiresAt,
        },
      });
    }

    return NextResponse.json(
      {
        ok: true,
        reservationId: reservation.id,
        expiresAt: reservation.expiresAt.toISOString(),
        now: now.toISOString(),
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("[POST /api/checkout/reserve] ERROR", err);
    return NextResponse.json(
      {
        ok: false,
        error:
          "Erro interno ao criar/renovar a reserva. Tenta novamente dentro de instantes.",
        code: "INTERNAL_ERROR",
      },
      { status: 500 },
    );
  }
}