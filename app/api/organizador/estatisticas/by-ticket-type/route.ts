// app/api/organizador/estatisticas/by-ticket-type/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { TicketStatus } from "@prisma/client";

/**
 * 6.3 – API por tipo de bilhete (waves)
 *
 * GET /api/organizador/estatisticas/by-ticket-type?eventId=123
 * (opcionalmente também suporta ?eventSlug=slug-do-evento)
 *
 * Resposta:
 * {
 *   ok: true,
 *   eventId: number,
 *   items: [
 *     {
 *       ticketTypeId: string;
 *       ticketTypeName: string | null;
 *       soldTickets: number;
 *       revenueCents: number;
 *       currency: string | null;
 *     },
 *     ...
 *   ]
 * }
 */

export async function GET(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      console.error(
        "[by-ticket-type] Erro ao obter utilizador autenticado:",
        authError
      );
    }

    if (!user) {
      return NextResponse.json(
        { ok: false, error: "UNAUTHENTICATED" },
        { status: 401 }
      );
    }

    const { searchParams } = req.nextUrl;

    const eventIdParam = searchParams.get("eventId");
    const eventSlugParam = searchParams.get("eventSlug");

    if (!eventIdParam && !eventSlugParam) {
      return NextResponse.json(
        {
          ok: false,
          error: "MISSING_EVENT_IDENTIFIER",
          message: "Indica eventId ou eventSlug.",
        },
        { status: 400 }
      );
    }

    let eventIdNum: number | null = null;
    if (eventIdParam) {
      const n = Number(eventIdParam);
      if (!Number.isFinite(n)) {
        return NextResponse.json(
          { ok: false, error: "INVALID_EVENT_ID" },
          { status: 400 }
        );
      }
      eventIdNum = n;
    }

    // Filtros de datas opcionais (from/to em ISO)
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");

    const fromDate =
      fromParam && !Number.isNaN(Date.parse(fromParam))
        ? new Date(fromParam)
        : null;
    const toDate =
      toParam && !Number.isNaN(Date.parse(toParam)) ? new Date(toParam) : null;

    // 1) Garantir que este evento pertence ao utilizador (ownerUserId)
    const event = await prisma.event.findFirst({
      where: {
        ...(eventIdNum !== null ? { id: eventIdNum } : {}),
        ...(eventSlugParam ? { slug: eventSlugParam } : {}),
        ownerUserId: user.id,
      },
    });

    if (!event) {
      return NextResponse.json(
        { ok: false, error: "EVENT_NOT_FOUND_OR_NOT_OWNER" },
        { status: 404 }
      );
    }

    // 2) Agrupar tickets por ticketTypeId para este evento
    const ticketsGrouped = await prisma.ticket.groupBy({
      by: ["ticketTypeId"],
      where: {
        eventId: event.id,
        status: {
          in: [TicketStatus.ACTIVE, TicketStatus.USED],
        },
        ...(fromDate || toDate
          ? {
              purchasedAt: {
                ...(fromDate ? { gte: fromDate } : {}),
                ...(toDate ? { lte: toDate } : {}),
              },
            }
          : {}),
      },
      _count: {
        _all: true,
      },
      _sum: {
        pricePaid: true,
      },
    });

    if (ticketsGrouped.length === 0) {
      return NextResponse.json(
        {
          ok: true,
          eventId: event.id,
          items: [],
        },
        { status: 200 }
      );
    }

    const ticketTypeIds = ticketsGrouped
      .map((g) => g.ticketTypeId)
      .filter((id): id is number => id != null);

    const ticketTypes = await prisma.ticketType.findMany({
      where: {
        id: { in: ticketTypeIds },
        eventId: event.id,
      },
    });

    const ticketTypeMap = new Map(
      ticketTypes.map((tt) => [tt.id, tt] as const)
    );

    const items = ticketsGrouped.map((g) => {
      const tt = g.ticketTypeId ? ticketTypeMap.get(g.ticketTypeId) : null;

      return {
        ticketTypeId: g.ticketTypeId,
        ticketTypeName: tt?.name ?? null,
        soldTickets: g._count._all,
        revenueCents: g._sum.pricePaid ?? 0,
        currency: tt?.currency ?? null,
      };
    });

    return NextResponse.json(
      {
        ok: true,
        eventId: event.id,
        items,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(
      "[by-ticket-type] Erro inesperado ao calcular estatísticas:",
      error
    );
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}