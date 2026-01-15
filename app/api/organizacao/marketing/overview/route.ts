import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { isOrgAdminOrAbove } from "@/lib/organizationPermissions";
import { TicketStatus } from "@prisma/client";
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
      },
    });
    const eventIds = events.map((e) => e.id);

    const tickets30d = await prisma.ticket.findMany({
      where: {
        status: { in: [TicketStatus.ACTIVE, TicketStatus.USED] },
        purchasedAt: { gte: from, lte: now },
        eventId: { in: eventIds },
      },
      select: {
        pricePaid: true,
        totalPaidCents: true,
        eventId: true,
        purchasedAt: true,
        guestLink: { select: { guestEmail: true } },
      },
    });

    const totalTickets = tickets30d.length;
    const totalRevenueCents = tickets30d.reduce((sum, t) => sum + (t.pricePaid ?? 0), 0);
    const guestTickets = tickets30d.filter((t) => t.guestLink?.guestEmail).length;

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

      const avgPricePerEvent = new Map<number, number>();
      const ticketSumByEvent = new Map<number, { sum: number; count: number }>();
      for (const t of tickets30d) {
        const prev = ticketSumByEvent.get(t.eventId) ?? { sum: 0, count: 0 };
        ticketSumByEvent.set(t.eventId, { sum: prev.sum + (t.pricePaid ?? 0), count: prev.count + 1 });
      }
      ticketSumByEvent.forEach((val, key) => {
        avgPricePerEvent.set(key, val.count ? val.sum / val.count : 0);
      });
      const globalAvg = totalTickets ? totalRevenueCents / totalTickets : 0;

      for (const promo of promoCodes) {
        const redemptionsCount = promo.redemptions.length;
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

    const ticketStatsAll = await prisma.ticket.groupBy({
      by: ["eventId"],
      where: {
        status: { in: [TicketStatus.ACTIVE, TicketStatus.USED] },
        eventId: { in: eventIds },
      },
      _count: { _all: true },
      _sum: { pricePaid: true },
    });
    const statsMap = new Map<number, { tickets: number; revenueCents: number }>();
    ticketStatsAll.forEach((s) => {
      statsMap.set(s.eventId, {
        tickets: s._count._all,
        revenueCents: s._sum.pricePaid ?? 0,
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
          capacity: capacityMap.get(ev.id) ?? null,
          ticketsSold: statsMap.get(ev.id)?.tickets ?? 0,
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
