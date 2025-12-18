// app/api/organizador/estatisticas/time-series/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { Prisma, TicketStatus } from "@prisma/client";
import { getActiveOrganizerForUser } from "@/lib/organizerContext";

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
    const { organizer } = await getActiveOrganizerForUser(user.id);

    if (!organizer) {
      return NextResponse.json(
        { ok: false, error: "NOT_ORGANIZER" },
        { status: 403 }
      );
    }

    // 2) Preferir fonte de verdade: sale_summaries + sale_lines
    const createdAtFilter: Prisma.DateTimeFilter<"SaleSummary"> = {};
    if (from) createdAtFilter.gte = from;
    if (to) createdAtFilter.lte = to;

    const saleSummaries = await prisma.saleSummary.findMany({
      where: {
        ...(Object.keys(createdAtFilter).length > 0
          ? { createdAt: createdAtFilter }
          : {}),
        event: {
          organizerId: organizer.id,
        },
        eventId: eventId ?? undefined,
      },
      select: {
        createdAt: true,
        netCents: true,
        subtotalCents: true,
        discountCents: true,
        currency: true,
        lines: {
          select: {
            quantity: true,
          },
        },
      },
    });

    type DayBucket = {
      date: string; // YYYY-MM-DD
      tickets: number;
      revenueCents: number;
      grossCents: number;
      discountCents: number;
      platformFeeCents: number;
      currency: string | null;
    };

    const buckets: Record<string, DayBucket> = {};

    for (const s of saleSummaries) {
      const key = formatDayKey(s.createdAt);
      if (!buckets[key]) {
        buckets[key] = {
          date: key,
          tickets: 0,
          revenueCents: 0,
          grossCents: 0,
          discountCents: 0,
          platformFeeCents: 0,
          currency: s.currency ?? null,
        };
      }
      const qty = s.lines.reduce((acc, l) => acc + (l.quantity ?? 0), 0);
      buckets[key].tickets += qty;
      buckets[key].revenueCents += s.netCents ?? 0;
      buckets[key].grossCents += s.subtotalCents ?? 0;
      buckets[key].discountCents += s.discountCents ?? 0;
      buckets[key].platformFeeCents += s.platformFeeCents ?? 0;
    }

    // Fallback: se ainda não houver sale_summaries (ex.: legacy), usa tickets
    if (Object.keys(buckets).length === 0) {
      const purchasedAtFilter: Prisma.DateTimeFilter<"Ticket"> = {};
      if (from) purchasedAtFilter.gte = from;
      if (to) purchasedAtFilter.lte = to;

      const ticketWhere: Prisma.TicketWhereInput = {
        status: {
          in: [TicketStatus.ACTIVE, TicketStatus.USED],
        },
        purchasedAt:
          Object.keys(purchasedAtFilter).length > 0
            ? purchasedAtFilter
            : undefined,
        event: {
          organizerId: organizer.id,
        },
        eventId: eventId ?? undefined,
      };

      const tickets = await prisma.ticket.findMany({
        where: ticketWhere,
        select: {
          purchasedAt: true,
          pricePaid: true,
          currency: true,
          platformFeeCents: true,
        },
      });

      for (const t of tickets) {
        if (!t.purchasedAt) continue;
        const key = formatDayKey(t.purchasedAt);
        if (!buckets[key]) {
          buckets[key] = {
            date: key,
            tickets: 0,
            revenueCents: 0,
            grossCents: 0,
            discountCents: 0,
            platformFeeCents: 0,
            currency: t.currency ?? null,
          };
        }
        buckets[key].tickets += 1;
        const gross = t.pricePaid ?? 0;
        const fees = t.platformFeeCents ?? 0;
        buckets[key].grossCents += gross;
        buckets[key].platformFeeCents += fees;
        buckets[key].revenueCents += gross - fees;
        // desconto não disponível em legacy
      }
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
        points: points.map((p) => ({
          ...p,
          netCents: p.revenueCents,
        })),
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
