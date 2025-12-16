// app/api/admin/payments/overview/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getStripeBaseFees } from "@/lib/platformSettings";
import type { Prisma, PaymentMode } from "@prisma/client";

type Aggregate = {
  grossCents: number;
  discountCents: number;
  platformFeeCents: number;
  stripeFeeCents: number;
  netCents: number;
  tickets: number;
};

async function ensureAdmin() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { ok: false as const, status: 401 as const, reason: "UNAUTHENTICATED" };
  }

  const profile = await prisma.profile.findUnique({
    where: { id: user.id },
    select: { roles: true },
  });
  const roles = profile?.roles ?? [];
  const isAdmin = Array.isArray(roles) && roles.includes("admin");
  if (!isAdmin) {
    return { ok: false as const, status: 403 as const, reason: "FORBIDDEN" };
  }
  return { ok: true as const };
}

const emptyAgg: Aggregate = {
  grossCents: 0,
  discountCents: 0,
  platformFeeCents: 0,
  stripeFeeCents: 0,
  netCents: 0,
  tickets: 0,
};

export async function GET(req: NextRequest) {
  try {
    const admin = await ensureAdmin();
    if (!admin.ok) {
      return NextResponse.json({ ok: false, error: admin.reason }, { status: admin.status });
    }

    const url = new URL(req.url);
    const organizerId = Number(url.searchParams.get("organizerId"));
    const eventId = Number(url.searchParams.get("eventId"));
    const modeParam = (url.searchParams.get("mode") || "ALL").toUpperCase();
    const fromParam = url.searchParams.get("from");
    const toParam = url.searchParams.get("to");

    const fromDate = fromParam ? new Date(fromParam) : null;
    const toDate = toParam ? new Date(toParam) : null;

    const stripeFees = await getStripeBaseFees();
    const estimateStripeFee = (amountCents: number) =>
      Math.max(
        0,
        Math.round((amountCents * (stripeFees.feeBps ?? 0)) / 10_000) +
          (stripeFees.feeFixedCents ?? 0),
      );

    // Filtrar intents por modo (TEST/LIVE) via payment_events
    let paymentIntentIds: string[] | null = null;
    if (modeParam === "LIVE" || modeParam === "TEST") {
      const modeFilter: Prisma.PaymentEventWhereInput = { mode: modeParam as PaymentMode };
      if (Number.isFinite(eventId)) {
        modeFilter.eventId = Number(eventId);
      }
      const events = await prisma.paymentEvent.findMany({
        where: modeFilter,
        select: { stripePaymentIntentId: true },
      });
      paymentIntentIds = events.map((e) => e.stripePaymentIntentId).filter(Boolean) as string[];
      if (paymentIntentIds.length === 0) {
        return NextResponse.json(
          { ok: true, totals: emptyAgg, byOrganizer: [], period: { from: fromDate, to: toDate } },
          { status: 200 },
        );
      }
    }

    const where: Prisma.SaleSummaryWhereInput = {};
    if (Number.isFinite(organizerId)) {
      where.event = { organizerId: Number(organizerId) };
    }
    if (Number.isFinite(eventId)) {
      where.eventId = Number(eventId);
    }
    if (paymentIntentIds) {
      where.paymentIntentId = { in: paymentIntentIds };
    }
    if (fromDate || toDate) {
      where.createdAt = {};
      if (fromDate) where.createdAt.gte = fromDate;
      if (toDate) where.createdAt.lte = toDate;
    }

    const summaries = await prisma.saleSummary.findMany({
      where,
      select: {
        id: true,
        eventId: true,
        subtotalCents: true,
        discountCents: true,
        platformFeeCents: true,
        stripeFeeCents: true,
        totalCents: true,
        netCents: true,
        createdAt: true,
        lines: { select: { quantity: true } },
        event: { select: { organizerId: true, title: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 1000, // segurança para não explodir o painel
    });

    const totals: Aggregate = { ...emptyAgg };
    const byOrganizer = new Map<
      number,
      Aggregate & { organizerId: number; events: Set<number> }
    >();

    const add = (orgId: number, agg: Aggregate, eventIdValue: number) => {
      if (!byOrganizer.has(orgId)) {
        byOrganizer.set(orgId, { ...emptyAgg, organizerId: orgId, events: new Set() });
      }
      const target = byOrganizer.get(orgId)!;
      target.grossCents += agg.grossCents;
      target.discountCents += agg.discountCents;
      target.platformFeeCents += agg.platformFeeCents;
      target.stripeFeeCents += agg.stripeFeeCents;
      target.netCents += agg.netCents;
      target.tickets += agg.tickets;
      target.events.add(eventIdValue);
    };

    for (const s of summaries) {
      const gross = s.subtotalCents ?? 0;
      const discount = s.discountCents ?? 0;
      const platformFee = s.platformFeeCents ?? 0;
      const total = s.totalCents ?? gross - discount + platformFee;
      const stripeFee = s.stripeFeeCents != null ? s.stripeFeeCents : estimateStripeFee(total);
      const net =
        s.netCents != null && s.netCents >= 0
          ? s.netCents
          : Math.max(0, total - platformFee - stripeFee);
      const tickets = s.lines.reduce((acc, l) => acc + (l.quantity ?? 0), 0);

      totals.grossCents += gross;
      totals.discountCents += discount;
      totals.platformFeeCents += platformFee;
      totals.stripeFeeCents += stripeFee;
      totals.netCents += net;
      totals.tickets += tickets;

      const organizerKey = s.event?.organizerId ?? 0;
      add(organizerKey, { grossCents: gross, discountCents: discount, platformFeeCents: platformFee, stripeFeeCents: stripeFee, netCents: net, tickets }, s.eventId);
    }

    // Se não existem sale_summaries, tentar fallback com payment_events
    if (summaries.length === 0) {
      const peWhere: Prisma.PaymentEventWhereInput = {};
      if (Number.isFinite(eventId)) peWhere.eventId = Number(eventId);
      if (modeParam === "LIVE" || modeParam === "TEST") peWhere.mode = modeParam as PaymentMode;
      if (fromDate || toDate) {
        peWhere.createdAt = {};
        if (fromDate) peWhere.createdAt.gte = fromDate;
        if (toDate) peWhere.createdAt.lte = toDate;
      }
      const paymentEvents = await prisma.paymentEvent.findMany({
        where: peWhere,
        select: {
          amountCents: true,
          platformFeeCents: true,
          stripeFeeCents: true,
          eventId: true,
        },
      });
      const eventIds = Array.from(
        new Set(paymentEvents.map((p) => p.eventId).filter((id): id is number => Number.isFinite(id))),
      );
      const eventsById = eventIds.length
        ? new Map(
            (
              await prisma.event.findMany({
                where: { id: { in: eventIds } },
                select: { id: true, organizerId: true },
              })
            ).map((ev) => [ev.id, ev.organizerId ?? 0]),
          )
        : new Map<number, number>();

      for (const p of paymentEvents) {
        const gross = p.amountCents ?? 0;
        const discount = 0;
        const platformFee = p.platformFeeCents ?? 0;
        const stripeFee =
          p.stripeFeeCents != null
            ? p.stripeFeeCents
            : estimateStripeFee(p.amountCents ?? 0);
        const net = Math.max(0, gross - platformFee - stripeFee);
        const tickets = 0;

        totals.grossCents += gross;
        totals.discountCents += discount;
        totals.platformFeeCents += platformFee;
        totals.stripeFeeCents += stripeFee;
        totals.netCents += net;
        totals.tickets += tickets;

        const orgId = (p.eventId && eventsById.get(p.eventId)) || 0;
        if (!byOrganizer.has(orgId)) {
          byOrganizer.set(orgId, { ...emptyAgg, organizerId: orgId, events: new Set() });
        }
        const target = byOrganizer.get(orgId)!;
        target.grossCents += gross;
        target.discountCents += discount;
        target.platformFeeCents += platformFee;
        target.stripeFeeCents += stripeFee;
        target.netCents += net;
        target.tickets += tickets;
        if (p.eventId) target.events.add(p.eventId);
      }
    }

    const list = Array.from(byOrganizer.values()).map((entry) => ({
      organizerId: entry.organizerId,
      grossCents: entry.grossCents,
      discountCents: entry.discountCents,
      platformFeeCents: entry.platformFeeCents,
      stripeFeeCents: entry.stripeFeeCents,
      netCents: entry.netCents,
      tickets: entry.tickets,
      events: entry.events.size,
    }));

    return NextResponse.json(
      {
        ok: true,
        totals,
        byOrganizer: list,
        period: { from: fromDate, to: toDate },
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("[admin/payments/overview]", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
