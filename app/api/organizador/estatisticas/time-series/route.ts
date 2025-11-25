// app/api/organizador/estatisticas/time-series/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { Prisma, TicketStatus } from "@prisma/client";

function parseRangeParams(url: URL) {
  const range = url.searchParams.get("range");
  const fromParam = url.searchParams.get("from");
  const toParam = url.searchParams.get("to");

  let from: Date | null = null;
  let to: Date | null = null;

  if (fromParam || toParam) {
    if (fromParam) {
      const d = new Date(fromParam);
      if (!Number.isNaN(d.getTime())) from = d;
    }
    if (toParam) {
      const d = new Date(toParam);
      if (!Number.isNaN(d.getTime())) to = d;
    }
  } else if (range) {
    const now = new Date();
    to = now;
    const base = new Date(now);

    switch (range) {
      case "7d": {
        base.setDate(base.getDate() - 7);
        from = base;
        break;
      }
      case "30d": {
        base.setDate(base.getDate() - 30);
        from = base;
        break;
      }
      case "90d": {
        base.setDate(base.getDate() - 90);
        from = base;
        break;
      }
      default:
        // "all" ou desconhecido -> deixamos from = null (sem limite inferior)
        from = null;
    }
  }

  return { from, to };
}

function formatDayKey(date: Date) {
  // YYYY-MM-DD
  return date.toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      console.error(
        "[organizador/time-series] Erro ao obter utilizador:",
        authError
      );
    }

    if (!user) {
      return NextResponse.json(
        { ok: false, error: "UNAUTHENTICATED" },
        { status: 401 }
      );
    }

    const url = new URL(req.url);
    const eventIdParam = url.searchParams.get("eventId");
    const { from, to } = parseRangeParams(url);

    let eventId: number | null = null;
    if (eventIdParam) {
      const parsed = Number(eventIdParam);
      if (Number.isNaN(parsed)) {
        return NextResponse.json(
          { ok: false, error: "INVALID_EVENT_ID" },
          { status: 400 }
        );
      }
      eventId = parsed;
    }

    // 1) Garantir que o user é um organizador ativo
    const organizer = await prisma.organizer.findFirst({
      where: {
        userId: user.id,
        status: "ACTIVE",
      },
    });

    if (!organizer) {
      return NextResponse.json(
        { ok: false, error: "NOT_ORGANIZER" },
        { status: 403 }
      );
    }

    // 2) Buscar tickets dos eventos deste organizer no intervalo de datas
    const purchasedAtFilter: Prisma.DateTimeNullableFilter = {};
    if (from) purchasedAtFilter.gte = from;
    if (to) purchasedAtFilter.lte = to;

    const where: Prisma.TicketWhereInput = {
      status: {
        in: [TicketStatus.ACTIVE, TicketStatus.USED],
      },
      purchasedAt:
        Object.keys(purchasedAtFilter).length > 0 ? purchasedAtFilter : undefined,
      event: {
        organizerId: organizer.id,
      },
      eventId: eventId ?? undefined,
    };

    const tickets = await prisma.ticket.findMany({
      where,
      select: {
        purchasedAt: true,
        pricePaid: true,
        currency: true,
      },
    });

    // 3) Agregar por dia
    type DayBucket = {
      date: string; // YYYY-MM-DD
      tickets: number;
      revenueCents: number;
      currency: string | null;
    };

    const buckets: Record<string, DayBucket> = {};

    for (const t of tickets) {
      if (!t.purchasedAt) continue;

      const key = formatDayKey(t.purchasedAt);

      if (!buckets[key]) {
        buckets[key] = {
          date: key,
          tickets: 0,
          revenueCents: 0,
          currency: t.currency ?? null,
        };
      }

      buckets[key].tickets += 1;
      buckets[key].revenueCents += t.pricePaid ?? 0;
      // se por alguma razão tiver currencies diferentes, mantemos a primeira
    }

    const points = Object.values(buckets).sort((a, b) =>
      a.date.localeCompare(b.date)
    );

    return NextResponse.json(
      {
        ok: true,
        range: {
          from: from ? from.toISOString() : null,
          to: to ? to.toISOString() : null,
        },
        points,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(
      "[organizador/time-series] Erro interno ao gerar série temporal:",
      error
    );
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
