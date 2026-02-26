import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAppEnv } from "@/lib/appEnv";
import {
  type TelemetrySeverity,
  type TelemetrySourceType,
} from "@/domain/telemetry/constants";

type TelemetryListFilters = {
  organizationId?: number | null;
  from?: Date | null;
  to?: Date | null;
  sourceType?: TelemetrySourceType | null;
  severity?: TelemetrySeverity | null;
  eventName?: string | null;
  query?: string | null;
  cursor?: string | null;
  take?: number;
};

export type TelemetryOverviewParams = {
  organizationId?: number | null;
  hours?: number;
};

type TelemetryEventDelegate = {
  findMany?: (args: unknown) => Promise<any[]>;
  count?: (args: unknown) => Promise<number>;
  groupBy?: (args: unknown) => Promise<any[]>;
};

function telemetryEventDelegate(): TelemetryEventDelegate | null {
  return ((prisma as unknown as { telemetryEvent?: TelemetryEventDelegate }).telemetryEvent ??
    null) as TelemetryEventDelegate | null;
}

function parseTake(value: number | undefined, fallback = 50, max = 200) {
  const raw = Number(value ?? fallback);
  if (!Number.isFinite(raw) || raw <= 0) return fallback;
  return Math.min(Math.floor(raw), max);
}

function toNullableString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

export async function listTelemetryEvents(filters: TelemetryListFilters) {
  const delegate = telemetryEventDelegate();
  if (!delegate?.findMany) {
    return {
      items: [],
      pagination: { hasMore: false, nextCursor: null as string | null },
    };
  }

  const take = parseTake(filters.take, 50, 200);
  const query = toNullableString(filters.query);
  const eventName = toNullableString(filters.eventName);

  const where: Record<string, unknown> = {
    ...(typeof filters.organizationId === "number" ? { organizationId: filters.organizationId } : {}),
    ...(filters.sourceType ? { sourceType: filters.sourceType } : {}),
    ...(filters.severity ? { severity: filters.severity } : {}),
    ...(eventName ? { eventName: { equals: eventName } } : {}),
    ...(filters.from || filters.to
      ? {
          occurredAt: {
            ...(filters.from ? { gte: filters.from } : {}),
            ...(filters.to ? { lte: filters.to } : {}),
          },
        }
      : {}),
  };

  if (query) {
    where.OR = [
      { eventName: { contains: query, mode: "insensitive" } },
      { requestId: { contains: query, mode: "insensitive" } },
      { correlationId: { contains: query, mode: "insensitive" } },
      { idempotencyKey: { contains: query, mode: "insensitive" } },
      { actorKey: { contains: query, mode: "insensitive" } },
      { sessionId: { contains: query, mode: "insensitive" } },
    ];
  }

  const rows = await delegate.findMany({
    where,
    orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
    take: take + 1,
    ...(filters.cursor ? { cursor: { id: filters.cursor }, skip: 1 } : {}),
    select: {
      id: true,
      organizationId: true,
      eventName: true,
      eventVersion: true,
      sourceType: true,
      severity: true,
      actorType: true,
      actorUserId: true,
      actorKey: true,
      requestId: true,
      correlationId: true,
      idempotencyKey: true,
      sessionId: true,
      surface: true,
      outcome: true,
      payload: true,
      tags: true,
      occurredAt: true,
      ingestedAt: true,
    },
  });

  const hasMore = rows.length > take;
  const trimmed = hasMore ? rows.slice(0, take) : rows;
  const nextCursor = hasMore ? trimmed[trimmed.length - 1]?.id ?? null : null;

  return {
    items: trimmed,
    pagination: {
      hasMore,
      nextCursor,
    },
  };
}

