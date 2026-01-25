import { beforeEach, describe, expect, it, vi } from "vitest";
import { AnalyticsDimensionKey, AnalyticsMetricKey, SourceType } from "@prisma/client";
import { computeAnalyticsRollups, runAnalyticsRollupJob, buildRollupsForTest } from "@/domain/analytics/rollup";
import { prisma } from "@/lib/prisma";

const rollupStore = new Map<string, any>();

vi.mock("@/lib/prisma", () => {
  const analyticsRollup = {
    upsert: vi.fn(({ where, create, update }: any) => {
      const key = JSON.stringify(where.organizationId_bucketDate_metricKey_dimensionKey_dimensionValue);
      const existing = rollupStore.get(key) ?? null;
      const next = existing ? { ...existing, ...update } : { ...create };
      rollupStore.set(key, next);
      return next;
    }),
    findFirst: vi.fn(() => null),
  };
  const prisma = {
    analyticsRollup,
    $queryRaw: vi.fn(),
  };
  return { prisma };
});

const prismaMock = vi.mocked(prisma);

describe("analytics rollup job", () => {
  beforeEach(() => {
    rollupStore.clear();
    prismaMock.analyticsRollup.upsert.mockClear();
    prismaMock.analyticsRollup.findFirst.mockReset();
    prismaMock.$queryRaw.mockReset();
  });

  it("gera rollups determinísticos (4x4)", () => {
    const items = buildRollupsForTest([
      {
        org_id: 1,
        bucket_date: "2024-01-01",
        currency: "EUR",
        source_type: SourceType.TICKET_ORDER,
        gross: 1000,
        platform_fees: 100,
        processor_fees: 50,
        net_to_org: 850,
      },
    ] as any);
    expect(items).toHaveLength(16);
    const sample = items.find((i) => i.metricKey === AnalyticsMetricKey.GROSS && i.dimensionKey === AnalyticsDimensionKey.CURRENCY);
    expect(sample?.value).toBe(1000);
  });

  it("idempotente: compute 2x não duplica", async () => {
    prismaMock.$queryRaw.mockResolvedValue([
      {
        org_id: 1,
        bucket_date: "2024-01-01",
        currency: "EUR",
        source_type: SourceType.BOOKING,
        gross: 500,
        platform_fees: 50,
        processor_fees: 25,
        net_to_org: 425,
      },
    ] as any);

    await computeAnalyticsRollups({ fromDate: "2024-01-01", toDate: "2024-01-01" });
    const sizeAfterFirst = rollupStore.size;
    await computeAnalyticsRollups({ fromDate: "2024-01-01", toDate: "2024-01-01" });
    const sizeAfterSecond = rollupStore.size;

    expect(sizeAfterFirst).toBe(sizeAfterSecond);
  });

  it("backfill safe (maxDays)", async () => {
    prismaMock.analyticsRollup.findFirst.mockResolvedValueOnce(null as any);
    prismaMock.$queryRaw.mockResolvedValueOnce([{ bucket_date: "2024-01-01" }] as any);
    prismaMock.$queryRaw.mockResolvedValueOnce([] as any);

    const res = await runAnalyticsRollupJob({ maxDays: 1 });
    expect(res.scannedDays).toBe(1);
  });
});
