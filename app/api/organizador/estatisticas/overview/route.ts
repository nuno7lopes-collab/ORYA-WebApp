// app/api/organizador/estatisticas/overview/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { TicketStatus, EventStatus, Prisma } from "@prisma/client";

/**
 * F6 – Estatísticas do organizador (overview)
 *
 * GET /api/organizador/estatisticas/overview
 *
 * Query params opcionais:
 *  - range: "7d" | "30d" | "all" (default: "30d")
 *
 * Devolve um resumo com:
 *  - totalTickets: nº de bilhetes vendidos no período
 *  - totalRevenueCents: soma de pricePaid no período
 *  - eventsWithSalesCount: nº de eventos com pelo menos 1 venda no período
 *  - activeEventsCount: nº de eventos publicados do organizador (no geral)
 */

export async function GET(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      console.error("[organizador/overview] Erro ao obter user:", authError);
    }

    if (!user) {
      return NextResponse.json(
        { ok: false, error: "UNAUTHENTICATED" },
        { status: 401 },
      );
    }

    const url = new URL(req.url);
    const range = url.searchParams.get("range") || "30d"; // 7d | 30d | all

    // Confirmar que o utilizador é organizador (roles no profile)
    const profile = await prisma.profile.findUnique({
      where: { id: user.id },
      select: { roles: true },
    });

    const roles = (profile?.roles || []) as string[];
    const isOrganizer = roles.includes("organizer") || roles.includes("ORGANIZER");

    if (!isOrganizer) {
      return NextResponse.json(
        { ok: false, error: "NOT_ORGANIZER" },
        { status: 403 },
      );
    }

    // Cálculo do intervalo temporal
    let fromDate: Date | undefined;
    let toDate: Date | undefined;

    const now = new Date();

    if (range === "7d") {
      fromDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      toDate = now;
    } else if (range === "30d") {
      fromDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      toDate = now;
    } else {
      // "all" -> sem filtro de datas
      fromDate = undefined;
      toDate = undefined;
    }

    // Construir where para tickets (eventos do organizador + estado do bilhete + intervalo)
    const ticketWhere: Prisma.TicketWhereInput = {
      status: {
        in: [TicketStatus.ACTIVE, TicketStatus.USED],
      },
      event: {
        // Assumimos que o Event tem campo ownerUserId (quem criou / organizador principal)
        ownerUserId: user.id,
      },
    };

    if (fromDate && toDate) {
      ticketWhere.purchasedAt = {
        gte: fromDate,
        lte: toDate,
      };
    }

    // Buscar todos os tickets relevantes para o período
    const tickets = await prisma.ticket.findMany({
      where: ticketWhere,
      select: {
        pricePaid: true,
        eventId: true,
      },
    });

    const totalTickets = tickets.length;
    const totalRevenueCents = tickets.reduce((sum, t) => sum + (t.pricePaid ?? 0), 0);

    const uniqueEventIds = Array.from(new Set(tickets.map((t) => t.eventId)));
    const eventsWithSalesCount = uniqueEventIds.length;

    // Contar eventos publicados do organizador (no geral, não só no período)
    const activeEventsCount = await prisma.event.count({
      where: {
        ownerUserId: user.id,
        status: EventStatus.PUBLISHED,
      },
    });

    return NextResponse.json(
      {
        ok: true,
        range,
        totalTickets,
        totalRevenueCents,
        eventsWithSalesCount,
        activeEventsCount,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[organizador/overview] Erro inesperado:", error);
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR" },
      { status: 500 },
    );
  }
}
