import { describe, expect, it } from "vitest";
import { backfillCourtDurationPrices } from "@/lib/reservas/backfillCourtDurationPrices";

type ServiceRow = {
  id: number;
  kind: "COURT" | "GENERAL";
  durationMinutes: number;
  unitPriceCents: number;
};

type PriceRow = {
  serviceId: number;
  durationMinutes: number;
  priceCents: number;
  isActive: boolean;
};

type PackageRow = {
  serviceId: number;
  durationMinutes: number;
  priceCents: number;
  isActive: boolean;
  recommended: boolean;
  sortOrder: number;
  id: number;
};

function createFakePrisma(seed: {
  services: ServiceRow[];
  prices: PriceRow[];
  packages: PackageRow[];
}) {
  const services = seed.services.map((row) => ({ ...row }));
  const prices = seed.prices.map((row) => ({ ...row }));
  const packages = seed.packages.map((row) => ({ ...row }));

  return {
    service: {
      findMany: async (args: any) =>
        services
          .filter((row) => row.kind === args.where.kind)
          .filter((row) => (args.where.id?.gt ? row.id > args.where.id.gt : true))
          .sort((a, b) => a.id - b.id)
          .slice(0, args.take ?? 200),
    },
    serviceDurationPrice: {
      findMany: async (args: any) =>
        prices
          .filter((row) => args.where.serviceId.in.includes(row.serviceId))
          .map((row) => ({
            serviceId: row.serviceId,
            durationMinutes: row.durationMinutes,
          })),
      createMany: async (args: any) => {
        const data = Array.isArray(args.data) ? args.data : [];
        for (const row of data) {
          const exists = prices.some(
            (entry) => entry.serviceId === row.serviceId && entry.durationMinutes === row.durationMinutes,
          );
          if (!exists) {
            prices.push({
              serviceId: row.serviceId,
              durationMinutes: row.durationMinutes,
              priceCents: row.priceCents,
              isActive: row.isActive,
            });
          }
        }
        return { count: data.length };
      },
    },
    servicePackage: {
      findMany: async (args: any) =>
        packages
          .filter((row) => args.where.serviceId.in.includes(row.serviceId))
          .filter((row) => args.where.durationMinutes.in.includes(row.durationMinutes))
          .filter((row) => row.isActive)
          .sort((a, b) => a.serviceId - b.serviceId || Number(b.recommended) - Number(a.recommended) || a.sortOrder - b.sortOrder || a.id - b.id)
          .map((row) => ({
            serviceId: row.serviceId,
            durationMinutes: row.durationMinutes,
            priceCents: row.priceCents,
          })),
    },
    getState: () => ({ prices: prices.map((row) => ({ ...row })) }),
  };
}

describe("backfillCourtDurationPrices", () => {
  it("dry-run calcula sem mutar", async () => {
    const prisma = createFakePrisma({
      services: [{ id: 1, kind: "COURT", durationMinutes: 60, unitPriceCents: 2400 }],
      prices: [],
      packages: [],
    });

    const summary = await backfillCourtDurationPrices(prisma as any, { dryRun: true, limit: 100 });
    expect(summary.scanned).toBe(1);
    expect(summary.createdRows).toBe(4);
    expect(prisma.getState().prices).toHaveLength(0);
  });

  it("apply cria faltas e é idempotente", async () => {
    const prisma = createFakePrisma({
      services: [{ id: 20, kind: "COURT", durationMinutes: 60, unitPriceCents: 2400 }],
      prices: [{ serviceId: 20, durationMinutes: 60, priceCents: 2400, isActive: true }],
      packages: [{ id: 2, serviceId: 20, durationMinutes: 90, priceCents: 3900, isActive: true, recommended: true, sortOrder: 0 }],
    });

    const first = await backfillCourtDurationPrices(prisma as any, { dryRun: false, limit: 100 });
    const second = await backfillCourtDurationPrices(prisma as any, { dryRun: false, limit: 100 });

    expect(first.createdRows).toBe(3);
    expect(second.createdRows).toBe(0);
    const prices = prisma.getState().prices.filter((row) => row.serviceId === 20);
    expect(prices).toHaveLength(4);
    const price90 = prices.find((row) => row.durationMinutes === 90);
    expect(price90?.priceCents).toBe(3900);
  });
});
