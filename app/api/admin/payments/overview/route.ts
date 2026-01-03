// app/api/admin/payments/overview/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getStripeBaseFees } from "@/lib/platformSettings";
import type { Prisma, PaymentMode } from "@prisma/client";
import { resolveOrganizationIdFromParams } from "@/lib/organizationId";

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
    const organizationId = resolveOrganizationIdFromParams(url.searchParams);
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
          { ok: true, totals: emptyAgg, byOrganization: [], period: { from: fromDate, to: toDate } },
          { status: 200 },
        );
      }
    }

    const where: Prisma.SaleSummaryWhereInput = {};
    if (typeof organizationId === "number") {
      where.event = { organizationId };
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
        event: { select: { organizationId: true, title: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 1000, // segurança para não explodir o painel
    });

    const totals: Aggregate = { ...emptyAgg };
    const byOrganization = new Map<
      number,
      Aggregate & { organizationId: number; events: Set<number> }
    >();

    const add = (orgId: number, agg: Aggregate, eventIdValue: number) => {
      if (!byOrganization.has(orgId)) {
        byOrganization.set(orgId, { ...emptyAgg, organizationId: orgId, events: new Set() });
      }
      const target = byOrganization.get(orgId)!;
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

      const organizationKey = s.event?.organizationId ?? 0;
      add(organizationKey, { grossCents: gross, discountCents: discount, platformFeeCents: platformFee, stripeFeeCents: stripeFee, netCents: net, tickets }, s.eventId);
    }

    const list = Array.from(byOrganization.values()).map((entry) => ({
      organizationId: entry.organizationId,
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
        byOrganization: list,
        period: { from: fromDate, to: toDate },
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("[admin/payments/overview]", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
