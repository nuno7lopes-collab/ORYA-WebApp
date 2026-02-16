import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { ensureMemberModuleAccess } from "@/lib/organizationMemberAccess";
import { EventTemplateType, OrganizationModule, SaleSummaryStatus } from "@prisma/client";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { Prisma } from "@prisma/client";

type CohortRetentionRow = {
  monthOffset: number;
  retainedBuyers: number;
  retentionRateBps: number;
  revenueCents: number;
};

type CohortRow = {
  cohortMonth: string;
  buyers: number;
  retention: CohortRetentionRow[];
};

type BuyerMonthlyRollup = {
  cohortMonth: string;
  purchasesByMonth: Map<string, number>;
};

let cachedIncludedStatuses: SaleSummaryStatus[] | null = null;

async function resolveIncludedStatuses() {
  if (cachedIncludedStatuses) return cachedIncludedStatuses;
  try {
    const rows = await prisma.$queryRaw<Array<{ label: string }>>(Prisma.sql`
      SELECT e.enumlabel::text AS label
      FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'app_v3'
        AND t.typname = 'SaleSummaryStatus'
    `);
    const labels = new Set(rows.map((row) => row.label));
    const resolved: SaleSummaryStatus[] = [SaleSummaryStatus.PAID, SaleSummaryStatus.REFUNDED];
    if (labels.has("PARTIAL_REFUND")) {
      resolved.push(SaleSummaryStatus.PARTIAL_REFUND);
    }
    cachedIncludedStatuses = resolved;
    return resolved;
  } catch {
    const fallback: SaleSummaryStatus[] = [SaleSummaryStatus.PAID, SaleSummaryStatus.REFUNDED];
    cachedIncludedStatuses = fallback;
    return fallback;
  }
}

function parseTemplateType(raw: string | null) {
  if (!raw) return null;
  const normalized = raw.trim().toUpperCase();
  return (Object.values(EventTemplateType) as string[]).includes(normalized)
    ? (normalized as EventTemplateType)
    : null;
}

function parseMonths(raw: string | null) {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) return 12;
  if (parsed < 1) return 1;
  if (parsed > 24) return 24;
  return parsed;
}

