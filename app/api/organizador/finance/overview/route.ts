import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { TicketStatus } from "@prisma/client";
import { getActiveOrganizerForUser } from "@/lib/organizerContext";
import { isOrgAdminOrAbove } from "@/lib/organizerPermissions";
import { getStripeBaseFees } from "@/lib/platformSettings";

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

    const { organizer, membership } = await getActiveOrganizerForUser(user.id);

    if (!organizer || !membership || !isOrgAdminOrAbove(membership.role)) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const events = await prisma.event.findMany({
      where: { organizerId: organizer.id },
      select: {
        id: true,
        title: true,
        slug: true,
        startsAt: true,
        status: true,
        payoutMode: true,
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
    const stripeBaseFees = await getStripeBaseFees();
    const estimateStripeFee = (amountCents: number) =>
      Math.max(
        0,
        Math.round((amountCents * (stripeBaseFees.feeBps ?? 0)) / 10_000) +
          (stripeBaseFees.feeFixedCents ?? 0),
      );

    // Fonte preferencial: SaleSummary/SaleLine
    const summaries = await prisma.saleSummary.findMany({
      where: {
        eventId: { in: eventIds },
      },
      select: {
        id: true,
        eventId: true,
        createdAt: true,
        subtotalCents: true,
        discountCents: true,
        platformFeeCents: true,
        stripeFeeCents: true,
        netCents: true,
        totalCents: true,
        lines: {
          select: { quantity: true },
        },
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

    const addTo = (target: Aggregate, gross: number, fees: number, net: number, qty: number) => {
      target.grossCents += gross;
      target.feesCents += fees;
      target.netCents += net;
      target.tickets += qty;
    };

    for (const s of summaries) {
      const qty = s.lines.reduce((q, l) => q + (l.quantity ?? 0), 0);
      const gross = s.subtotalCents ?? 0;
      const platformFee = s.platformFeeCents ?? 0;
      const totalCents = s.totalCents ?? gross;
      const stripeFee =
        s.stripeFeeCents != null && s.stripeFeeCents > 0
          ? s.stripeFeeCents
          : estimateStripeFee(totalCents);
      const totalFees = platformFee + stripeFee;
      const net =
        s.netCents != null && s.netCents >= 0
          ? s.netCents
          : Math.max(0, totalCents - totalFees);

      addTo(totals, gross, totalFees, net, qty);
      if (s.createdAt >= last30) addTo(agg30, gross, totalFees, net, qty);
      if (s.createdAt >= last7) addTo(agg7, gross, totalFees, net, qty);

      const current = eventStats.get(s.eventId) ?? {
        grossCents: 0,
        netCents: 0,
        feesCents: 0,
        tickets: 0,
        status: events.find((e) => e.id === s.eventId)?.status,
        startsAt: events.find((e) => e.id === s.eventId)?.startsAt ?? null,
      };
      addTo(current, gross, fees, net, qty);
      eventStats.set(s.eventId, current);
    }

    // Pré-carregar payment_events para alocar fees reais (ou estimadas) por PaymentIntent
    const ticketIntents = await prisma.paymentEvent.findMany({
      where: { eventId: { in: eventIds } },
      select: { stripePaymentIntentId: true, stripeFeeCents: true, platformFeeCents: true, amountCents: true },
    });
    const intentMap = new Map<
      string,
      { stripeFeeCents: number | null; platformFeeCents: number; amountCents: number | null; tickets: number }
    >();
    ticketIntents.forEach((pe) => {
      if (!pe.stripePaymentIntentId) return;
      intentMap.set(pe.stripePaymentIntentId, {
        stripeFeeCents: pe.stripeFeeCents ?? null,
        platformFeeCents: pe.platformFeeCents ?? 0,
        amountCents: pe.amountCents ?? null,
        tickets: 0,
      });
    });

    // Fallback se não existir SaleSummary: usar tickets legacy + fees de payment_events (ou estimativa)
    if (summaries.length === 0) {
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
          totalPaidCents: true,
          event: { select: { payoutMode: true } },
        },
      });

      for (const t of tickets) {
        const gross = t.pricePaid ?? 0;
        const platformFee = t.platformFeeCents ?? 0;
        const total = (t.totalPaidCents ?? gross) + platformFee;

        if (t.stripePaymentIntentId) {
          const entry = intentMap.get(t.stripePaymentIntentId) ?? null;
          if (entry) {
            entry.tickets += 1;
            intentMap.set(t.stripePaymentIntentId, entry);
          }
        }
      }

      // Alocar fees dos payment_events (ou estimar) por intent
      const feePerIntent = new Map<string, { stripeFeePerTicket: number; platformFeePerTicket: number }>();
      intentMap.forEach((entry, intentId) => {
        if (entry.tickets <= 0) return;
        const stripeFee =
          entry.stripeFeeCents != null
            ? entry.stripeFeeCents
            : estimateStripeFee(entry.amountCents ?? 0);
        const stripePer = Math.round(stripeFee / entry.tickets);
        const platformPer = Math.round((entry.platformFeeCents ?? 0) / entry.tickets);
        feePerIntent.set(intentId, { stripeFeePerTicket: stripePer, platformFeePerTicket: platformPer });
      });

      for (const t of tickets) {
        const gross = t.pricePaid ?? 0;
        const platformFee = t.platformFeeCents ?? 0;
        const total = (t.totalPaidCents ?? gross) + platformFee;
        const feeAlloc = t.stripePaymentIntentId ? feePerIntent.get(t.stripePaymentIntentId) : null;
        const stripeFee =
          feeAlloc && feeAlloc.stripeFeePerTicket > 0
            ? feeAlloc.stripeFeePerTicket
            : estimateStripeFee(total);
        const totalFees = platformFee + stripeFee;
        const net = Math.max(0, total - totalFees);
        addTo(totals, gross, totalFees, net, 1);

        if (t.purchasedAt >= last30) addTo(agg30, gross, totalFees, net, 1);
        if (t.purchasedAt >= last7) addTo(agg7, gross, totalFees, net, 1);

        const current = eventStats.get(t.eventId) ?? {
          grossCents: 0,
          netCents: 0,
          feesCents: 0,
          tickets: 0,
          status: events.find((e) => e.id === t.eventId)?.status,
          startsAt: events.find((e) => e.id === t.eventId)?.startsAt ?? null,
        };
        addTo(current, gross, totalFees, net, 1);
        eventStats.set(t.eventId, current);
      }
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
