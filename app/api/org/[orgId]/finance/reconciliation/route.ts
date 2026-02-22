import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { ensureMemberModuleAccess } from "@/lib/organizationMemberAccess";
import { EventTemplateType, OrganizationModule, Prisma, SaleSummaryStatus } from "@prisma/client";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { resolvePaymentStatusMap } from "@/domain/finance/resolvePaymentStatus";

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
        ? { OR: [{ templateType: null }, { templateType: { not: excludeTemplateType } }] }
        : {};

    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization, membership } = await getActiveOrganizationForUser(user.id, {
      organizationId: organizationId ?? undefined,
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
      select: { id: true, title: true, startsAt: true, status: true, payoutMode: true },
      orderBy: { startsAt: "asc" },
    });
    const eventIds = events.map((event) => event.id);

    if (!eventIds.length) {
      return jsonWrap(
        {
          ok: true,
          summary: {
            grossCents: 0,
            feesCents: 0,
            netCents: 0,
            refundsCents: 0,
            netAfterRefundsCents: 0,
            holdCents: 0,
          },
          events: [],
        },
        { status: 200 },
      );
    }

    const summaries = await prisma.saleSummary.findMany({
      where: {
        eventId: { in: eventIds },
        status: SaleSummaryStatus.PAID,
      },
      select: {
        eventId: true,
        purchaseId: true,
        subtotalCents: true,
        totalCents: true,
        platformFeeCents: true,
        cardPlatformFeeCents: true,
        stripeFeeCents: true,
        netCents: true,
        lines: { select: { quantity: true } },
      },
    });

    const totals: Aggregate = { grossCents: 0, netCents: 0, feesCents: 0, tickets: 0 };
    const eventStats = new Map<number, Aggregate>();
    const purchaseIds = Array.from(
      new Set(
        summaries
          .map((summary) => (typeof summary.purchaseId === "string" ? summary.purchaseId.trim() : ""))
          .filter((purchaseId): purchaseId is string => purchaseId.length > 0),
      ),
    );
    const statusMap = await resolvePaymentStatusMap(purchaseIds);

    const addTo = (target: Aggregate, gross: number, fees: number, net: number, qty: number) => {
      target.grossCents += gross;
      target.feesCents += fees;
      target.netCents += net;
      target.tickets += qty;
    };

    for (const summary of summaries) {
      const purchaseId = typeof summary.purchaseId === "string" ? summary.purchaseId.trim() : "";
      const resolved = purchaseId ? statusMap.get(purchaseId) : null;
      if (resolved && resolved.status !== "PAID") {
        continue;
      }
      const qty = summary.lines.reduce((sum, line) => sum + (line.quantity ?? 0), 0);
      const gross = summary.subtotalCents ?? 0;
      const fees =
        (summary.platformFeeCents ?? 0) +
        (summary.cardPlatformFeeCents ?? 0) +
        (summary.stripeFeeCents ?? 0);
      const net =
        summary.netCents != null && summary.netCents >= 0
          ? summary.netCents
          : Math.max(0, (summary.totalCents ?? gross) - fees);

      addTo(totals, gross, fees, net, qty);
      const current = eventStats.get(summary.eventId) ?? {
        grossCents: 0,
        netCents: 0,
        feesCents: 0,
        tickets: 0,
      };
      addTo(current, gross, fees, net, qty);
      eventStats.set(summary.eventId, current);
    }

    const refundsAgg = await prisma.refund.groupBy({
      by: ["eventId"],
      where: { eventId: { in: eventIds } },
      _sum: { baseAmountCents: true },
    });
    const refundsMap = new Map<number, number>();
    refundsAgg.forEach((row) => {
      refundsMap.set(row.eventId, row._sum.baseAmountCents ?? 0);
    });

    const eventRows = events.map((event) => {
      const stat = eventStats.get(event.id) ?? { grossCents: 0, netCents: 0, feesCents: 0, tickets: 0 };
      const refundsCents = refundsMap.get(event.id) ?? 0;
      const netAfterRefundsCents = Math.max(0, stat.netCents - refundsCents);
      return {
        id: event.id,
        title: event.title,
        startsAt: event.startsAt,
        status: event.status,
        payoutMode: event.payoutMode,
        grossCents: stat.grossCents,
        feesCents: stat.feesCents,
        netCents: stat.netCents,
        refundsCents,
        netAfterRefundsCents,
        holdCents: 0,
        holdReason: null,
        releaseAt: null,
      };
    });

    const summary = eventRows.reduce(
      (acc, row) => {
        acc.grossCents += row.grossCents;
        acc.feesCents += row.feesCents;
        acc.netCents += row.netCents;
        acc.refundsCents += row.refundsCents;
        acc.netAfterRefundsCents += row.netAfterRefundsCents;
        return acc;
      },
      {
        grossCents: 0,
        feesCents: 0,
        netCents: 0,
        refundsCents: 0,
        netAfterRefundsCents: 0,
        holdCents: 0,
      },
    );

    return jsonWrap({ ok: true, summary, events: eventRows }, { status: 200 });
  } catch (err) {
    console.error("[organizacao/finance/reconciliation]", err);
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
export const GET = withApiEnvelope(_GET);
