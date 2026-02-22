import type { Prisma, PrismaClient } from "@prisma/client";

export const COURT_DURATION_CATALOG = [30, 60, 90, 120] as const;

type TxLike =
  | Pick<PrismaClient, "serviceDurationPrice">
  | Pick<
      Prisma.TransactionClient,
      "serviceDurationPrice"
    >;

export type CourtDurationPriceItem = {
  durationMinutes: number;
  priceCents: number;
  isActive: boolean;
};

export function normalizeCourtDuration(value: unknown): number | null {
  const minutes = Number(value);
  if (!Number.isFinite(minutes)) return null;
  const normalized = Math.round(minutes);
  return COURT_DURATION_CATALOG.includes(normalized as (typeof COURT_DURATION_CATALOG)[number]) ? normalized : null;
}

export function buildDefaultCourtDurationPrices(params: {
  baseDurationMinutes: number;
  basePriceCents: number;
}): CourtDurationPriceItem[] {
  const baseDuration = Number.isFinite(params.baseDurationMinutes) && params.baseDurationMinutes > 0
    ? Math.round(params.baseDurationMinutes)
    : 60;
  const basePrice = Number.isFinite(params.basePriceCents) && params.basePriceCents >= 0
    ? Math.round(params.basePriceCents)
    : 0;
  const unitPricePerMinute = baseDuration > 0 ? basePrice / baseDuration : 0;
  return COURT_DURATION_CATALOG.map((durationMinutes) => ({
    durationMinutes,
    priceCents: Math.max(0, Math.round(unitPricePerMinute * durationMinutes)),
    isActive: true,
  }));
}

export async function listCourtDurationPrices(params: {
  tx: TxLike;
  serviceId: number;
  activeOnly?: boolean;
}) {
  const rows = await params.tx.serviceDurationPrice.findMany({
    where: {
      serviceId: params.serviceId,
      ...(params.activeOnly === false ? {} : { isActive: true }),
    },
    orderBy: [{ durationMinutes: "asc" }],
    select: {
      durationMinutes: true,
      priceCents: true,
      isActive: true,
    },
  });
  return rows.map((row) => ({
    durationMinutes: row.durationMinutes,
    priceCents: row.priceCents,
    isActive: row.isActive,
  }));
}

export async function resolveCourtDurationPrice(params: {
  tx: TxLike;
  serviceId: number;
  durationMinutes: number;
}) {
  const row = await params.tx.serviceDurationPrice.findFirst({
    where: {
      serviceId: params.serviceId,
      durationMinutes: Math.round(params.durationMinutes),
      isActive: true,
    },
    select: {
      durationMinutes: true,
      priceCents: true,
      isActive: true,
    },
  });
  if (!row) return null;
  return {
    durationMinutes: row.durationMinutes,
    priceCents: row.priceCents,
    isActive: row.isActive,
  };
}

export function normalizeCourtDurationPricePayload(value: unknown): CourtDurationPriceItem[] | null {
  if (!Array.isArray(value)) return null;
  const parsed: CourtDurationPriceItem[] = [];
  const seen = new Set<number>();

  for (const item of value) {
    if (!item || typeof item !== "object") return null;
    const row = item as Record<string, unknown>;
    const durationMinutes = normalizeCourtDuration(row.durationMinutes);
    const priceCentsRaw = Number(row.priceCents);
    if (!durationMinutes) return null;
    if (!Number.isFinite(priceCentsRaw) || Math.round(priceCentsRaw) < 0) return null;
    if (seen.has(durationMinutes)) return null;
    seen.add(durationMinutes);
    parsed.push({
      durationMinutes,
      priceCents: Math.round(priceCentsRaw),
      isActive: row.isActive !== false,
    });
  }

  return parsed.sort((a, b) => a.durationMinutes - b.durationMinutes);
}

export async function replaceCourtDurationPrices(params: {
  tx: TxLike;
  serviceId: number;
  rows: CourtDurationPriceItem[];
}) {
  await params.tx.serviceDurationPrice.deleteMany({
    where: { serviceId: params.serviceId },
  });
  if (params.rows.length === 0) return;
  await params.tx.serviceDurationPrice.createMany({
    data: params.rows.map((row) => ({
      serviceId: params.serviceId,
      durationMinutes: row.durationMinutes,
      priceCents: row.priceCents,
      isActive: row.isActive,
    })),
  });
}
