import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAppEnv } from "@/lib/appEnv";
import {
  type TelemetryBucketUnit,
  type TelemetryMetricKey,
} from "@/domain/telemetry/constants";

type RollupParams = {
  from?: Date;
  to?: Date;
  bucketUnit?: TelemetryBucketUnit;
  organizationId?: number | null;
};

type GroupByRow = {
  organization_id: number;
  bucket_start: Date;
  dimension_value: string;
  event_count: bigint | number;
  error_count: bigint | number;
  unique_actors?: bigint | number;
};

type TelemetryMetricRollupDelegate = {
  upsert?: (args: unknown) => Promise<unknown>;
};

function rollupDelegate() {
  return (prisma as unknown as { telemetryMetricRollup?: TelemetryMetricRollupDelegate })
    .telemetryMetricRollup;
}

function toInt(value: bigint | number | undefined) {
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "number") return value;
  return 0;
}

async function upsertRollup(params: {
  organizationId: number;
  bucketStart: Date;
  bucketUnit: TelemetryBucketUnit;
  metricKey: TelemetryMetricKey;
  dimensionKey: string;
  dimensionValue: string;
  value: number;
}) {
  const delegate = rollupDelegate();
  if (!delegate?.upsert) return;
  await delegate.upsert({
    where: {
      env_organizationId_bucketStart_bucketUnit_metricKey_dimensionKey_dimensionValue:
        {
          env: getAppEnv(),
          organizationId: params.organizationId,
          bucketStart: params.bucketStart,
          bucketUnit: params.bucketUnit,
          metricKey: params.metricKey,
          dimensionKey: params.dimensionKey,
          dimensionValue: params.dimensionValue,
        },
    },
    create: {
      organizationId: params.organizationId,
      bucketStart: params.bucketStart,
      bucketUnit: params.bucketUnit,
      metricKey: params.metricKey,
      dimensionKey: params.dimensionKey,
      dimensionValue: params.dimensionValue,
      value: params.value,
    },
    update: {
      value: params.value,
      updatedAt: new Date(),
    },
  });
}