export async function getTelemetryOverview(params: TelemetryOverviewParams) {
  const delegate = telemetryEventDelegate();
  const hoursRaw = Number(params.hours ?? 24);
  const hours =
    Number.isFinite(hoursRaw) && hoursRaw > 0
      ? Math.min(Math.floor(hoursRaw), 24 * 14)
      : 24;
  const now = new Date();
  const from = new Date(now.getTime() - hours * 60 * 60 * 1000);

  if (!delegate?.count || !delegate?.findMany || !delegate?.groupBy) {
    return {
      window: { hours, from, to: now },
      totals: { totalEvents: 0, errorEvents: 0, uniqueActors: 0, errorRateBps: 0 },
      sourceBreakdown: [] as Array<{ sourceType: string; count: number }>,
      topEvents: [] as Array<{ eventName: string; count: number }>,
      timeline: [] as Array<{ bucketStart: Date; total: number; errors: number }>,
      latest: [] as Array<Record<string, unknown>>,
    };
  }

  const where: Record<string, unknown> = {
    ...(typeof params.organizationId === "number" ? { organizationId: params.organizationId } : {}),
    occurredAt: { gte: from, lte: now },
  };

  const [totalEvents, errorEvents, sourceBreakdown, topEvents, latest] =
    await Promise.all([
      delegate.count({ where }),
      delegate.count({ where: { ...where, severity: { in: ["ERROR", "CRITICAL"] } } }),
      delegate.groupBy({
        by: ["sourceType"],
        where,
        _count: { _all: true },
        orderBy: { _count: { _all: "desc" } },
      }),
      delegate.groupBy({
        by: ["eventName"],
        where,
        _count: { _all: true },
        orderBy: { _count: { _all: "desc" } },
        take: 12,
      }),
      delegate.findMany({
        where,
        orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
        take: 8,
        select: {
          id: true,
          organizationId: true,
          eventName: true,
          sourceType: true,
          severity: true,
          occurredAt: true,
          correlationId: true,
          requestId: true,
        },
      }),
    ]);

  const env = getAppEnv();
  const orgFilter =
    typeof params.organizationId === "number"
      ? Prisma.sql`AND organization_id = ${params.organizationId}`
      : Prisma.empty;

  const [uniqueActorsRow] = await prisma.$queryRaw<{ total: bigint | number }[]>(
    Prisma.sql`
      SELECT COUNT(DISTINCT COALESCE(actor_key, actor_user_id::text)) AS total
      FROM app_v3.telemetry_events
      WHERE env = ${env}
        AND occurred_at >= ${from}
        AND occurred_at <= ${now}
        ${orgFilter}
    `,
  );

  const timelineRows = await prisma.$queryRaw<
    Array<{ bucket_start: Date; total: bigint | number; errors: bigint | number }>
  >(
    Prisma.sql`
      SELECT
        date_trunc('hour', occurred_at) AS bucket_start,
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE severity IN ('ERROR', 'CRITICAL')) AS errors
      FROM app_v3.telemetry_events
      WHERE env = ${env}
        AND occurred_at >= ${from}
        AND occurred_at <= ${now}
        ${orgFilter}
      GROUP BY bucket_start
      ORDER BY bucket_start ASC
    `,
  );

  return {
    window: {
      hours,
      from,
      to: now,
    },
    totals: {
      totalEvents,
      errorEvents,
      uniqueActors: Number(uniqueActorsRow?.total ?? 0),
      errorRateBps:
        totalEvents > 0 ? Math.round((errorEvents / totalEvents) * 10_000) : 0,
    },
    sourceBreakdown: (sourceBreakdown ?? []).map((row) => ({
      sourceType: String(row.sourceType ?? "UNKNOWN"),
      count: Number(row?._count?._all ?? 0),
    })),
    topEvents: (topEvents ?? []).map((row) => ({
      eventName: String(row.eventName ?? "unknown"),
      count: Number(row?._count?._all ?? 0),
    })),
    timeline: timelineRows.map((row) => ({
      bucketStart: row.bucket_start,
      total: Number(row.total ?? 0),
      errors: Number(row.errors ?? 0),
    })),
    latest,
  };
}
