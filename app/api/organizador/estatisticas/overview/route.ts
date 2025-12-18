// app/api/organizador/estatisticas/overview/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { TicketStatus, EventStatus, Prisma } from "@prisma/client";
import { getActiveOrganizerForUser } from "@/lib/organizerContext";
import { isOrgAdminOrAbove } from "@/lib/organizerPermissions";

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

    const { organizer, membership } = await getActiveOrganizerForUser(user.id, {
      roles: ["OWNER", "CO_OWNER", "ADMIN"],
    });

    if (!organizer || !membership || !isOrgAdminOrAbove(membership.role)) {
      return NextResponse.json({ ok: false, error: "NOT_ORGANIZER" }, { status: 403 });
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

    // Fonte preferencial: sale_summaries + sale_lines
    const createdAtFilter: Prisma.DateTimeFilter<"SaleSummary"> = {};
    if (fromDate) createdAtFilter.gte = fromDate;
    if (toDate) createdAtFilter.lte = toDate;

    const summaries = await prisma.saleSummary.findMany({
      where: {
        ...(Object.keys(createdAtFilter).length > 0
          ? { createdAt: createdAtFilter }
          : {}),
        event: { organizerId: organizer.id },
      },
      select: {
        id: true,
        eventId: true,
        netCents: true,
        discountCents: true,
        platformFeeCents: true,
        subtotalCents: true,
        lines: {
          select: { quantity: true },
        },
      },
    });

    let totalTickets = summaries.reduce(
      (acc, s) => acc + s.lines.reduce((q, l) => q + (l.quantity ?? 0), 0),
      0,
    );
    let grossCents = summaries.reduce((acc, s) => acc + (s.subtotalCents ?? 0), 0);
    let discountCents = summaries.reduce((acc, s) => acc + (s.discountCents ?? 0), 0);
    let platformFeeCents = summaries.reduce(
      (acc, s) => acc + (s.platformFeeCents ?? 0),
      0,
    );
    let netRevenueCents = summaries.reduce((acc, s) => acc + (s.netCents ?? 0), 0);

    let eventsWithSalesCount = new Set(summaries.map((s) => s.eventId)).size;

    // Fallback para legacy (caso ainda não haja sale_summaries)
    if (summaries.length === 0) {
      const ticketWhere: Prisma.TicketWhereInput = {
        status: {
          in: [TicketStatus.ACTIVE, TicketStatus.USED],
        },
        event: {
          organizerId: organizer.id,
        },
      };

      if (fromDate && toDate) {
        ticketWhere.purchasedAt = {
          gte: fromDate,
          lte: toDate,
        };
      }

      const tickets = await prisma.ticket.findMany({
        where: ticketWhere,
        select: {
          pricePaid: true,
          eventId: true,
        },
      });

      totalTickets = tickets.length;
      grossCents = tickets.reduce((sum, t) => sum + (t.pricePaid ?? 0), 0);
      // sem breakdown legacy: assumimos sem desconto/fee explícito
      discountCents = 0;
      platformFeeCents = 0;
      netRevenueCents = grossCents;
      eventsWithSalesCount = new Set(tickets.map((t) => t.eventId)).size;
    }

    // Contar eventos publicados do organizador (no geral, não só no período)
    const activeEventsCount = await prisma.event.count({
      where: {
        organizerId: organizer.id,
        status: EventStatus.PUBLISHED,
      },
    });

    return NextResponse.json(
      {
        ok: true,
        range,
        totalTickets,
        totalRevenueCents: netRevenueCents,
        grossCents,
        discountCents,
        platformFeeCents,
        netRevenueCents,
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
