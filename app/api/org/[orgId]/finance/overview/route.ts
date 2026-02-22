import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { ensureMemberModuleAccess } from "@/lib/organizationMemberAccess";
import { ACTIVE_PAIRING_REGISTRATION_WHERE } from "@/domain/padelRegistration";
import { resolvePaymentStatusMap } from "@/domain/finance/resolvePaymentStatus";
import {
  EventTemplateType,
  OrganizationModule,
  Prisma,
  SaleSummaryStatus,
} from "@prisma/client";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

import { getUserWithPolicy } from "@/lib/auth/getUserWithPolicy";
type Aggregate = {
  grossCents: number;
  netCents: number;
  feesCents: number;
  tickets: number;
};

async function _GET(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
      error,
    } = await getUserWithPolicy("required_verified", { supabaseOverride: supabase });

    if (error || !user) {
      return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }

    const url = new URL(req.url);
    const templateTypeParam = url.searchParams.get("templateType");
    const excludeTemplateTypeParam = url.searchParams.get("excludeTemplateType");
    const parseTemplateType = (raw: string | null) => {
      if (!raw) return null;
      const normalized = raw.trim().toUpperCase();
      return (Object.values(EventTemplateType) as string[]).includes(normalized)
        ? (normalized as EventTemplateType)
        : null;
    };
    const templateType = parseTemplateType(templateTypeParam);
    const excludeTemplateType = parseTemplateType(excludeTemplateTypeParam);
    const eventTemplateFilter: Prisma.EventWhereInput = templateType
      ? { templateType }
      : excludeTemplateType
        ? { NOT: { templateType: excludeTemplateType } }
        : {};
    const isPadelScope = templateType === EventTemplateType.PADEL;
    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization, membership } = await getActiveOrganizationForUser(user.id, {
      organizationId: organizationId ?? undefined,
      includeOrganizationFields: "settings",
    });

    if (!organization || !membership) {
      return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });
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
      return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });
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
      return jsonWrap(
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
        cardPlatformFeeCents: true,
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

    const eventStats = new Map<number, Aggregate>();

    const addTo = (target: Aggregate, gross: number, fees: number, net: number, qty: number) => {
      target.grossCents += gross;
      target.feesCents += fees;
      target.netCents += net;
      target.tickets += qty;
    };

    const purchaseIds = Array.from(
      new Set(
        summaries
          .map((summary) => (typeof summary.purchaseId === "string" ? summary.purchaseId.trim() : ""))
          .filter((purchaseId): purchaseId is string => purchaseId.length > 0),
      ),
    );

    const statusMap = await resolvePaymentStatusMap(purchaseIds);
    let fallbackMissingPurchaseId = 0;
    let fallbackMissingStatus = 0;
    let skippedNonPaidStatus = 0;
    for (const summary of summaries) {
      const purchaseId = typeof summary.purchaseId === "string" ? summary.purchaseId.trim() : "";
      if (!purchaseId) {
        fallbackMissingPurchaseId += 1;
        continue;
      }
      const resolved = statusMap.get(purchaseId);
      if (!resolved) {
        fallbackMissingStatus += 1;
        continue;
      }
      if (resolved.status !== "PAID") {
        skippedNonPaidStatus += 1;
      }
    }

    for (const s of summaries) {
      const purchaseId = typeof s.purchaseId === "string" ? s.purchaseId.trim() : "";
      const resolved = purchaseId ? statusMap.get(purchaseId) : null;
      if (resolved && resolved.status !== "PAID") {
        continue;
      }
      const qty = s.lines.reduce((q, l) => q + (l.quantity ?? 0), 0);
      const gross = s.subtotalCents ?? 0;
      const platformFee = s.platformFeeCents ?? 0;
      const cardPlatformFee = s.cardPlatformFeeCents ?? 0;
      const totalCents = s.totalCents ?? gross;
      const stripeFee = s.stripeFeeCents ?? 0;
      const totalFees = platformFee + cardPlatformFee + stripeFee;
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
      };
      addTo(current, gross, totalFees, net, qty);
      eventStats.set(s.eventId, current);
    }

    if (fallbackMissingPurchaseId > 0 || fallbackMissingStatus > 0 || skippedNonPaidStatus > 0) {
      console.warn("[organizacao/finance/overview] payment_status_integrity", {
        organizationId: organization.id,
        fallbackMissingPurchaseId,
        fallbackMissingStatus,
        skippedNonPaidStatus,
        totalSummaries: summaries.length,
      });
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
    const upcomingPayoutCents = 0;
    const payoutAlerts = {
      holdUntil: null,
      nextAttemptAt: null,
      actionRequired: false,
    };

    return jsonWrap(
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
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
export const GET = withApiEnvelope(_GET);
