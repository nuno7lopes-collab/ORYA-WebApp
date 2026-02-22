import type { Prisma, PrismaClient } from "@prisma/client";
import {
  buildDefaultCourtDurationPrices,
  COURT_DURATION_CATALOG,
} from "@/lib/reservas/serviceDurationPrices";

type PrismaLike = Pick<
  PrismaClient,
  "service" | "servicePackage" | "serviceDurationPrice"
> | Prisma.TransactionClient;

const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 1000;

const toPositiveLimit = (value: number | null | undefined) => {
  if (!Number.isFinite(value)) return DEFAULT_LIMIT;
  return Math.min(Math.max(1, Math.floor(value as number)), MAX_LIMIT);
};

export type BackfillCourtDurationPricesOptions = {
  dryRun?: boolean;
  limit?: number | null;
  afterId?: number | null;
  logger?: (message: string) => void;
};

export type BackfillCourtDurationPricesSummary = {
  dryRun: boolean;
  limit: number;
  lastId: number | null;
  scanned: number;
  withMissingRows: number;
  createdRows: number;
  unchanged: number;
  errors: number;
};

export async function backfillCourtDurationPrices(
  prisma: PrismaLike,
  options?: BackfillCourtDurationPricesOptions,
): Promise<BackfillCourtDurationPricesSummary> {
  const dryRun = Boolean(options?.dryRun);
  const limit = toPositiveLimit(options?.limit ?? null);
  const afterId = Number.isFinite(options?.afterId) ? Number(options?.afterId) : null;
  const logger = options?.logger ?? (() => {});

  const services = await prisma.service.findMany({
    where: {
      kind: "COURT",
      ...(afterId ? { id: { gt: afterId } } : {}),
    },
    orderBy: [{ id: "asc" }],
    take: limit,
    select: {
      id: true,
      durationMinutes: true,
      unitPriceCents: true,
    },
  });

  const lastId = services.length > 0 ? services[services.length - 1]?.id ?? null : null;
  const serviceIds = services.map((service) => service.id);

  const [existingRows, packageRows] = await Promise.all([
    serviceIds.length
      ? prisma.serviceDurationPrice.findMany({
          where: { serviceId: { in: serviceIds } },
          select: {
            serviceId: true,
            durationMinutes: true,
          },
        })
      : Promise.resolve([]),
    serviceIds.length
      ? prisma.servicePackage.findMany({
          where: {
            serviceId: { in: serviceIds },
            isActive: true,
            durationMinutes: { in: [...COURT_DURATION_CATALOG] },
          },
          orderBy: [{ serviceId: "asc" }, { recommended: "desc" }, { sortOrder: "asc" }, { id: "asc" }],
          select: {
            serviceId: true,
            durationMinutes: true,
            priceCents: true,
          },
        })
      : Promise.resolve([]),
  ]);

  const existingByService = new Map<number, Set<number>>();
  for (const row of existingRows) {
    const set = existingByService.get(row.serviceId) ?? new Set<number>();
    set.add(row.durationMinutes);
    existingByService.set(row.serviceId, set);
  }

  const packagesByService = new Map<number, Map<number, number>>();
  for (const row of packageRows) {
    const map = packagesByService.get(row.serviceId) ?? new Map<number, number>();
    if (!map.has(row.durationMinutes)) {
      map.set(row.durationMinutes, row.priceCents);
    }
    packagesByService.set(row.serviceId, map);
  }

  let withMissingRows = 0;
  let createdRows = 0;
  let unchanged = 0;
  let errors = 0;

  for (const service of services) {
    try {
      const existingDurations = existingByService.get(service.id) ?? new Set<number>();
      const packagePrices = packagesByService.get(service.id) ?? new Map<number, number>();
      const proportional = buildDefaultCourtDurationPrices({
        baseDurationMinutes: service.durationMinutes,
        basePriceCents: service.unitPriceCents ?? 0,
      });
      const proportionalByDuration = new Map(proportional.map((row) => [row.durationMinutes, row.priceCents]));

      const missingRows = COURT_DURATION_CATALOG
        .filter((durationMinutes) => !existingDurations.has(durationMinutes))
        .map((durationMinutes) => {
          const packagePrice = packagePrices.get(durationMinutes);
          const basePrice =
            durationMinutes === service.durationMinutes ? Math.max(0, Math.round(service.unitPriceCents ?? 0)) : null;
          const proportionalPrice = proportionalByDuration.get(durationMinutes) ?? 0;
          const priceCents = packagePrice ?? basePrice ?? proportionalPrice;
          return {
            serviceId: service.id,
            durationMinutes,
            priceCents,
            isActive: true,
          };
        });

      if (missingRows.length === 0) {
        unchanged += 1;
        continue;
      }

      withMissingRows += 1;
      createdRows += missingRows.length;

      logger(
        `[court_duration_prices_backfill] service=${service.id} missing=${missingRows
          .map((row) => row.durationMinutes)
          .join(",")}`,
      );

      if (!dryRun) {
        await prisma.serviceDurationPrice.createMany({
          data: missingRows,
          skipDuplicates: true,
        });
      }
    } catch (err) {
      errors += 1;
      logger(
        `[court_duration_prices_backfill] ERROR service=${service.id} message=${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  return {
    dryRun,
    limit,
    lastId,
    scanned: services.length,
    withMissingRows,
    createdRows,
    unchanged,
    errors,
  };
}
