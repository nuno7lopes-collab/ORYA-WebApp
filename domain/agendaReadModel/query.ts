import { prisma } from "@/lib/prisma";
import { BookingStatus, SourceType } from "@prisma/client";
import { buildAgendaOverlapFilter } from "@/domain/agendaReadModel/overlap";

export type AgendaItem = {
  kind: "EVENT" | "TOURNAMENT" | "RESERVATION" | "CLASS";
  eventId?: number | null;
  tournamentId?: number | null;
  reservationId?: number | null;
  classSessionId?: number | null;
  padelClubId?: number | null;
  courtId?: number | null;
  resourceId?: number | null;
  professionalId?: number | null;
  title: string;
  startsAt: Date;
  endsAt: Date;
  status: string;
};

type AgendaQueryCacheEntry = {
  expiresAt: number;
  items: AgendaItem[];
};

const AGENDA_QUERY_CACHE_TTL_MS = 5_000;
const AGENDA_QUERY_CACHE_MAX_ENTRIES = 200;
const AGENDA_QUERY_CACHE_ENABLED = process.env.NODE_ENV !== "test";
const agendaQueryCache = new Map<string, AgendaQueryCacheEntry>();

function normalizeIdList(values: number[] | undefined) {
  if (!values || values.length === 0) return [];
  return [...new Set(values)].sort((a, b) => a - b);
}

function cloneAgendaItems(items: AgendaItem[]) {
  return items.map((item) => ({
    ...item,
    startsAt: new Date(item.startsAt),
    endsAt: new Date(item.endsAt),
  }));
}

function buildAgendaCacheKey(params: {
  organizationId: number;
  from: Date;
  to: Date;
  padelClubId: number | null;
  courtId: number | null;
  sourceTypes: SourceType[];
  scopeMode: "OR" | "AND";
  scopeFilter: { courtIds?: number[]; resourceIds?: number[]; professionalIds?: number[] } | null;
}) {
  const normalizedSourceTypes = [...params.sourceTypes].sort();
  const normalizedScope = {
    courtIds: normalizeIdList(params.scopeFilter?.courtIds),
    resourceIds: normalizeIdList(params.scopeFilter?.resourceIds),
    professionalIds: normalizeIdList(params.scopeFilter?.professionalIds),
  };
  return JSON.stringify({
    organizationId: params.organizationId,
    from: params.from.toISOString(),
    to: params.to.toISOString(),
    padelClubId: params.padelClubId,
    courtId: params.courtId,
    sourceTypes: normalizedSourceTypes,
    scopeMode: params.scopeMode,
    scopeFilter: normalizedScope,
  });
}

function getCachedAgendaItems(cacheKey: string) {
  const cached = agendaQueryCache.get(cacheKey);
  if (!cached) return null;
  if (Date.now() > cached.expiresAt) {
    agendaQueryCache.delete(cacheKey);
    return null;
  }
  return cloneAgendaItems(cached.items);
}

function setCachedAgendaItems(cacheKey: string, items: AgendaItem[]) {
  if (agendaQueryCache.size >= AGENDA_QUERY_CACHE_MAX_ENTRIES) {
    const oldestKey = agendaQueryCache.keys().next().value;
    if (oldestKey) agendaQueryCache.delete(oldestKey);
  }
  agendaQueryCache.set(cacheKey, {
    expiresAt: Date.now() + AGENDA_QUERY_CACHE_TTL_MS,
    items: cloneAgendaItems(items),
  });
}

