// app/api/organizador/estatisticas/by-ticket-type/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { isOrgAdminOrAbove } from "@/lib/organizerPermissions";

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

    // 1) Garantir que este evento pertence a um organizer onde o utilizador tem permissões
    const event = await prisma.event.findFirst({
      where: {
        ...(eventIdNum !== null ? { id: eventIdNum } : {}),
        ...(eventSlugParam ? { slug: eventSlugParam } : {}),
      },
      select: { id: true, organizerId: true },
    });

    if (!event) {
      return NextResponse.json(
        { ok: false, error: "EVENT_NOT_FOUND_OR_NOT_OWNER" },
        { status: 404 }
      );
    }

    const membership = await prisma.organizerMember.findUnique({
      where: { organizerId_userId: { organizerId: event.organizerId, userId: user.id } },
    });
    if (!membership || !isOrgAdminOrAbove(membership.role)) {
      return NextResponse.json({ ok: false, error: "NOT_ORGANIZER" }, { status: 403 });
    }

    // 2) Agrupar por ticketType usando SaleLine (fonte de verdade)
    const saleLineWhere = {
      eventId: event.id,
      saleSummary: {
        ...(fromDate || toDate
          ? {
              createdAt: {
                ...(fromDate ? { gte: fromDate } : {}),
                ...(toDate ? { lte: toDate } : {}),
              },
            }
          : {}),
      },
    };

    const saleLinesGrouped = await prisma.saleLine.groupBy({
      by: ["ticketTypeId"],
      where: saleLineWhere,
      _sum: {
        quantity: true,
        netCents: true,
        grossCents: true,
        platformFeeCents: true,
      },
    });

    const ticketTypeIds = saleLinesGrouped
      .map((g) => g.ticketTypeId)
      .filter((id): id is number => id != null);

    const ticketTypes = await prisma.ticketType.findMany({
      where: {
        id: { in: ticketTypeIds },
        eventId: event.id,
      },
    });

    const ticketTypeMap = new Map(ticketTypes.map((tt) => [tt.id, tt] as const));

    let items = saleLinesGrouped.map((g) => {
      const tt = g.ticketTypeId ? ticketTypeMap.get(g.ticketTypeId) : null;
      const gross = g._sum.grossCents ?? 0;
      const fees = g._sum.platformFeeCents ?? 0;
      const net = g._sum.netCents ?? 0;
      const discount = Math.max(0, gross - fees - net);
      return {
        ticketTypeId: g.ticketTypeId,
        ticketTypeName: tt?.name ?? null,
        soldTickets: g._sum.quantity ?? 0,
        revenueCents: net,
        grossCents: gross,
        discountCents: discount,
        platformFeeCents: fees,
        netCents: net,
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
