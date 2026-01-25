import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { isOrgAdminOrAbove } from "@/lib/organizationPermissions";
import { ACTIVE_PAIRING_REGISTRATION_WHERE } from "@/domain/padelRegistration";
import { SaleSummaryStatus, TicketStatus } from "@prisma/client";
import { resolveOrganizationIdFromParams } from "@/lib/organizationId";

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

    const orgParam = resolveOrganizationIdFromParams(req.nextUrl.searchParams);
    const templateTypeParam = req.nextUrl.searchParams.get("templateType");
    const templateType =
      typeof templateTypeParam === "string" && templateTypeParam.trim()
        ? templateTypeParam.trim().toUpperCase()
        : null;
    const excludeTemplateTypeParam = req.nextUrl.searchParams.get("excludeTemplateType");
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
    const cookieOrgId = req.cookies.get("orya_organization")?.value;
    const orgRaw = orgParam ?? (cookieOrgId ? Number(cookieOrgId) : null);
    const organizationId = typeof orgRaw === "number" && Number.isFinite(orgRaw) ? orgRaw : null;
    const { organization, membership } = await getActiveOrganizationForUser(user.id, {
      organizationId: organizationId ?? undefined,
      roles: ["OWNER", "CO_OWNER", "ADMIN"],
      allowFallback: !orgParam,
    });

    if (!organization || !membership || !isOrgAdminOrAbove(membership.role)) {
      return NextResponse.json({ ok: false, error: "NOT_ORGANIZATION" }, { status: 403 });
    }

    const now = new Date();
    const from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

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
        templateType: true,
        locationName: true,
        locationCity: true,
        padelTournamentConfig: {
          select: { advancedSettings: true },
        },
      },
    });
    const eventIds = events.map((e) => e.id);

    const saleSummaries30d = await prisma.saleSummary.findMany({
      where: {
        createdAt: { gte: from, lte: now },
        status: SaleSummaryStatus.PAID,
        event: {
          organizationId: organization.id,
          ...eventTemplateFilter,
        },
      },
      select: {
        eventId: true,
        netCents: true,
        lines: {
          select: { quantity: true, netCents: true },
        },
      },
    });

    let lineTickets30d = 0;
    let totalRevenueCents = 0;
    const eventLineStats30d = new Map<number, { netCents: number; tickets: number }>();

    for (const summary of saleSummaries30d) {
      totalRevenueCents += summary.netCents ?? 0;
      for (const line of summary.lines) {
        const qty = line.quantity ?? 0;
        const net = line.netCents ?? 0;
        lineTickets30d += qty;
        const current = eventLineStats30d.get(summary.eventId) ?? { netCents: 0, tickets: 0 };
        current.netCents += net;
        current.tickets += qty;
        eventLineStats30d.set(summary.eventId, current);
      }
    }

    const tickets30d = await prisma.ticket.findMany({
      where: {
        status: { in: [TicketStatus.ACTIVE, TicketStatus.USED] },
        purchasedAt: { gte: from, lte: now },
        eventId: { in: eventIds },
      },
      select: {
        guestLink: { select: { guestEmail: true } },
      },
    });

    let totalTickets = lineTickets30d;
    const guestTickets = tickets30d.filter((t) => t.guestLink?.guestEmail).length;
    if (isPadelScope) {
      const padel30d = await prisma.padelPairing.count({
        where: {
          createdAt: { gte: from, lte: now },
          pairingStatus: { not: "CANCELLED" },
          ...ACTIVE_PAIRING_REGISTRATION_WHERE,
          event: {
            organizationId: organization.id,
            ...eventTemplateFilter,
          },
        },
      });
      totalTickets = padel30d;
    }

    const promoRepo = (prisma as unknown as {
      promoCode?: {
        findMany: typeof prisma.promoCode.findMany;
      };
    }).promoCode;

    let ticketsWithPromo = 0;
    let marketingRevenueCents = 0;
    let topPromo: { id: number; code: string; redemptionsCount: number; revenueCents: number } | undefined;

    if (promoRepo) {
      const promoCodes = await promoRepo.findMany({
        where: {
          OR: [{ organizationId: organization.id }, { eventId: { in: eventIds } }],
        },
        include: {
          redemptions: {
            where: { usedAt: { gte: from, lte: now } },
          },
        },
      });

      const purchaseIds = Array.from(
        new Set(
          promoCodes
            .flatMap((promo) => promo.redemptions.map((redemption) => redemption.purchaseId))
            .filter((id): id is string => typeof id === "string" && id.trim().length > 0),
        ),
      );
      const paidPurchaseIds = new Set<string>();
      if (purchaseIds.length) {
        const paidSummaries = await prisma.saleSummary.findMany({
          where: {
            purchaseId: { in: purchaseIds },
            status: SaleSummaryStatus.PAID,
            eventId: { in: eventIds },
          },
          select: { purchaseId: true },
        });
        paidSummaries.forEach((summary) => {
          if (summary.purchaseId) paidPurchaseIds.add(summary.purchaseId);
        });
      }

      const avgPricePerEvent = new Map<number, number>();
      eventLineStats30d.forEach((val, key) => {
        avgPricePerEvent.set(key, val.tickets ? val.netCents / val.tickets : 0);
      });
      const globalAvg = lineTickets30d ? totalRevenueCents / lineTickets30d : 0;

      for (const promo of promoCodes) {
        const redemptions = purchaseIds.length
          ? promo.redemptions.filter((redemption) => redemption.purchaseId && paidPurchaseIds.has(redemption.purchaseId))
          : promo.redemptions;
        const redemptionsCount = redemptions.length;
        ticketsWithPromo += redemptionsCount;
        const estimatedPrice =
          promo.eventId && avgPricePerEvent.has(promo.eventId)
            ? avgPricePerEvent.get(promo.eventId) ?? 0
            : globalAvg;
        const estimatedRevenue = Math.round(redemptionsCount * estimatedPrice);
        marketingRevenueCents += estimatedRevenue;
        if (!topPromo || redemptionsCount > topPromo.redemptionsCount) {
          topPromo = {
            id: promo.id,
            code: promo.code,
            redemptionsCount,
            revenueCents: estimatedRevenue,
          };
        }
      }
    }

    const capacityAgg = await prisma.ticketType.groupBy({
      by: ["eventId"],
      where: { eventId: { in: eventIds } },
      _sum: { totalQuantity: true },
    });
    const capacityMap = new Map<number, number>();
    capacityAgg.forEach((row) => {
      capacityMap.set(row.eventId, row._sum.totalQuantity ?? 0);
    });
    const padelPairingStats =
      eventIds.length > 0
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
    const padelEventIds = events.filter((event) => event.templateType === "PADEL").map((event) => event.id);
    const padelCategoryLinks =
      padelEventIds.length > 0
        ? await prisma.padelEventCategoryLink.findMany({
            where: { eventId: { in: padelEventIds }, isEnabled: true },
            select: { eventId: true, capacityTeams: true, capacityPlayers: true },
          })
        : [];
    const padelCapacityBuckets = new Map<number, Array<number | null>>();
    padelCategoryLinks.forEach((link) => {
      const capacity = link.capacityTeams ?? link.capacityPlayers ?? null;
      const current = padelCapacityBuckets.get(link.eventId) ?? [];
      current.push(capacity);
      padelCapacityBuckets.set(link.eventId, current);
    });
    const padelCapacityMap = new Map<number, number | null>();
    events.forEach((event) => {
      if (event.templateType !== "PADEL") return;
      const advancedSettings = (event.padelTournamentConfig?.advancedSettings ?? {}) as {
        maxEntriesTotal?: number | null;
      };
      const maxEntriesTotal =
        typeof advancedSettings.maxEntriesTotal === "number" && Number.isFinite(advancedSettings.maxEntriesTotal)
          ? Math.floor(advancedSettings.maxEntriesTotal)
          : null;
      if (maxEntriesTotal && maxEntriesTotal > 0) {
        padelCapacityMap.set(event.id, maxEntriesTotal);
        return;
      }
      const capacities = padelCapacityBuckets.get(event.id) ?? [];
      if (capacities.length === 0 || capacities.some((cap) => cap === null)) {
        padelCapacityMap.set(event.id, null);
        return;
      }
      const total = capacities.reduce((sum, cap) => sum + (cap ?? 0), 0);
      padelCapacityMap.set(event.id, total);
    });

    const saleLineStatsAll = await prisma.saleLine.groupBy({
      by: ["eventId"],
      where: {
        eventId: { in: eventIds },
        saleSummary: { status: SaleSummaryStatus.PAID },
      },
      _sum: { quantity: true, netCents: true },
    });
    const statsMap = new Map<number, { tickets: number; revenueCents: number }>();
    saleLineStatsAll.forEach((s) => {
      statsMap.set(s.eventId, {
        tickets: s._sum.quantity ?? 0,
        revenueCents: s._sum.netCents ?? 0,
      });
    });

    return NextResponse.json(
      {
        ok: true,
        totalTickets,
        ticketsWithPromo,
        guestTickets,
        totalRevenueCents,
        marketingRevenueCents,
        topPromo: topPromo ?? null,
        events: events.map((ev) => ({
          ...ev,
          capacity:
            ev.templateType === "PADEL"
              ? padelCapacityMap.get(ev.id) ?? null
              : capacityMap.get(ev.id) ?? null,
          ticketsSold:
            ev.templateType === "PADEL"
              ? padelPairingMap.get(ev.id) ?? 0
              : statsMap.get(ev.id)?.tickets ?? 0,
          revenueCents: statsMap.get(ev.id)?.revenueCents ?? 0,
        })),
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[organização/marketing/overview]", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
