import { prisma } from "@/lib/prisma";
import { AnalyticsDimensionKey, AnalyticsMetricKey, SourceType } from "@prisma/client";

const LISBON_TZ = "Europe/Lisbon";
const PAYMENT_PROVIDER = "STRIPE"; // D4: Stripe Connect obrigatório.

const SOURCE_TYPE_TO_MODULE: Record<SourceType, string> = {
  TICKET_ORDER: "EVENTOS",
  BOOKING: "RESERVAS",
  PADEL_REGISTRATION: "TORNEIOS",
  STORE_ORDER: "LOJA",
  SUBSCRIPTION: "FINANCEIRO",
  MEMBERSHIP: "FINANCEIRO",
  EVENT: "EVENTOS",
  TOURNAMENT: "TORNEIOS",
  MATCH: "TORNEIOS",
  LOYALTY_TX: "CRM",
  SOFT_BLOCK: "RESERVAS",
  HARD_BLOCK: "RESERVAS",
  CLASS_SESSION: "RESERVAS",
};

type LedgerAggregateRow = {
  org_id: number;
  bucket_date: string;
  currency: string;
  source_type: SourceType;
  gross: number;
  platform_fees: number;
  processor_fees: number;
  net_to_org: number;
};

type RollupItem = {
  organizationId: number;
  bucketDate: Date;
  metricKey: AnalyticsMetricKey;
  dimensionKey: AnalyticsDimensionKey;
  dimensionValue: string;
  value: number;
};

function toBucketDate(value: string | Date) {
  if (value instanceof Date) return value;
  return new Date(`${value}T00:00:00.000Z`);
}

function buildRollupsFromAggregates(rows: LedgerAggregateRow[]): RollupItem[] {
  const items: RollupItem[] = [];
  for (const row of rows) {
    const bucketDate = toBucketDate(row.bucket_date);
    const metrics: Array<[AnalyticsMetricKey, number]> = [
      [AnalyticsMetricKey.GROSS, row.gross],
      [AnalyticsMetricKey.PLATFORM_FEES, row.platform_fees],
      [AnalyticsMetricKey.PROCESSOR_FEES, row.processor_fees],
      [AnalyticsMetricKey.NET_TO_ORG, row.net_to_org],
    ];
    const dimensionTuples: Array<[AnalyticsDimensionKey, string]> = [
      [AnalyticsDimensionKey.CURRENCY, row.currency],
      [AnalyticsDimensionKey.SOURCE_TYPE, row.source_type],
      [AnalyticsDimensionKey.MODULE, SOURCE_TYPE_TO_MODULE[row.source_type] ?? "EVENTOS"],
      [AnalyticsDimensionKey.PAYMENT_PROVIDER, PAYMENT_PROVIDER],
    ];

    for (const [metricKey, value] of metrics) {
      for (const [dimensionKey, dimensionValue] of dimensionTuples) {
        items.push({
          organizationId: row.org_id,
          bucketDate,
          metricKey,
          dimensionKey,
          dimensionValue,
          value,
        });
      }
    }
  }
  return items;
}

export async function computeAnalyticsRollups(params: {
  fromDate: string;
  toDate: string;
  organizationId?: number;
}) {
  const { fromDate, toDate, organizationId } = params;
  const rows = await prisma.$queryRaw<LedgerAggregateRow[]>`
    SELECT
      p.organization_id AS org_id,
      (le.created_at AT TIME ZONE ${LISBON_TZ})::date AS bucket_date,
      le.currency AS currency,
      le.source_type AS source_type,
      SUM(CASE WHEN le.entry_type = 'GROSS' THEN le.amount ELSE 0 END) AS gross,
      SUM(CASE WHEN le.entry_type = 'PLATFORM_FEE' THEN -le.amount ELSE 0 END) AS platform_fees,
      SUM(CASE WHEN le.entry_type IN ('PROCESSOR_FEES_FINAL','PROCESSOR_FEES_ADJUSTMENT') THEN -le.amount ELSE 0 END) AS processor_fees,
      SUM(le.amount) AS net_to_org
    FROM app_v3.ledger_entries le
    JOIN app_v3.payments p ON p.id = le.payment_id
    WHERE (le.created_at AT TIME ZONE ${LISBON_TZ})::date BETWEEN ${fromDate}::date AND ${toDate}::date
      AND (${organizationId ?? null}::int IS NULL OR p.organization_id = ${organizationId ?? null}::int)
    GROUP BY org_id, bucket_date, currency, source_type
  `;

  const rollups = buildRollupsFromAggregates(rows);
  for (const item of rollups) {
    await prisma.analyticsRollup.upsert({
      where: {
        organizationId_bucketDate_metricKey_dimensionKey_dimensionValue: {
          organizationId: item.organizationId,
          bucketDate: item.bucketDate,
          metricKey: item.metricKey,
          dimensionKey: item.dimensionKey,
          dimensionValue: item.dimensionValue,
        },
      },
      update: { value: item.value },
      create: {
        organizationId: item.organizationId,
        bucketDate: item.bucketDate,
        metricKey: item.metricKey,
        dimensionKey: item.dimensionKey,
        dimensionValue: item.dimensionValue,
        value: item.value,
      },
    });
  }

  return { rows: rows.length, rollups: rollups.length };
}

export async function getLatestBucketDate(organizationId?: number) {
  const latest = await prisma.analyticsRollup.findFirst({
    where: organizationId ? { organizationId } : undefined,
    orderBy: { bucketDate: "desc" },
    select: { bucketDate: true },
  });
  return latest?.bucketDate ?? null;
}

export async function getFirstLedgerBucketDate() {
  const rows = await prisma.$queryRaw<{ bucket_date: string | null }[]>`
    SELECT MIN((le.created_at AT TIME ZONE ${LISBON_TZ})::date) AS bucket_date
    FROM app_v3.ledger_entries le
  `;
  const value = rows?.[0]?.bucket_date ?? null;
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}

export async function runAnalyticsRollupJob(params?: {
  organizationId?: number;
  fromDate?: string;
  toDate?: string;
  maxDays?: number;
}) {
  const { organizationId, fromDate, toDate, maxDays = 31 } = params ?? {};

  let startDate: Date | null = fromDate ? new Date(fromDate) : null;
  const endDate = toDate ? new Date(toDate) : null;

  if (!startDate) {
    const latest = await getLatestBucketDate(organizationId);
    if (latest) {
      startDate = new Date(latest);
    } else {
      startDate = await getFirstLedgerBucketDate();
    }
  }

  if (!startDate) {
    return { ok: true, scannedDays: 0, rows: 0, rollups: 0 };
  }

  const today = new Date();
  const finalDate = endDate ?? today;
  const days: string[] = [];
  const cursor = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate()));
  const last = new Date(Date.UTC(finalDate.getUTCFullYear(), finalDate.getUTCMonth(), finalDate.getUTCDate()));

  while (cursor <= last && days.length < maxDays) {
    const iso = cursor.toISOString().slice(0, 10);
    days.push(iso);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  let rows = 0;
  let rollups = 0;
  for (const day of days) {
    const result = await computeAnalyticsRollups({
      fromDate: day,
      toDate: day,
      organizationId,
    });
    rows += result.rows;
    rollups += result.rollups;
  }

  return { ok: true, scannedDays: days.length, rows, rollups };
}

export function buildRollupsForTest(rows: LedgerAggregateRow[]) {
  return buildRollupsFromAggregates(rows);
}
