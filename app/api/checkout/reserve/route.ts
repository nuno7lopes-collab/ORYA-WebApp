// app/api/checkout/reserve/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { MAX_TICKETS_PER_WAVE } from "@/lib/tickets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RESERVATION_MINUTES = 10;

type ReserveBody = {
  eventSlug?: string;
  ticketTypeId?: string; // novo campo explícito
  ticketId?: string; // compatibilidade com código antigo, interpretado como ticketTypeId
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

    const { eventSlug, ticketTypeId, ticketId, qty: rawQty } = body;

    // suportar tanto ticketTypeId como ticketId (legacy)
    const effectiveTicketTypeId = ticketTypeId ?? ticketId;

    if (!eventSlug || !effectiveTicketTypeId || rawQty == null) {
      return NextResponse.json(
        {
          ok: false,
          error: "Faltam parâmetros obrigatórios.",
          code: "MISSING_PARAMS",
        },
        { status: 400 },
      );
    }

    const qty = Number(rawQty);

    if (!Number.isInteger(qty) || qty <= 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "Quantidade inválida.",
          code: "INVALID_QTY",
        },
        { status: 400 },
      );
    }

    if (qty > MAX_TICKETS_PER_WAVE) {
      return NextResponse.json(
        {
          ok: false,
          error: `Só podes reservar até ${MAX_TICKETS_PER_WAVE} bilhetes por wave.`,
          code: "QTY_ABOVE_LIMIT",
        },
        { status: 400 },
      );
    }

    // converter ticketTypeId (string) para number, porque no Prisma é Int
    const ticketTypeIdNumber = Number(effectiveTicketTypeId);
    if (!Number.isInteger(ticketTypeIdNumber) || ticketTypeIdNumber <= 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "Tipo de bilhete inválido.",
          code: "INVALID_TICKET_TYPE_ID",
        },
        { status: 400 },
      );
    }

    // 1) Sessão Supabase (login obrigatório)
    const supabase = await createSupabaseServer();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) {
      return NextResponse.json(
        { ok: false, error: "Não autenticado.", code: "NOT_AUTH" },
        { status: 401 },
      );
    }
    const userId = userData.user.id;

    // 2) Buscar evento + ticketTypes
    const event = await prisma.event.findUnique({
      where: { slug: eventSlug },
      include: { ticketTypes: true },
    });

    if (!event) {
      return NextResponse.json(
        { ok: false, error: "Evento não encontrado.", code: "EVENT_NOT_FOUND" },
        { status: 404 },
      );
    }
    const profile = await prisma.profile.findUnique({ where: { id: userId } });
    const isAdmin = Array.isArray(profile?.roles) ? profile.roles.includes("admin") : false;
    if (event.isTest && !isAdmin) {
      return NextResponse.json(
        { ok: false, error: "Evento não disponível.", code: "EVENT_NOT_FOUND" },
        { status: 404 },
      );
    }

    const ticketType = event.ticketTypes.find(
      (t) => t.id === ticketTypeIdNumber,
    );

    if (!ticketType) {
      return NextResponse.json(
        {
          ok: false,
          error: "Tipo de bilhete inválido.",
          code: "TICKET_TYPE_NOT_FOUND",
        },
        { status: 404 },
      );
    }

    // 3) Validar stock disponível com base no TicketType (conta reservas ativas de outros)
    const now = new Date();
    const activeReservations = await prisma.ticketReservation.findMany({
      where: {
        ticketTypeId: ticketTypeIdNumber,
        status: "ACTIVE",
        expiresAt: { gt: now },
      },
      select: {
        id: true,
        quantity: true,
        userId: true,
      },
    });

    const reservedByOthers = activeReservations.reduce((acc, r) => {
      if (r.userId && r.userId === userId) return acc;
      return acc + r.quantity;
    }, 0);

    const remaining =
      ticketType.totalQuantity !== null &&
      ticketType.totalQuantity !== undefined
        ? ticketType.totalQuantity - ticketType.soldQuantity - reservedByOthers
        : Infinity;

    if (remaining <= 0) {
      return NextResponse.json(
        { ok: false, error: "Sem stock.", code: "OUT_OF_STOCK" },
        { status: 409 },
      );
    }

    if (qty > remaining) {
      return NextResponse.json(
        {
          ok: false,
          error: "Quantidade excede stock disponível.",
          code: "QUANTITY_EXCEEDS_STOCK",
        },
        { status: 409 },
      );
    }

    // 4) Criar ou atualizar reserva manualmente (porque não há unique composto no Prisma)
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + RESERVATION_MINUTES);

    let reservation = await prisma.ticketReservation.findFirst({
      where: {
        userId,
        eventId: event.id,
        ticketTypeId: ticketTypeIdNumber, // <- número, não string
        status: "ACTIVE",
      },
    });

    if (reservation) {
      reservation = await prisma.ticketReservation.update({
        where: { id: reservation.id },
        data: {
          quantity: qty,
          expiresAt,
          status: "ACTIVE",
        },
      });
    } else {
      reservation = await prisma.ticketReservation.create({
        data: {
          userId,
          eventId: event.id,
          ticketTypeId: ticketTypeIdNumber, // <- número, não string
          quantity: qty,
          status: "ACTIVE",
          expiresAt,
        },
      });
    }

    return NextResponse.json({
      ok: true,
      reservation: {
        id: reservation.id,
        expiresAt,
        quantity: reservation.quantity,
      },
    });
  } catch (error) {
    console.error("Error in reserve route:", error);
    return NextResponse.json(
      { ok: false, error: "Erro interno.", code: "SERVER_ERROR" },
      { status: 500 },
    );
  }
}
