import { Prisma, PrismaClient } from "@prisma/client";

type PadelCourtRow = {
  id: number;
  name: string;
  displayOrder: number | null;
  padelClubId: number | null;
};

type CourtSelectionSource = "request" | "defaults" | "advanced" | "clubActive";

type ResolvePadelCourtSelectionParams = {
  db: Prisma.TransactionClient | PrismaClient;
  organizationId: number;
  padelClubId?: number | null;
  partnerClubIds?: Array<number | null | undefined> | null;
  advancedSettings?: Record<string, unknown> | null;
  requestedCourtIds?: Array<number | string | null | undefined> | null;
  requestedCourtPriorityOrder?: Array<number | string | null | undefined> | null;
};

export type ResolvedPadelCourtSelection = {
  source: CourtSelectionSource;
  courts: PadelCourtRow[];
  courtIds: number[];
  courtPriorityOrder: number[];
};

const toPositiveInt = (value: unknown) => {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.floor(parsed);
};

const uniquePositiveInts = (values: Array<unknown>) => {
  const out: number[] = [];
  const seen = new Set<number>();
  for (const value of values) {
    const parsed = toPositiveInt(value);
    if (!parsed || seen.has(parsed)) continue;
    seen.add(parsed);
    out.push(parsed);
  }
  return out;
};

const dedupeById = <T extends { id: number }>(rows: T[]) => {
  const seen = new Set<number>();
  const out: T[] = [];
  for (const row of rows) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    out.push(row);
  }
  return out;
};

const sortByDisplayOrder = (rows: PadelCourtRow[]) =>
  [...rows].sort((a, b) => {
    const orderA = typeof a.displayOrder === "number" ? a.displayOrder : Number.MAX_SAFE_INTEGER;
    const orderB = typeof b.displayOrder === "number" ? b.displayOrder : Number.MAX_SAFE_INTEGER;
    return orderA - orderB || a.id - b.id;
  });

export async function resolvePadelCourtSelection(
  params: ResolvePadelCourtSelectionParams,
): Promise<ResolvedPadelCourtSelection> {
  const {
    db,
    organizationId,
    padelClubId,
    partnerClubIds,
    advancedSettings,
    requestedCourtIds,
    requestedCourtPriorityOrder,
  } = params;

  const advanced = advancedSettings ?? {};
  const selectionDefaults =
    advanced.courtSelectionDefaults && typeof advanced.courtSelectionDefaults === "object"
      ? (advanced.courtSelectionDefaults as Record<string, unknown>)
      : {};
  const requested = Array.isArray(requestedCourtIds) ? uniquePositiveInts(requestedCourtIds) : [];
  const defaults =
    selectionDefaults.useAllCourts === false && Array.isArray(selectionDefaults.courtIds)
      ? uniquePositiveInts(selectionDefaults.courtIds as unknown[])
      : [];
  const configured = Array.isArray(advanced.courtIds) ? uniquePositiveInts(advanced.courtIds as unknown[]) : [];

  let source: CourtSelectionSource = "clubActive";
  let preferredCourtIds: number[] = [];
  if (requested.length > 0) {
    source = "request";
    preferredCourtIds = requested;
  } else if (defaults.length > 0) {
    source = "defaults";
    preferredCourtIds = defaults;
  } else if (configured.length > 0) {
    source = "advanced";
    preferredCourtIds = configured;
  }

  const baseWhere: Prisma.PadelClubCourtWhereInput = {
    isActive: true,
    club: { organizationId },
  };

  let courts: PadelCourtRow[] = [];
  if (preferredCourtIds.length > 0) {
    const rows = await db.padelClubCourt.findMany({
      where: {
        ...baseWhere,
        id: { in: preferredCourtIds },
      },
      select: {
        id: true,
        name: true,
        displayOrder: true,
        padelClubId: true,
      },
    });
    const byId = new Map(rows.map((row) => [row.id, row]));
    courts = preferredCourtIds.reduce<PadelCourtRow[]>((acc, id) => {
      const row = byId.get(id);
      if (!row) return acc;
      acc.push({
        id: row.id,
        name: row.name,
        displayOrder: row.displayOrder,
        padelClubId: row.padelClubId,
      });
      return acc;
    }, []);
  }

  if (courts.length === 0) {
    const resolvedClubIds = uniquePositiveInts([padelClubId, ...(partnerClubIds ?? [])]);
    courts = await db.padelClubCourt.findMany({
      where: {
        ...baseWhere,
        ...(resolvedClubIds.length > 0 ? { padelClubId: { in: resolvedClubIds } } : {}),
      },
      select: {
        id: true,
        name: true,
        displayOrder: true,
        padelClubId: true,
      },
      orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
    });
    source = "clubActive";
  }

  const cleanedCourts = dedupeById(sortByDisplayOrder(courts));
  const selectedIds = cleanedCourts.map((court) => court.id);

  const configuredPriority = Array.isArray(advanced.courtPriorityOrder)
    ? uniquePositiveInts(advanced.courtPriorityOrder as unknown[])
    : [];
  const requestedPriority = Array.isArray(requestedCourtPriorityOrder)
    ? uniquePositiveInts(requestedCourtPriorityOrder)
    : [];
  const priorityBase = requestedPriority.length > 0 ? requestedPriority : configuredPriority;
  const filteredPriority = priorityBase.filter((courtId) => selectedIds.includes(courtId));
  const courtPriorityOrder = [...filteredPriority, ...selectedIds.filter((courtId) => !filteredPriority.includes(courtId))];

  if (courtPriorityOrder.length > 0) {
    const rankByCourtId = new Map(courtPriorityOrder.map((courtId, idx) => [courtId, idx]));
    cleanedCourts.sort((a, b) => {
      const rankA = rankByCourtId.get(a.id);
      const rankB = rankByCourtId.get(b.id);
      if (typeof rankA === "number" && typeof rankB === "number" && rankA !== rankB) return rankA - rankB;
      if (typeof rankA === "number") return -1;
      if (typeof rankB === "number") return 1;
      const orderA = typeof a.displayOrder === "number" ? a.displayOrder : Number.MAX_SAFE_INTEGER;
      const orderB = typeof b.displayOrder === "number" ? b.displayOrder : Number.MAX_SAFE_INTEGER;
      return orderA - orderB || a.id - b.id;
    });
  }

  return {
    source,
    courts: cleanedCourts,
    courtIds: cleanedCourts.map((court) => court.id),
    courtPriorityOrder,
  };
}
