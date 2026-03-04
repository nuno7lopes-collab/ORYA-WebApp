export type DashboardKpiStatus = "AVAILABLE" | "NO_DATA" | "FORBIDDEN";

export type DashboardKpiValue<T> = {
  status: DashboardKpiStatus;
  value: T | null;
  reason?: string;
};

export type OccupancyAccumulator = {
  organizationId: number;
  sold: number;
  capacity: number;
  eventsCount: number;
};

export type OccupancyCoverage = {
  totalEvents: number;
  eventsWithCapacity: number;
  coverageRate: number | null;
};

export function clampRate(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.max(0, Math.min(1, value));
}

export function computeDeltaRate(base: number | null, reference: number | null) {
  if (typeof base !== "number" || typeof reference !== "number") return null;
  if (!Number.isFinite(base) || !Number.isFinite(reference)) return null;
  return Math.max(-1, Math.min(1, base - reference));
}

export function parsePadelMaxEntriesTotal(raw: unknown): number | null {
  if (!raw || typeof raw !== "object") return null;
  const maybeValue = (raw as { maxEntriesTotal?: unknown }).maxEntriesTotal;
  const normalized = Number(maybeValue);
  if (!Number.isFinite(normalized)) return null;
  const floored = Math.floor(normalized);
  return floored > 0 ? floored : null;
}

function hasPositiveCapacity(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export function computePadelCapacity(params: {
  maxEntriesTotal: number | null;
  categoryCapacities: Array<number | null>;
}): number | null {
  const { maxEntriesTotal, categoryCapacities } = params;
  if (typeof maxEntriesTotal === "number" && maxEntriesTotal > 0) return maxEntriesTotal;
  if (!categoryCapacities.length) return null;
  const normalized = categoryCapacities.filter(
    (capacity): capacity is number =>
      typeof capacity === "number" && Number.isFinite(capacity) && capacity > 0,
  );
  if (normalized.length !== categoryCapacities.length) return null;
  const sum = normalized.reduce((acc, item) => acc + item, 0);
  return sum > 0 ? sum : null;
}

export function buildOrganizationOccupancyMap(
  rows: Array<{ organizationId: number; sold: number; capacity: number | null }>,
) {
  const map = new Map<number, OccupancyAccumulator>();
  rows.forEach((row) => {
    if (!Number.isFinite(row.organizationId)) return;
    if (!hasPositiveCapacity(row.capacity)) return;
    const sold = Math.max(0, Math.floor(row.sold));
    const capacity = Math.max(0, Math.floor(row.capacity as number));
    if (capacity <= 0) return;
    const current = map.get(row.organizationId) ?? {
      organizationId: row.organizationId,
      sold: 0,
      capacity: 0,
      eventsCount: 0,
    };
    current.sold += sold;
    current.capacity += capacity;
    current.eventsCount += 1;
    map.set(row.organizationId, current);
  });
  return map;
}

export function computeOccupancyCoverage(rows: Array<{ capacity: number | null }>): OccupancyCoverage {
  const totalEvents = rows.length;
  const eventsWithCapacity = rows.reduce((count, row) => count + (hasPositiveCapacity(row.capacity) ? 1 : 0), 0);
  const coverageRate = totalEvents > 0 ? clampRate(eventsWithCapacity / totalEvents) : null;
  return {
    totalEvents,
    eventsWithCapacity,
    coverageRate,
  };
}

export function computeOrganizationOccupancyCoverage(
  rows: Array<{ organizationId: number; capacity: number | null }>,
  organizationId: number,
): OccupancyCoverage {
  return computeOccupancyCoverage(rows.filter((row) => row.organizationId === organizationId));
}

export function computeOrganizationOccupancyRate(
  map: Map<number, OccupancyAccumulator>,
  organizationId: number,
) {
  const row = map.get(organizationId);
  if (!row || row.capacity <= 0) {
    return {
      rate: null as number | null,
      sold: 0,
      capacity: 0,
      eventsCount: 0,
    };
  }
  return {
    rate: clampRate(row.sold / row.capacity),
    sold: row.sold,
    capacity: row.capacity,
    eventsCount: row.eventsCount,
  };
}

export function computePlatformAverageOccupancyRate(
  map: Map<number, OccupancyAccumulator>,
) {
  const ratios = Array.from(map.values())
    .filter((row) => row.capacity > 0)
    .map((row) => clampRate(row.sold / row.capacity))
    .filter((ratio): ratio is number => typeof ratio === "number");
  if (!ratios.length) {
    return { rate: null as number | null, organizations: 0 };
  }
  const total = ratios.reduce((acc, ratio) => acc + ratio, 0);
  return {
    rate: clampRate(total / ratios.length),
    organizations: ratios.length,
  };
}
