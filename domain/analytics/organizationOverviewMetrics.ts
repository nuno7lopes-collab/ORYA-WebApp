import { prisma } from "@/lib/prisma";
import { PUBLIC_EVENT_DISCOVER_STATUSES } from "@/domain/events/publicStatus";
import { AnalyticsDimensionKey, AnalyticsMetricKey, EntitlementType, EventTemplateType, Prisma } from "@prisma/client";

export type AnalyticsOverviewRange = "7d" | "30d" | "all";

export type OrganizationAnalyticsOverviewMetrics = {
  range: AnalyticsOverviewRange;
  currency: string | null;
  totalTickets: number;
  totalRevenueCents: number;
  grossCents: number;
  discountCents: number;
  platformFeeCents: number;
  processorFeeCents: number;
  feesCents: number;
  netRevenueCents: number;
  eventsWithSalesCount: number;
  activeEventsCount: number;
};

function toUtcDate(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

export function resolveAnalyticsOverviewRangeBounds(range: AnalyticsOverviewRange, now: Date) {
  if (range === "7d") {
    return { from: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), to: now };
  }
  if (range === "all") {
    return { from: null as Date | null, to: null as Date | null };
  }
  return { from: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), to: now };
}

function pickCurrency(values: Array<string | null>, preferred?: string | null) {
  const normalized = values.filter((value): value is string => Boolean(value));
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

export function normalizeAnalyticsOverviewRange(raw: string | null | undefined): AnalyticsOverviewRange {
  if (raw === "7d" || raw === "30d" || raw === "all") return raw;
  return "30d";
}

export function parseEventTemplateType(raw: string | null | undefined): EventTemplateType | null {
  if (!raw) return null;
  const normalized = raw.trim().toUpperCase();
  return (Object.values(EventTemplateType) as string[]).includes(normalized)
    ? (normalized as EventTemplateType)
    : null;
}

export async function getOrganizationAnalyticsOverviewMetrics(params: {
  organizationId: number;
  range: AnalyticsOverviewRange;
  includeTemplateType?: EventTemplateType | null;
  excludeTemplateType?: EventTemplateType | null;
  preferredCurrency?: string | null;
  now?: Date;
}): Promise<OrganizationAnalyticsOverviewMetrics> {
  const {
    organizationId,
    range,
    includeTemplateType = null,
    excludeTemplateType = null,
    preferredCurrency = null,
    now = new Date(),
  } = params;
  const { from, to } = resolveAnalyticsOverviewRangeBounds(range, now);
  const fromDate = from ? toUtcDate(from) : null;
  const toDate = to ? toUtcDate(to) : null;

  const moduleValue = includeTemplateType === EventTemplateType.PADEL ? "TORNEIOS" : "EVENTOS";
  const rollupRows = await prisma.analyticsRollup.findMany({
    where: {
      organizationId,
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
      organizationId,
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
  const currency = pickCurrency(
    currencyRows.map((row) => row.dimensionValue),
    preferredCurrency,
  );

  const entitlementType = includeTemplateType === EventTemplateType.PADEL
    ? EntitlementType.PADEL_ENTRY
    : EntitlementType.EVENT_TICKET;
  const entitlementStats = await getEntitlementStats({
    organizationId,
    entitlementType,
    includeTemplateType,
    excludeTemplateType,
    fromDate,
    toDate,
  });

  const eventTemplateFilter: Prisma.EventWhereInput = includeTemplateType
    ? { templateType: includeTemplateType }
    : excludeTemplateType
      ? { NOT: { templateType: excludeTemplateType } }
      : {};
  const activeEventsCount = await prisma.event.count({
    where: {
      organizationId,
      status: { in: PUBLIC_EVENT_DISCOVER_STATUSES },
      ...eventTemplateFilter,
    },
  });

  const grossCents = metrics[AnalyticsMetricKey.GROSS] ?? 0;
  const platformFeeCents = metrics[AnalyticsMetricKey.PLATFORM_FEES] ?? 0;
  const processorFeeCents = metrics[AnalyticsMetricKey.PROCESSOR_FEES] ?? 0;
  const netRevenueCents = metrics[AnalyticsMetricKey.NET_TO_ORG] ?? 0;
  const feesCents = platformFeeCents + processorFeeCents;

  return {
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
  };
}
