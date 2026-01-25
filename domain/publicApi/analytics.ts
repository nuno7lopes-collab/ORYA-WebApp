import { prisma } from "@/lib/prisma";
import { AnalyticsDimensionKey, AnalyticsMetricKey } from "@prisma/client";

export async function listPublicAnalytics(params: {
  organizationId: number;
  from?: Date | null;
  to?: Date | null;
  metricKeys?: AnalyticsMetricKey[];
  dimensionKey?: AnalyticsDimensionKey | null;
  limit?: number;
}) {
  const { organizationId, from, to, metricKeys, dimensionKey, limit = 200 } = params;
  return prisma.analyticsRollup.findMany({
    where: {
      organizationId,
      bucketDate: {
        gte: from ?? undefined,
        lte: to ?? undefined,
      },
      metricKey: metricKeys?.length ? { in: metricKeys } : undefined,
      dimensionKey: dimensionKey ?? undefined,
    },
    orderBy: { bucketDate: "desc" },
    take: Math.min(limit, 500),
    select: {
      organizationId: true,
      bucketDate: true,
      metricKey: true,
      dimensionKey: true,
      dimensionValue: true,
      value: true,
    },
  });
}
