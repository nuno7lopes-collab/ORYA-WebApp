import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { TicketStatus } from "@prisma/client";

type Aggregate = {
  grossCents: number;
  netCents: number;
  feesCents: number;
  tickets: number;
};

export async function GET() {
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }

    const organizer = await prisma.organizer.findFirst({
      where: { userId: user.id, status: "ACTIVE" },
    });

    if (!organizer) {
      return NextResponse.json({ ok: false, error: "NOT_ORGANIZER" }, { status: 403 });
    }

    const events = await prisma.event.findMany({
      where: { organizerId: organizer.id },
      select: {
        id: true,
        title: true,
        slug: true,
        startsAt: true,
        status: true,
      },
      orderBy: { startsAt: "asc" },
    });
    const eventIds = events.map((e) => e.id);

    if (!eventIds.length) {
      return NextResponse.json(
        {
          ok: true,
          totals: { grossCents: 0, netCents: 0, feesCents: 0, tickets: 0, eventsWithSales: 0 },
          rolling: {
            last7: { grossCents: 0, netCents: 0, feesCents: 0, tickets: 0 },
            last30: { grossCents: 0, netCents: 0, feesCents: 0, tickets: 0 },
          },
          upcomingPayoutCents: 0,
          events: [],
        },
        { status: 200 }
      );
    }

    const now = new Date();
    const last7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const tickets = await prisma.ticket.findMany({
      where: {
        status: { in: [TicketStatus.ACTIVE, TicketStatus.USED] },
        eventId: { in: eventIds },
      },
      select: {
        pricePaid: true,
        platformFeeCents: true,
        purchasedAt: true,
        eventId: true,
      },
    });

    const totals: Aggregate = { grossCents: 0, netCents: 0, feesCents: 0, tickets: 0 };
    const agg7: Aggregate = { grossCents: 0, netCents: 0, feesCents: 0, tickets: 0 };
    const agg30: Aggregate = { grossCents: 0, netCents: 0, feesCents: 0, tickets: 0 };

    const eventStats = new Map<
      number,
      Aggregate & {
        status?: string | null;
        startsAt?: Date | null;
      }
    >();

    const addTo = (target: Aggregate, gross: number, fees: number) => {
      target.grossCents += gross;
      target.feesCents += fees;
      target.netCents += Math.max(0, gross - fees);
      target.tickets += 1;
    };

    for (const t of tickets) {
      const gross = t.pricePaid ?? 0;
      const fees = t.platformFeeCents ?? 0;
      addTo(totals, gross, fees);

      if (t.purchasedAt >= last30) addTo(agg30, gross, fees);
      if (t.purchasedAt >= last7) addTo(agg7, gross, fees);

      const current = eventStats.get(t.eventId) ?? {
        grossCents: 0,
        netCents: 0,
        feesCents: 0,
        tickets: 0,
        status: events.find((e) => e.id === t.eventId)?.status,
        startsAt: events.find((e) => e.id === t.eventId)?.startsAt ?? null,
      };
      addTo(current, gross, fees);
      eventStats.set(t.eventId, current);
    }

    const eventsWithSales = Array.from(eventStats.keys()).length;
    const upcomingPayoutCents = agg7.netCents;

    return NextResponse.json(
      {
        ok: true,
        totals: { ...totals, eventsWithSales },
        rolling: { last7: agg7, last30: agg30 },
        upcomingPayoutCents,
        events: events.map((ev) => {
          const stats = eventStats.get(ev.id) ?? {
            grossCents: 0,
            netCents: 0,
            feesCents: 0,
            tickets: 0,
          };
          return {
            ...ev,
            grossCents: stats.grossCents,
            netCents: stats.netCents,
            feesCents: stats.feesCents,
            ticketsSold: stats.tickets,
          };
        }),
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[organizador/finance/overview]", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
