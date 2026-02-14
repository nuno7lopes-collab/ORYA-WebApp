// app/api/org/[orgId]/analytics/overview/route.ts
// Analytics de organizacao (overview) — V9 (rollups + entitlements).

import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { EventTemplateType, OrganizationModule, AnalyticsDimensionKey, AnalyticsMetricKey, EntitlementType } from "@prisma/client";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { ensureMemberModuleAccess } from "@/lib/organizationMemberAccess";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { Prisma } from "@prisma/client";
import { PUBLIC_EVENT_DISCOVER_STATUSES } from "@/domain/events/publicStatus";

const LISBON_TZ = "Europe/Lisbon";

function toUtcDate(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function parseRange(range: string | null) {
  const now = new Date();
  if (!range || range === "30d") {
    return { from: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), to: now };
  }
  if (range === "7d") {
    return { from: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), to: now };
  }
  if (range === "all") {
    return { from: null as Date | null, to: null as Date | null };
  }
  return { from: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), to: now };
}

function pickCurrency(values: Array<string | null>, preferred?: string | null) {
  const normalized = values.filter((v): v is string => Boolean(v));
  if (preferred && normalized.includes(preferred)) return preferred;
  if (normalized.includes("EUR")) return "EUR";
  return normalized[0] ?? null;
}

async function getEntitlementStats(params: {
  organizationId: number;
  entitlementType: EntitlementType;
  includeTemplateType?: EventTemplateType | null;
  excludeTemplateType?: EventTemplateType | null;
  fromDate: Date | null;
  toDate: Date | null;
}) {
  const { organizationId, entitlementType, includeTemplateType, excludeTemplateType, fromDate, toDate } = params;
  const dateFilter =
    fromDate || toDate
      ? Prisma.sql`AND ent.created_at BETWEEN ${fromDate ?? new Date(0)} AND ${toDate ?? new Date()}`
      : Prisma.empty;

  const templateFilterSql = includeTemplateType
    ? Prisma.sql`AND ev.template_type = ${includeTemplateType}`
    : excludeTemplateType
      ? Prisma.sql`AND ev.template_type != ${excludeTemplateType}`
      : Prisma.empty;

  const [totalRow] = await prisma.$queryRaw<{ total: bigint }[]>(Prisma.sql`
    SELECT COUNT(*)::bigint AS total
    FROM app_v3.entitlements ent
    JOIN app_v3.events ev ON ev.id = ent.event_id
    WHERE ev.organization_id = ${organizationId}
      AND ent.type = ${entitlementType}
      ${templateFilterSql}
      ${dateFilter}
  `);

  const [eventsRow] = await prisma.$queryRaw<{ total: bigint }[]>(Prisma.sql`
    SELECT COUNT(DISTINCT ent.event_id)::bigint AS total
    FROM app_v3.entitlements ent
    JOIN app_v3.events ev ON ev.id = ent.event_id
    WHERE ev.organization_id = ${organizationId}
      AND ent.type = ${entitlementType}
      ${templateFilterSql}
      ${dateFilter}
  `);

  return {
    totalTickets: Number(totalRow?.total ?? 0),
    eventsWithSalesCount: Number(eventsRow?.total ?? 0),
  };
}

async function _GET(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      console.error("[organização/overview] Erro ao obter user:", authError);
    }

    if (!user) {
      return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }

    const url = new URL(req.url);
    const range = url.searchParams.get("range") || "30d"; // 7d | 30d | all
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
    const parsedTemplateType =
      templateType && Object.values(EventTemplateType).includes(templateType as EventTemplateType)
        ? (templateType as EventTemplateType)
        : null;
    const parsedExcludeTemplateType =
      excludeTemplateType && Object.values(EventTemplateType).includes(excludeTemplateType as EventTemplateType)
        ? (excludeTemplateType as EventTemplateType)
        : null;
    const eventTemplateFilter: Prisma.EventWhereInput = parsedTemplateType
      ? { templateType: parsedTemplateType }
      : parsedExcludeTemplateType
        ? { NOT: { templateType: parsedExcludeTemplateType } }
        : {};
    const isPadelScope = parsedTemplateType === EventTemplateType.PADEL;

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

    const { from, to } = parseRange(range);
    const fromDate = from ? toUtcDate(from) : null;
    const toDate = to ? toUtcDate(to) : null;

    const moduleValue = isPadelScope ? "TORNEIOS" : "EVENTOS";
    const rollupRows = await prisma.analyticsRollup.findMany({
      where: {
        organizationId: organization.id,
        dimensionKey: AnalyticsDimensionKey.MODULE,
        dimensionValue: moduleValue,
        ...(fromDate || toDate
          ? {
              bucketDate: {
                ...(fromDate ? { gte: fromDate } : {}),
                ...(toDate ? { lte: toDate } : {}),
              },
            }
          : {}),
      },
      select: { metricKey: true, value: true },
    });

    const metrics = rollupRows.reduce(
      (acc, row) => {
        acc[row.metricKey] = (acc[row.metricKey] ?? 0) + row.value;
        return acc;
      },
      {} as Record<string, number>,
    );

    const currencyRows = await prisma.analyticsRollup.findMany({
      where: {
        organizationId: organization.id,
        dimensionKey: AnalyticsDimensionKey.CURRENCY,
        ...(fromDate || toDate
          ? {
              bucketDate: {
                ...(fromDate ? { gte: fromDate } : {}),
                ...(toDate ? { lte: toDate } : {}),
              },
            }
          : {}),
      },
      select: { dimensionValue: true },
      distinct: ["dimensionValue"],
    });
    const currency = pickCurrency(currencyRows.map((row) => row.dimensionValue));

    const entitlementType = isPadelScope ? EntitlementType.PADEL_ENTRY : EntitlementType.EVENT_TICKET;
    const entitlementStats = await getEntitlementStats({
      organizationId: organization.id,
      entitlementType,
      includeTemplateType: parsedTemplateType,
      excludeTemplateType: parsedExcludeTemplateType,
      fromDate,
      toDate,
    });

    const activeEventsCount = await prisma.event.count({
      where: {
        organizationId: organization.id,
        status: { in: PUBLIC_EVENT_DISCOVER_STATUSES },
        ...eventTemplateFilter,
      },
    });

    const grossCents = metrics[AnalyticsMetricKey.GROSS] ?? 0;
    const platformFeeCents = metrics[AnalyticsMetricKey.PLATFORM_FEES] ?? 0;
    const processorFeeCents = metrics[AnalyticsMetricKey.PROCESSOR_FEES] ?? 0;
    const netRevenueCents = metrics[AnalyticsMetricKey.NET_TO_ORG] ?? 0;
    const feesCents = platformFeeCents + processorFeeCents;

    return jsonWrap(
      {
        ok: true,
        range,
        currency,
        totalTickets: entitlementStats.totalTickets,
        totalRevenueCents: netRevenueCents,
        grossCents,
        discountCents: 0,
        platformFeeCents,
        processorFeeCents,
        feesCents,
        netRevenueCents,
        eventsWithSalesCount: entitlementStats.eventsWithSalesCount,
        activeEventsCount,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[organização/overview] Erro inesperado:", error);
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
export const GET = withApiEnvelope(_GET);
