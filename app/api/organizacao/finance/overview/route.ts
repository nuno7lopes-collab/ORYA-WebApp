import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { ensureMemberModuleAccess } from "@/lib/organizationMemberAccess";
import { getStripeBaseFees } from "@/lib/platformSettings";
import { ACTIVE_PAIRING_REGISTRATION_WHERE } from "@/domain/padelRegistration";
import { resolvePaymentStatusMap } from "@/domain/finance/resolvePaymentStatus";
import { OrganizationModule, PendingPayoutStatus, SaleSummaryStatus } from "@prisma/client";

type Aggregate = {
  grossCents: number;
  netCents: number;
  feesCents: number;
  tickets: number;
};

export async function GET(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }

    const url = new URL(req.url);
    const templateTypeParam = url.searchParams.get("templateType");
    const templateType =
      typeof templateTypeParam === "string" && templateTypeParam.trim()
        ? templateTypeParam.trim().toUpperCase()
        : null;
    const excludeTemplateTypeParam = url.searchParams.get("excludeTemplateType");
    const excludeTemplateType =
      typeof excludeTemplateTypeParam === "string" && excludeTemplateTypeParam.trim()
        ? excludeTemplateTypeParam.trim().toUpperCase()
        : null;
    const eventTemplateFilter = templateType
      ? { templateType }
      : excludeTemplateType
        ? { NOT: { templateType: excludeTemplateType } }
        : {};
    const isPadelScope = templateType === "PADEL";
    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization, membership } = await getActiveOrganizationForUser(user.id, {
      organizationId: organizationId ?? undefined,
    });

    if (!organization || !membership) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const access = await ensureMemberModuleAccess({
      organizationId: organization.id,
      userId: user.id,
      role: membership.role,
      rolePack: membership.rolePack,
      moduleKey: OrganizationModule.FINANCEIRO,
      required: "VIEW",
    });
    if (!access.ok) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const events = await prisma.event.findMany({
      where: {
        organizationId: organization.id,
        ...eventTemplateFilter,
      },
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
          payoutAlerts: { holdUntil: null, nextAttemptAt: null, actionRequired: false },
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
        status: SaleSummaryStatus.PAID,
      },
      select: {
        id: true,
        eventId: true,
        purchaseId: true,
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

    const purchaseIds = summaries.map((s) => s.purchaseId).filter((p): p is string => Boolean(p));
    if (summaries.length && purchaseIds.length !== summaries.length) {
      return NextResponse.json(
        {
          ok: false,
          error: "FINANCE_STATUS_INCOMPLETE",
          totals: { grossCents: 0, netCents: 0, feesCents: 0, tickets: 0, eventsWithSales: 0 },
          rolling: { last7: agg7, last30: agg30 },
          upcomingPayoutCents: 0,
          payoutAlerts: { holdUntil: null, nextAttemptAt: null, actionRequired: false },
          events: [],
        },
        { status: 503 }
      );
    }

    const statusMap = await resolvePaymentStatusMap(purchaseIds);
    for (const summary of summaries) {
      const resolved = summary.purchaseId ? statusMap.get(summary.purchaseId) : null;
      if (!resolved || resolved.status !== "PAID") {
        return NextResponse.json(
          {
            ok: false,
            error: "FINANCE_STATUS_INCOMPLETE",
            totals: { grossCents: 0, netCents: 0, feesCents: 0, tickets: 0, eventsWithSales: 0 },
            rolling: { last7: agg7, last30: agg30 },
            upcomingPayoutCents: 0,
            payoutAlerts: { holdUntil: null, nextAttemptAt: null, actionRequired: false },
            events: [],
          },
          { status: 503 }
        );
      }
    }

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
      addTo(current, gross, totalFees, net, qty);
      eventStats.set(s.eventId, current);
    }

    const padelPairingStats = isPadelScope
      ? await prisma.padelPairing.groupBy({
          by: ["eventId"],
          where: {
            eventId: { in: eventIds },
            pairingStatus: { not: "CANCELLED" },
            ...ACTIVE_PAIRING_REGISTRATION_WHERE,
          },
          _count: { _all: true },
        })
      : [];
    const padelPairingMap = new Map<number, number>();
    padelPairingStats.forEach((row) => {
      padelPairingMap.set(row.eventId, row._count._all);
    });
    if (isPadelScope) {
      const padelLast7 = await prisma.padelPairing.count({
        where: {
          eventId: { in: eventIds },
          createdAt: { gte: last7 },
          pairingStatus: { not: "CANCELLED" },
          ...ACTIVE_PAIRING_REGISTRATION_WHERE,
        },
      });
      const padelLast30 = await prisma.padelPairing.count({
        where: {
          eventId: { in: eventIds },
          createdAt: { gte: last30 },
          pairingStatus: { not: "CANCELLED" },
          ...ACTIVE_PAIRING_REGISTRATION_WHERE,
        },
      });
      totals.tickets = padelPairingMap.size
        ? Array.from(padelPairingMap.values()).reduce((sum, count) => sum + count, 0)
        : 0;
      agg7.tickets = padelLast7;
      agg30.tickets = padelLast30;
    }

    const eventsWithSales = Array.from(eventStats.keys()).length;
    const recipientConnectAccountId =
      organization.orgType === "PLATFORM" ? null : organization.stripeAccountId ?? null;
    const [pendingAgg, holdMin, nextAttemptMin, actionRequired] = recipientConnectAccountId
      ? await Promise.all([
          prisma.pendingPayout.aggregate({
            where: {
              recipientConnectAccountId,
              status: { in: [PendingPayoutStatus.HELD, PendingPayoutStatus.RELEASING] },
            },
            _sum: { amountCents: true },
          }),
          prisma.pendingPayout.aggregate({
            where: {
              recipientConnectAccountId,
              status: PendingPayoutStatus.HELD,
              holdUntil: { gt: now },
            },
            _min: { holdUntil: true },
          }),
          prisma.pendingPayout.aggregate({
            where: {
              recipientConnectAccountId,
              status: PendingPayoutStatus.HELD,
              nextAttemptAt: { not: null, gte: now },
            },
            _min: { nextAttemptAt: true },
          }),
          prisma.pendingPayout.findFirst({
            where: {
              recipientConnectAccountId,
              status: PendingPayoutStatus.HELD,
              blockedReason: { startsWith: "ACTION_REQUIRED" },
            },
            select: { id: true },
          }),
        ])
      : [null, null, null, null];
    const upcomingPayoutCents = pendingAgg?._sum?.amountCents ?? 0;
    const payoutAlerts = {
      holdUntil: holdMin?._min?.holdUntil ?? null,
      nextAttemptAt: nextAttemptMin?._min?.nextAttemptAt ?? null,
      actionRequired: Boolean(actionRequired),
    };

    return NextResponse.json(
      {
        ok: true,
        totals: { ...totals, eventsWithSales },
        rolling: { last7: agg7, last30: agg30 },
        upcomingPayoutCents,
        payoutAlerts,
        events: events.map((ev) => {
          const stats = eventStats.get(ev.id) ?? {
            grossCents: 0,
            netCents: 0,
            feesCents: 0,
            tickets: 0,
          };
          const ticketsSold = isPadelScope ? padelPairingMap.get(ev.id) ?? 0 : stats.tickets;
          return {
            ...ev,
            grossCents: stats.grossCents,
            netCents: stats.netCents,
            feesCents: stats.feesCents,
            ticketsSold,
          };
        }),
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[organização/finance/overview]", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