function formatMonthKey(input: Date) {
  const year = input.getUTCFullYear();
  const month = String(input.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function startOfMonthUtc(input: Date) {
  return new Date(Date.UTC(input.getUTCFullYear(), input.getUTCMonth(), 1));
}

function addMonthsUtc(input: Date, months: number) {
  return new Date(Date.UTC(input.getUTCFullYear(), input.getUTCMonth() + months, 1));
}

function monthDiff(fromMonthKey: string, toMonthKey: string) {
  const [fromYear, fromMonth] = fromMonthKey.split("-").map(Number);
  const [toYear, toMonth] = toMonthKey.split("-").map(Number);
  return (toYear - fromYear) * 12 + (toMonth - fromMonth);
}

function computeRevenueCents(sale: {
  netCents: number | null;
  totalCents: number | null;
  platformFeeCents: number | null;
  stripeFeeCents: number | null;
}) {
  if (typeof sale.netCents === "number") {
    return Math.max(0, sale.netCents);
  }
  const total = sale.totalCents ?? 0;
  const fees = (sale.platformFeeCents ?? 0) + (sale.stripeFeeCents ?? 0);
  return Math.max(0, total - fees);
}

async function _GET(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }

    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization, membership } = await getActiveOrganizationForUser(user.id, {
      organizationId: organizationId ?? undefined,
    });

    if (!organization || !membership) {
      return jsonWrap({ ok: false, error: "NOT_ORGANIZATION" }, { status: 403 });
    }

    const access = await ensureMemberModuleAccess({
      organizationId: organization.id,
      userId: user.id,
      role: membership.role,
      rolePack: membership.rolePack,
      moduleKey: OrganizationModule.ANALYTICS,
      required: "VIEW",
    });
    if (!access.ok) {
      return jsonWrap({ ok: false, error: "NOT_ORGANIZATION" }, { status: 403 });
    }

    const url = new URL(req.url);
    const months = parseMonths(url.searchParams.get("months"));
    const templateType = parseTemplateType(url.searchParams.get("templateType"));
    const excludeTemplateType = parseTemplateType(url.searchParams.get("excludeTemplateType"));

    const eventTemplateFilter: Prisma.EventWhereInput = templateType
      ? { templateType }
      : excludeTemplateType
        ? { OR: [{ templateType: null }, { templateType: { not: excludeTemplateType } }] }
        : {};

    const includedStatuses = await resolveIncludedStatuses();
    const sales = await prisma.saleSummary.findMany({
      where: {
        event: {
          organizationId: organization.id,
          ...eventTemplateFilter,
        },
        status: { in: includedStatuses },
        OR: [{ ownerIdentityId: { not: null } }, { ownerUserId: { not: null } }, { userId: { not: null } }],
      },
      select: {
        createdAt: true,
        ownerIdentityId: true,
        ownerUserId: true,
        userId: true,
        netCents: true,
        totalCents: true,
        platformFeeCents: true,
        stripeFeeCents: true,
      },
      orderBy: { createdAt: "asc" },
    });

    if (!sales.length) {
      return jsonWrap({ ok: true, months, cohorts: [] }, { status: 200 });
    }

    const now = new Date();
    const windowEnd = startOfMonthUtc(now);
    const windowStart = addMonthsUtc(windowEnd, -(months - 1));
    const windowStartKey = formatMonthKey(windowStart);
    const windowEndKey = formatMonthKey(windowEnd);

    const buyerRollups = new Map<string, BuyerMonthlyRollup>();

    for (const sale of sales) {
      const buyerKey = sale.ownerIdentityId ?? sale.ownerUserId ?? sale.userId;
      if (!buyerKey) continue;
      const purchaseMonth = formatMonthKey(startOfMonthUtc(sale.createdAt));
      const revenueCents = computeRevenueCents(sale);

      const current = buyerRollups.get(buyerKey);
      if (!current) {
        buyerRollups.set(buyerKey, {
          cohortMonth: purchaseMonth,
          purchasesByMonth: new Map([[purchaseMonth, revenueCents]]),
        });
        continue;
      }

      if (purchaseMonth < current.cohortMonth) {
        current.cohortMonth = purchaseMonth;
      }
      current.purchasesByMonth.set(
        purchaseMonth,
        (current.purchasesByMonth.get(purchaseMonth) ?? 0) + revenueCents,
      );
    }

    const cohortsMap = new Map<string, { buyers: number; retention: Map<number, { buyers: Set<string>; revenueCents: number }> }>();

    for (const [buyerKey, rollup] of buyerRollups.entries()) {
      if (rollup.cohortMonth < windowStartKey || rollup.cohortMonth > windowEndKey) continue;

      const cohort = cohortsMap.get(rollup.cohortMonth) ?? {
        buyers: 0,
        retention: new Map<number, { buyers: Set<string>; revenueCents: number }>(),
      };
      cohort.buyers += 1;

      for (const [purchaseMonth, monthRevenue] of rollup.purchasesByMonth.entries()) {
        if (purchaseMonth < rollup.cohortMonth || purchaseMonth > windowEndKey) continue;
        const offset = monthDiff(rollup.cohortMonth, purchaseMonth);
        if (offset < 0 || offset >= months) continue;
        const bucket = cohort.retention.get(offset) ?? { buyers: new Set<string>(), revenueCents: 0 };
        bucket.buyers.add(buyerKey);
        bucket.revenueCents += monthRevenue;
        cohort.retention.set(offset, bucket);
      }

      cohortsMap.set(rollup.cohortMonth, cohort);
    }

    const cohorts: CohortRow[] = Array.from(cohortsMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([cohortMonth, cohort]) => {
        const retention: CohortRetentionRow[] = [];
        for (let offset = 0; offset < months; offset += 1) {
          const bucket = cohort.retention.get(offset);
          const retainedBuyers = bucket?.buyers.size ?? 0;
          const retentionRateBps = cohort.buyers > 0 ? Math.round((retainedBuyers / cohort.buyers) * 10000) : 0;
          retention.push({
            monthOffset: offset,
            retainedBuyers,
            retentionRateBps,
            revenueCents: bucket?.revenueCents ?? 0,
          });
        }

        return {
          cohortMonth,
          buyers: cohort.buyers,
          retention,
        };
      });

    return jsonWrap({ ok: true, months, cohorts }, { status: 200 });
  } catch (err) {
    console.error("[analytics/cohorts] erro inesperado", err);
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

export const GET = withApiEnvelope(_GET);
