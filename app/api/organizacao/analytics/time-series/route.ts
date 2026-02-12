// app/api/organizacao/analytics/time-series/route.ts
// Serie temporal de vendas (V9) — rollups + ledger.

import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { EventTemplateType, OrganizationModule, AnalyticsDimensionKey, AnalyticsMetricKey, EntitlementType, SourceType } from "@prisma/client";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { ensureMemberModuleAccess } from "@/lib/organizationMemberAccess";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { Prisma } from "@prisma/client";

const LISBON_TZ = "Europe/Lisbon";

function parseRangeParams(url: URL) {
  const range = url.searchParams.get("range");
  const fromParam = url.searchParams.get("from");
  const toParam = url.searchParams.get("to");

  let from: Date | null = null;
  let to: Date | null = null;

  if (fromParam || toParam) {
    if (fromParam) {
      const d = new Date(fromParam);
      if (!Number.isNaN(d.getTime())) from = d;
    }
    if (toParam) {
      const d = new Date(toParam);
      if (!Number.isNaN(d.getTime())) to = d;
    }
  } else if (range) {
    const now = new Date();
    to = now;
    const base = new Date(now);

    switch (range) {
      case "7d": {
        base.setDate(base.getDate() - 7);
        from = base;
        break;
      }
      case "30d": {
        base.setDate(base.getDate() - 30);
        from = base;
        break;
      }
      case "90d": {
        base.setDate(base.getDate() - 90);
        from = base;
        break;
      }
      default:
        // "all" ou desconhecido -> deixamos from = null (sem limite inferior)
        from = null;
    }
  }

  return { from, to };
}

function formatDayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function toUtcDate(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function buildDateKeys(from: Date | null, to: Date | null) {
  if (!from || !to) return [] as string[];
  const start = toUtcDate(from);
  const end = toUtcDate(to);
  const keys: string[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    keys.push(formatDayKey(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return keys;
}

function pickCurrency(values: Array<string | null>, preferred?: string | null) {
  const normalized = values.filter((v): v is string => Boolean(v));
  if (preferred && normalized.includes(preferred)) return preferred;
  if (normalized.includes("EUR")) return "EUR";
  return normalized[0] ?? null;
}

type LedgerAggregateRow = {
  bucket_date: string;
  currency: string;
  gross: number;
  platform_fees: number;
  processor_fees: number;
  net_to_org: number;
};

type EntitlementBucket = { bucket_date: string; total: number };

async function fetchEntitlementBuckets(params: {
  organizationId: number;
  entitlementType: EntitlementType;
  eventId?: number | null;
  includeTemplateType?: EventTemplateType | null;
  excludeTemplateType?: EventTemplateType | null;
  from: Date | null;
  to: Date | null;
}) {
  const { organizationId, entitlementType, eventId, includeTemplateType, excludeTemplateType, from, to } = params;
  const dateFilter =
    from || to
      ? Prisma.sql`AND ent.created_at BETWEEN ${from ?? new Date(0)} AND ${to ?? new Date()}`
      : Prisma.empty;
  const eventFilter = typeof eventId === "number" ? Prisma.sql`AND ent.event_id = ${eventId}` : Prisma.empty;
  const templateFilterSql = includeTemplateType
    ? Prisma.sql`AND ev.template_type = ${includeTemplateType}`
    : excludeTemplateType
      ? Prisma.sql`AND ev.template_type != ${excludeTemplateType}`
      : Prisma.empty;

  const rows = await prisma.$queryRaw<EntitlementBucket[]>(Prisma.sql`
    SELECT
      (ent.created_at AT TIME ZONE ${LISBON_TZ})::date AS bucket_date,
      COUNT(*)::int AS total
    FROM app_v3.entitlements ent
    JOIN app_v3.events ev ON ev.id = ent.event_id
    WHERE ev.organization_id = ${organizationId}
      AND ent.type = ${entitlementType}
      ${eventFilter}
      ${templateFilterSql}
      ${dateFilter}
    GROUP BY bucket_date
  `);
  return rows;
}

async function fetchLedgerBuckets(params: {
  organizationId: number;
  sourceType: SourceType;
  sourceId: string;
  from: Date | null;
  to: Date | null;
}) {
  const { organizationId, sourceType, sourceId, from, to } = params;
  const dateFilter =
    from || to
      ? Prisma.sql`AND (le.created_at AT TIME ZONE ${LISBON_TZ})::date BETWEEN ${from ?? new Date(0)}::date AND ${to ?? new Date()}::date`
      : Prisma.empty;

  return prisma.$queryRaw<LedgerAggregateRow[]>(Prisma.sql`
    SELECT
      (le.created_at AT TIME ZONE ${LISBON_TZ})::date AS bucket_date,
      le.currency AS currency,
      SUM(CASE WHEN le.entry_type = 'GROSS' THEN le.amount ELSE 0 END) AS gross,
      SUM(CASE WHEN le.entry_type = 'PLATFORM_FEE' THEN -le.amount ELSE 0 END) AS platform_fees,
      SUM(CASE WHEN le.entry_type IN ('PROCESSOR_FEES_FINAL','PROCESSOR_FEES_ADJUSTMENT') THEN -le.amount ELSE 0 END) AS processor_fees,
      SUM(le.amount) AS net_to_org
    FROM app_v3.ledger_entries le
    JOIN app_v3.payments p ON p.id = le.payment_id
    WHERE p.organization_id = ${organizationId}
      AND le.source_type = ${sourceType}
      AND le.source_id = ${sourceId}
      ${dateFilter}
    GROUP BY bucket_date, le.currency
  `);
}

async function _GET(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      console.error("[organização/time-series] Erro ao obter utilizador:", authError);
    }

    if (!user) {
      return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }

    const url = new URL(req.url);
    const eventIdParam = url.searchParams.get("eventId");
    const { from, to } = parseRangeParams(url);
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
    const isPadelScope = parsedTemplateType === EventTemplateType.PADEL;

    let eventId: number | null = null;
    if (eventIdParam) {
      const parsed = Number(eventIdParam);
      if (Number.isNaN(parsed)) {
        return jsonWrap({ ok: false, error: "INVALID_EVENT_ID" }, { status: 400 });
      }
      eventId = parsed;
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

    const fromDate = from ? toUtcDate(from) : null;
    const toDate = to ? toUtcDate(to) : null;

    const moduleValue = isPadelScope ? "TORNEIOS" : "EVENTOS";
    const entitlementType = isPadelScope ? EntitlementType.PADEL_ENTRY : EntitlementType.EVENT_TICKET;

    const pointsMap = new Map<
      string,
      {
        gross: number;
        platform: number;
        processor: number;
        net: number;
        currency: string | null;
      }
    >();

    if (eventId) {
      const sourceType = isPadelScope ? SourceType.PADEL_REGISTRATION : SourceType.TICKET_ORDER;
      const ledgerRows = await fetchLedgerBuckets({
        organizationId: organization.id,
        sourceType,
        sourceId: String(eventId),
        from: fromDate,
        to: toDate,
      });

      for (const row of ledgerRows) {
        const key = row.bucket_date;
        pointsMap.set(key, {
          gross: Number(row.gross ?? 0),
          platform: Number(row.platform_fees ?? 0),
          processor: Number(row.processor_fees ?? 0),
          net: Number(row.net_to_org ?? 0),
          currency: row.currency ?? null,
        });
      }
    } else {
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
        select: { bucketDate: true, metricKey: true, value: true },
      });

      for (const row of rollupRows) {
        const key = formatDayKey(row.bucketDate);
        const current = pointsMap.get(key) ?? { gross: 0, platform: 0, processor: 0, net: 0, currency: null };
        if (row.metricKey === AnalyticsMetricKey.GROSS) current.gross += row.value;
        if (row.metricKey === AnalyticsMetricKey.PLATFORM_FEES) current.platform += row.value;
        if (row.metricKey === AnalyticsMetricKey.PROCESSOR_FEES) current.processor += row.value;
        if (row.metricKey === AnalyticsMetricKey.NET_TO_ORG) current.net += row.value;
        pointsMap.set(key, current);
      }
    }

    const entitlementRows = await fetchEntitlementBuckets({
      organizationId: organization.id,
      entitlementType,
      eventId,
      includeTemplateType: parsedTemplateType,
      excludeTemplateType: parsedExcludeTemplateType,
      from: fromDate,
      to: toDate,
    });
    const ticketsMap = new Map<string, number>();
    for (const row of entitlementRows) {
      ticketsMap.set(row.bucket_date, Number(row.total ?? 0));
    }

    const currency = pickCurrency(
      Array.from(pointsMap.values()).map((item) => item.currency),
    );

    const dateKeys = buildDateKeys(fromDate, toDate);
    const keys = dateKeys.length ? dateKeys : Array.from(new Set([...pointsMap.keys(), ...ticketsMap.keys()])).sort();

    const points = keys.map((key) => {
      const metrics = pointsMap.get(key) ?? { gross: 0, platform: 0, processor: 0, net: 0, currency: null };
      const tickets = ticketsMap.get(key) ?? 0;
      const fees = metrics.platform + metrics.processor;
      return {
        date: key,
        tickets,
        revenueCents: metrics.net,
        grossCents: metrics.gross,
        discountCents: 0,
        platformFeeCents: metrics.platform,
        processorFeeCents: metrics.processor,
        feesCents: fees,
        netCents: metrics.net,
        currency: metrics.currency ?? currency,
      };
    });

    return jsonWrap({ ok: true, points, currency });
  } catch (error) {
    console.error("[organização/time-series] Erro inesperado:", error);
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
export const GET = withApiEnvelope(_GET);