export async function getAgendaItemsForOrganization(params: {
  organizationId: number;
  from: Date;
  to: Date;
  padelClubId?: number | null;
  courtId?: number | null;
  sourceTypes?: SourceType[];
  scopeFilter?: {
    courtIds?: number[];
    resourceIds?: number[];
    professionalIds?: number[];
  } | null;
  scopeMode?: "OR" | "AND";
}) {
  const {
    organizationId,
    from,
    to,
    padelClubId = null,
    courtId = null,
    sourceTypes = [SourceType.EVENT, SourceType.TOURNAMENT, SourceType.BOOKING, SourceType.CLASS_SESSION],
    scopeFilter = null,
    scopeMode = "OR",
  } = params;

  const cacheKey = AGENDA_QUERY_CACHE_ENABLED
    ? buildAgendaCacheKey({
        organizationId,
        from,
        to,
        padelClubId,
        courtId,
        sourceTypes,
        scopeMode,
        scopeFilter,
      })
    : null;
  if (cacheKey) {
    const cached = getCachedAgendaItems(cacheKey);
    if (cached) return cached;
  }

  const now = new Date();
  const rangeFilter = buildAgendaOverlapFilter({ from, to });
  const fromBuffer = new Date(from.getTime() - 24 * 60 * 60 * 1000);

  const wantsBookings = sourceTypes.includes(SourceType.BOOKING);
  const wantsClassSessions = sourceTypes.includes(SourceType.CLASS_SESSION);
  const agendaSourceTypes = sourceTypes.filter(
    (sourceType) => sourceType === SourceType.EVENT || sourceType === SourceType.TOURNAMENT,
  );

  const scopeOr: Array<Record<string, unknown>> = [];
  const courtIds = scopeFilter?.courtIds ?? [];
  const resourceIds = scopeFilter?.resourceIds ?? [];
  const professionalIds = scopeFilter?.professionalIds ?? [];
  if (courtIds.length > 0) scopeOr.push({ courtId: { in: courtIds } });
  if (resourceIds.length > 0) scopeOr.push({ resourceId: { in: resourceIds } });
  if (professionalIds.length > 0) scopeOr.push({ professionalId: { in: professionalIds } });
  const scopeAnd: Record<string, unknown> = {
    ...(courtIds.length > 0 ? { courtId: { in: courtIds } } : {}),
    ...(resourceIds.length > 0 ? { resourceId: { in: resourceIds } } : {}),
    ...(professionalIds.length > 0 ? { professionalId: { in: professionalIds } } : {}),
  };

  const bookingScopeWhere =
    scopeMode === "AND"
      ? {
          ...(courtIds.length > 0 ? { courtId: { in: courtIds } } : {}),
          ...(resourceIds.length > 0 ? { resourceId: { in: resourceIds } } : {}),
          ...(professionalIds.length > 0 ? { professionalId: { in: professionalIds } } : {}),
        }
      : {
          ...(scopeOr.length > 0 ? { OR: scopeOr } : {}),
        };
  const classScopeOr = scopeOr.filter((entry) => "courtId" in entry || "professionalId" in entry);
  const classScopeWhere =
    scopeMode === "AND"
      ? {
          ...(courtIds.length > 0 ? { courtId: { in: courtIds } } : {}),
          ...(professionalIds.length > 0 ? { professionalId: { in: professionalIds } } : {}),
        }
      : {
          ...(classScopeOr.length > 0 ? { OR: classScopeOr } : {}),
        };

  const [agendaItems, bookings, classSessions] = await Promise.all([
    agendaSourceTypes.length > 0
      ? prisma.agendaItem.findMany({
          where: {
            organizationId,
            ...rangeFilter,
            ...(padelClubId ? { padelClubId } : {}),
            ...(courtId ? { courtId } : {}),
            sourceType: {
              in: agendaSourceTypes,
            },
            status: { not: "DELETED" },
            ...(scopeMode === "AND"
              ? Object.keys(scopeAnd).length > 0
                ? scopeAnd
                : {}
              : scopeOr.length > 0
                ? { OR: scopeOr }
                : {}),
          },
          orderBy: [{ startsAt: "asc" }, { sourceId: "asc" }],
          select: {
            title: true,
            startsAt: true,
            endsAt: true,
            sourceType: true,
            sourceId: true,
            status: true,
            padelClubId: true,
            courtId: true,
            resourceId: true,
            professionalId: true,
          },
        })
      : Promise.resolve([]),
    wantsBookings
      ? prisma.booking.findMany({
          where: {
            organizationId,
            startsAt: { gte: fromBuffer, lte: to },
            ...(courtId ? { courtId } : {}),
            ...(padelClubId ? { court: { padelClubId } } : {}),
            NOT: {
              AND: [
                {
                  status: {
                    in: [BookingStatus.PENDING, BookingStatus.PENDING_CONFIRMATION],
                  },
                },
                { startsAt: { lt: now } },
              ],
            },
            ...bookingScopeWhere,
          },
          orderBy: [{ startsAt: "asc" }, { id: "asc" }],
          select: {
            id: true,
            startsAt: true,
            durationMinutes: true,
            status: true,
            courtId: true,
            resourceId: true,
            professionalId: true,
            court: {
              select: { padelClubId: true },
            },
            service: {
              select: { title: true },
            },
          },
        })
      : Promise.resolve([]),
    wantsClassSessions
      ? prisma.classSession.findMany({
          where: {
            organizationId,
            ...rangeFilter,
            ...(courtId ? { courtId } : {}),
            ...(padelClubId ? { court: { padelClubId } } : {}),
            ...classScopeWhere,
          },
          orderBy: [{ startsAt: "asc" }, { id: "asc" }],
          select: {
            id: true,
            startsAt: true,
            endsAt: true,
            status: true,
            courtId: true,
            professionalId: true,
            court: {
              select: { padelClubId: true },
            },
            service: {
              select: { title: true },
            },
          },
        })
      : Promise.resolve([]),
  ]);

  const byKey = new Map<string, AgendaItem>();

  agendaItems.forEach((item) => {
    const base = {
      title: item.title,
      startsAt: item.startsAt,
      endsAt: item.endsAt,
      status: item.status,
      padelClubId: item.padelClubId ?? null,
      courtId: item.courtId ?? null,
      resourceId: item.resourceId ?? null,
      professionalId: item.professionalId ?? null,
    };
    if (item.sourceType === SourceType.TOURNAMENT) {
      const tournamentId = Number(item.sourceId);
      if (!Number.isFinite(tournamentId)) return;
      byKey.set(
        `TOURNAMENT:${tournamentId}`,
        {
          ...base,
          kind: "TOURNAMENT",
          tournamentId,
        } satisfies AgendaItem,
      );
      return;
    }
    if (item.sourceType === SourceType.EVENT) {
      const eventId = Number(item.sourceId);
      if (!Number.isFinite(eventId)) return;
      byKey.set(
        `EVENT:${eventId}`,
        {
          ...base,
          kind: "EVENT",
          eventId,
        } satisfies AgendaItem,
      );
    }
  });

  bookings.forEach((booking) => {
    const startsAt = booking.startsAt;
    const durationMinutes = Number(booking.durationMinutes ?? 0);
    if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) return;
    const endsAt = new Date(startsAt.getTime() + durationMinutes * 60_000);
    const overlaps = startsAt.getTime() <= to.getTime() && endsAt.getTime() >= from.getTime();
    if (!overlaps) return;
    const isPastPending =
      (booking.status === "PENDING_CONFIRMATION" || booking.status === "PENDING") &&
      startsAt.getTime() < now.getTime();
    if (isPastPending) return;
    byKey.set(
      `BOOKING:${booking.id}`,
      {
        kind: "RESERVATION",
        reservationId: booking.id,
        title: booking.service?.title ?? "Reserva",
        startsAt,
        endsAt,
        status: booking.status,
        padelClubId: booking.court?.padelClubId ?? null,
        courtId: booking.courtId ?? null,
        resourceId: booking.resourceId ?? null,
        professionalId: booking.professionalId ?? null,
      } satisfies AgendaItem,
    );
  });

  classSessions.forEach((session) => {
    const startsAt = session.startsAt;
    const endsAt = session.endsAt;
    const overlaps = startsAt.getTime() <= to.getTime() && endsAt.getTime() >= from.getTime();
    if (!overlaps) return;
    byKey.set(
      `CLASS:${session.id}`,
      {
        kind: "CLASS",
        classSessionId: session.id,
        title: session.service?.title ?? "Aula",
        startsAt,
        endsAt,
        status: session.status,
        padelClubId: session.court?.padelClubId ?? null,
        courtId: session.courtId ?? null,
        resourceId: null,
        professionalId: session.professionalId ?? null,
      } satisfies AgendaItem,
    );
  });

  const items = [...byKey.values()].sort((a, b) => {
    const diff = a.startsAt.getTime() - b.startsAt.getTime();
    if (diff !== 0) return diff;
    return a.endsAt.getTime() - b.endsAt.getTime();
  });
  if (cacheKey) {
    setCachedAgendaItems(cacheKey, items);
  }
  return items;
}