export async function recomputeTelemetryMetricRollups(params: RollupParams = {}) {
  const bucketUnit = params.bucketUnit ?? "HOUR";
  const now = params.to ?? new Date();
  const from =
    params.from ??
    new Date(now.getTime() - (bucketUnit === "HOUR" ? 24 : 14) * 60 * 60 * 1000);
  const organizationId =
    typeof params.organizationId === "number" &&
    Number.isInteger(params.organizationId) &&
    params.organizationId > 0
      ? params.organizationId
      : null;

  const env = getAppEnv();
  const bucketSql =
    bucketUnit === "DAY"
      ? Prisma.sql`date_trunc('day', occurred_at)`
      : Prisma.sql`date_trunc('hour', occurred_at)`;
  const orgFilter =
    typeof organizationId === "number"
      ? Prisma.sql`AND organization_id = ${organizationId}`
      : Prisma.empty;

  const totalRows = await prisma.$queryRaw<GroupByRow[]>(Prisma.sql`
    SELECT
      organization_id,
      ${bucketSql} AS bucket_start,
      'ALL'::text AS dimension_value,
      COUNT(*) AS event_count,
      COUNT(*) FILTER (WHERE severity IN ('ERROR', 'CRITICAL')) AS error_count,
      COUNT(DISTINCT COALESCE(actor_key, actor_user_id::text)) AS unique_actors
    FROM app_v3.telemetry_events
    WHERE env = ${env}
      AND organization_id IS NOT NULL
      AND occurred_at >= ${from}
      AND occurred_at < ${now}
      ${orgFilter}
    GROUP BY organization_id, bucket_start
  `);

  const eventRows = await prisma.$queryRaw<GroupByRow[]>(Prisma.sql`
    SELECT
      organization_id,
      ${bucketSql} AS bucket_start,
      event_name AS dimension_value,
      COUNT(*) AS event_count,
      COUNT(*) FILTER (WHERE severity IN ('ERROR', 'CRITICAL')) AS error_count,
      COUNT(DISTINCT COALESCE(actor_key, actor_user_id::text)) AS unique_actors
    FROM app_v3.telemetry_events
    WHERE env = ${env}
      AND organization_id IS NOT NULL
      AND occurred_at >= ${from}
      AND occurred_at < ${now}
      ${orgFilter}
    GROUP BY organization_id, bucket_start, event_name
  `);

  const sourceRows = await prisma.$queryRaw<GroupByRow[]>(Prisma.sql`
    SELECT
      organization_id,
      ${bucketSql} AS bucket_start,
      source_type::text AS dimension_value,
      COUNT(*) AS event_count,
      COUNT(*) FILTER (WHERE severity IN ('ERROR', 'CRITICAL')) AS error_count
    FROM app_v3.telemetry_events
    WHERE env = ${env}
      AND organization_id IS NOT NULL
      AND occurred_at >= ${from}
      AND occurred_at < ${now}
      ${orgFilter}
    GROUP BY organization_id, bucket_start, source_type
  `);

  const actorRows = await prisma.$queryRaw<GroupByRow[]>(Prisma.sql`
    SELECT
      organization_id,
      ${bucketSql} AS bucket_start,
      actor_type::text AS dimension_value,
      COUNT(*) AS event_count,
      COUNT(*) FILTER (WHERE severity IN ('ERROR', 'CRITICAL')) AS error_count
    FROM app_v3.telemetry_events
    WHERE env = ${env}
      AND organization_id IS NOT NULL
      AND occurred_at >= ${from}
      AND occurred_at < ${now}
      ${orgFilter}
    GROUP BY organization_id, bucket_start, actor_type
  `);

  let written = 0;

  for (const row of totalRows) {
    const orgId = Number(row.organization_id);
    const bucketStart = new Date(row.bucket_start);

    await upsertRollup({
      organizationId: orgId,
      bucketStart,
      bucketUnit,
      metricKey: "EVENT_COUNT",
      dimensionKey: "GLOBAL",
      dimensionValue: "ALL",
      value: toInt(row.event_count),
    });
    written += 1;

    await upsertRollup({
      organizationId: orgId,
      bucketStart,
      bucketUnit,
      metricKey: "ERROR_COUNT",
      dimensionKey: "GLOBAL",
      dimensionValue: "ALL",
      value: toInt(row.error_count),
    });
    written += 1;

    await upsertRollup({
      organizationId: orgId,
      bucketStart,
      bucketUnit,
      metricKey: "UNIQUE_ACTORS",
      dimensionKey: "GLOBAL",
      dimensionValue: "ALL",
      value: toInt(row.unique_actors),
    });
    written += 1;
  }

  for (const row of eventRows) {
    const organizationId = Number(row.organization_id);
    const bucketStart = new Date(row.bucket_start);

    await upsertRollup({
      organizationId,
      bucketStart,
      bucketUnit,
      metricKey: "EVENT_COUNT",
      dimensionKey: "EVENT_NAME",
      dimensionValue: row.dimension_value,
      value: toInt(row.event_count),
    });
    written += 1;

    await upsertRollup({
      organizationId,
      bucketStart,
      bucketUnit,
      metricKey: "ERROR_COUNT",
      dimensionKey: "EVENT_NAME",
      dimensionValue: row.dimension_value,
      value: toInt(row.error_count),
    });
    written += 1;

    await upsertRollup({
      organizationId,
      bucketStart,
      bucketUnit,
      metricKey: "UNIQUE_ACTORS",
      dimensionKey: "EVENT_NAME",
      dimensionValue: row.dimension_value,
      value: toInt(row.unique_actors),
    });
    written += 1;
  }

  for (const row of sourceRows) {
    await upsertRollup({
      organizationId: Number(row.organization_id),
      bucketStart: new Date(row.bucket_start),
      bucketUnit,
      metricKey: "EVENT_COUNT",
      dimensionKey: "SOURCE_TYPE",
      dimensionValue: row.dimension_value,
      value: toInt(row.event_count),
    });
    written += 1;

    await upsertRollup({
      organizationId: Number(row.organization_id),
      bucketStart: new Date(row.bucket_start),
      bucketUnit,
      metricKey: "ERROR_COUNT",
      dimensionKey: "SOURCE_TYPE",
      dimensionValue: row.dimension_value,
      value: toInt(row.error_count),
    });
    written += 1;
  }

  for (const row of actorRows) {
    await upsertRollup({
      organizationId: Number(row.organization_id),
      bucketStart: new Date(row.bucket_start),
      bucketUnit,
      metricKey: "EVENT_COUNT",
      dimensionKey: "ACTOR_TYPE",
      dimensionValue: row.dimension_value,
      value: toInt(row.event_count),
    });
    written += 1;

    await upsertRollup({
      organizationId: Number(row.organization_id),
      bucketStart: new Date(row.bucket_start),
      bucketUnit,
      metricKey: "ERROR_COUNT",
      dimensionKey: "ACTOR_TYPE",
      dimensionValue: row.dimension_value,
      value: toInt(row.error_count),
    });
    written += 1;
  }

  return {
    from,
    to: now,
    bucketUnit,
    rows: {
      totalRows: totalRows.length,
      eventRows: eventRows.length,
      sourceRows: sourceRows.length,
      actorRows: actorRows.length,
    },
    written,
  };
}
