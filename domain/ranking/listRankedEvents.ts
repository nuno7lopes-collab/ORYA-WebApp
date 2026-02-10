import { prisma } from "@/lib/prisma";
import { SearchIndexVisibility, EventTemplateType, Prisma, SourceType } from "@prisma/client";
import {
  toPublicEventCardWithPriceFromIndex,
  isPublicEventCardComplete,
  PublicEventCard,
  PublicEventCardWithPrice,
} from "@/domain/events/publicEventCard";
import { rankEvents } from "@/domain/ranking/eventRanker";
import { filterOrphanedEventSearchItems } from "@/domain/searchIndex/guard";

type RankedEventsParams = {
  q?: string | null;
  city?: string | null;
  categories?: string | null;
  templateTypes?: string | null;
  date?: string | null;
  day?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  north?: number | null;
  south?: number | null;
  east?: number | null;
  west?: number | null;
  type?: string | null;
  priceMin?: string | null;
  priceMax?: string | null;
  cursor?: string | null;
  limit?: number | null;
  sort?: string | null;
  viewerId?: string | null;
  favouriteCategories?: string[] | null;
  lat?: number | null;
  lng?: number | null;
};

const DEFAULT_PAGE_SIZE = 12;

function clampTake(value: number | null): number {
  if (!value || Number.isNaN(value)) return DEFAULT_PAGE_SIZE;
  return Math.min(Math.max(value, 1), 50);
}

function parsePrice(value: string | null): number | null {
  if (!value) return null;
  const parsed = parseFloat(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, parsed);
}

function pushAndFilter(where: Prisma.SearchIndexItemWhereInput, filter: Prisma.SearchIndexItemWhereInput) {
  if (Array.isArray(where.AND)) {
    where.AND.push(filter);
    return;
  }
  if (where.AND) {
    where.AND = [where.AND, filter];
    return;
  }
  where.AND = [filter];
}

function applyDateFilter(where: Prisma.SearchIndexItemWhereInput, dateParam: string | null, dayParam: string | null) {
  if (dateParam === "agora") {
    const now = new Date();
    pushAndFilter(where, {
      OR: [
        { startsAt: { gte: now } },
        { AND: [{ startsAt: { lte: now } }, { endsAt: { gte: now } }] },
      ],
    });
    return;
  }
  if (dateParam === "today") {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);
    where.startsAt = { gte: startOfDay, lte: endOfDay };
    return;
  }
  if (dateParam === "upcoming") {
    const now = new Date();
    where.startsAt = { gte: now };
    return;
  }
  if (dateParam === "weekend") {
    const now = new Date();
    const day = now.getDay();
    let start = new Date(now);
    let end = new Date(now);
    if (day === 0) {
      start = now;
      end.setHours(23, 59, 59, 999);
    } else {
      const daysToSaturday = (6 - day + 7) % 7;
      start.setDate(now.getDate() + daysToSaturday);
      start.setHours(0, 0, 0, 0);
      end = new Date(start);
      end.setDate(start.getDate() + 1);
      end.setHours(23, 59, 59, 999);
    }
    where.startsAt = { gte: start, lte: end };
    return;
  }
  if (dateParam === "day" && dayParam) {
    const day = new Date(dayParam);
    if (!Number.isNaN(day.getTime())) {
      const startOfDay = new Date(day);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(day);
      endOfDay.setHours(23, 59, 59, 999);
      where.startsAt = { gte: startOfDay, lte: endOfDay };
    }
  }
}

function applyDateRangeFilter(where: Prisma.SearchIndexItemWhereInput, startDateParam: string | null, endDateParam: string | null): boolean {
  if (!startDateParam && !endDateParam) return false;
  const start = startDateParam ? new Date(startDateParam) : null;
  const end = endDateParam ? new Date(endDateParam) : null;
  if (start && !Number.isNaN(start.getTime())) start.setHours(0, 0, 0, 0);
  if (end && !Number.isNaN(end.getTime())) end.setHours(23, 59, 59, 999);
  if (start && end && !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
    where.startsAt = { gte: start, lte: end };
    return true;
  }
  if (start && !Number.isNaN(start.getTime())) {
    where.startsAt = { gte: start };
    return true;
  }
  if (end && !Number.isNaN(end.getTime())) {
    where.startsAt = { lte: end };
    return true;
  }
  return false;
}

function applyTemplateTypeFilter(where: Prisma.SearchIndexItemWhereInput, templateTypesParam: string | null) {
  const raw = (templateTypesParam || "")
    .split(",")
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean);
  if (raw.length === 0) return;
  const allowed = new Set(Object.values(EventTemplateType));
  const filtered = raw.filter((item) => allowed.has(item as EventTemplateType));
  if (filtered.length === 0) return;
  const typeFilter: Prisma.SearchIndexItemWhereInput = {
    templateType: { in: filtered as EventTemplateType[] },
  };
  if (Array.isArray(where.AND)) {
    where.AND.push(typeFilter);
  } else if (where.AND) {
    where.AND = [where.AND, typeFilter];
  } else {
    where.AND = [typeFilter];
  }
}

function applyBoundsFilter(where: Prisma.SearchIndexItemWhereInput, bounds: { north?: number | null; south?: number | null; east?: number | null; west?: number | null }) {
  if (bounds.north == null || bounds.south == null || bounds.east == null || bounds.west == null) return;
  let north = bounds.north;
  let south = bounds.south;
  let east = bounds.east;
  let west = bounds.west;
  if (![north, south, east, west].every((value) => Number.isFinite(value))) return;
  if (north < south) [north, south] = [south, north];
  const clampLat = (value: number) => Math.min(90, Math.max(-90, value));
  const wrapLng = (value: number) => {
    let v = value;
    while (v > 180) v -= 360;
    while (v < -180) v += 360;
    return v;
  };
  north = clampLat(north);
  south = clampLat(south);
  east = wrapLng(east);
  west = wrapLng(west);

  const latitudeFilter = { latitude: { gte: south, lte: north } };
  const longitudeFilter =
    west <= east
      ? { longitude: { gte: west, lte: east } }
      : { OR: [{ longitude: { gte: west } }, { longitude: { lte: east } }] };

  const boundsFilter: Prisma.SearchIndexItemWhereInput = {
    addressRef: {
      is: {
        ...latitudeFilter,
        ...longitudeFilter,
      },
    },
  };

  if (Array.isArray(where.AND)) {
    where.AND.push(boundsFilter);
  } else if (where.AND) {
    where.AND = [where.AND, boundsFilter];
  } else {
    where.AND = [boundsFilter];
  }
}

function applyCategoryFilter(where: Prisma.SearchIndexItemWhereInput, categoriesParam: string | null) {
  const categoryFilters = (categoriesParam || "")
    .split(",")
    .map((c) => c.trim().toUpperCase())
    .filter(Boolean);
  if (categoryFilters.length === 0) return;
  const hasPadel = categoryFilters.includes("PADEL");
  const hasGeneral = categoryFilters.includes("GERAL") || categoryFilters.includes("EVENTOS") || categoryFilters.includes("OTHER");
  const andFilters: Prisma.SearchIndexItemWhereInput[] = [];
  if (hasPadel && !hasGeneral) {
    andFilters.push({ templateType: EventTemplateType.PADEL });
  } else if (!hasPadel && hasGeneral) {
    andFilters.push({ OR: [{ templateType: { not: EventTemplateType.PADEL } }, { templateType: null }] });
  }
  if (andFilters.length > 0) {
    where.AND = Array.isArray(where.AND) ? [...where.AND, ...andFilters] : andFilters;
  }
}

function buildWhere(params: RankedEventsParams): Prisma.SearchIndexItemWhereInput {
  const q = params.q?.trim() || null;
  const city = params.city?.trim() || null;
  const where: Prisma.SearchIndexItemWhereInput = {
    visibility: SearchIndexVisibility.PUBLIC,
    sourceType: SourceType.EVENT,
  };

  if (q) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
      { addressRef: { formattedAddress: { contains: q, mode: "insensitive" } } },
    ];
  }

  if (city) {
    const cityFilter: Prisma.SearchIndexItemWhereInput = {
      addressRef: { formattedAddress: { contains: city, mode: "insensitive" } },
    };
    if (Array.isArray(where.AND)) {
      where.AND.push(cityFilter);
    } else if (where.AND) {
      where.AND = [where.AND, cityFilter];
    } else {
      where.AND = [cityFilter];
    }
  }

  applyBoundsFilter(where, {
    north: params.north ?? null,
    south: params.south ?? null,
    east: params.east ?? null,
    west: params.west ?? null,
  });
  applyCategoryFilter(where, params.categories ?? null);
  applyTemplateTypeFilter(where, params.templateTypes ?? null);
  const rangeApplied = applyDateRangeFilter(where, params.startDate ?? null, params.endDate ?? null);
  if (!rangeApplied) {
    applyDateFilter(where, params.date ?? null, params.day ?? null);
  }
  return where;
}

type RankedEventCard = PublicEventCardWithPrice & { organizationId?: number };

function filterByPrice(items: RankedEventCard[], priceMin: number | null, priceMax: number | null) {
  const priceMinCents = priceMin !== null ? Math.round(priceMin * 100) : null;
  const priceMaxCents = priceMax !== null ? Math.round(priceMax * 100) : null;
  return items.filter((item) => {
    const priceFrom = item._priceFromCents;
    if (priceMinCents !== null && priceMaxCents !== null) {
      return !item.isGratis && priceFrom !== null && priceFrom >= priceMinCents && priceFrom <= priceMaxCents;
    }
    if (priceMinCents !== null) {
      return !item.isGratis && priceFrom !== null && priceFrom >= priceMinCents;
    }
    if (priceMaxCents !== null) {
      return item.isGratis || (priceFrom !== null && priceFrom <= priceMaxCents);
    }
    return true;
  });
}

export async function listRankedEvents(params: RankedEventsParams): Promise<{ items: PublicEventCard[]; nextCursor: string | null }> {
  const cursorId = params.cursor ?? null;
  const take = clampTake(params.limit ?? DEFAULT_PAGE_SIZE);
  const priceMin = parsePrice(params.priceMin ?? null);
  const priceMax = parsePrice(params.priceMax ?? null);
  const sort = params.sort === "startsAt" ? "startsAt" : "rank";

  const query = {
    where: buildWhere(params),
    orderBy: [{ startsAt: "asc" }, { id: "asc" }],
    take: take + 1,
    ...(cursorId ? { skip: 1, cursor: { id: cursorId } } : {}),
  } satisfies Prisma.SearchIndexItemFindManyArgs;

  const items = await prisma.searchIndexItem.findMany({
    ...query,
    include: {
      addressRef: { select: { formattedAddress: true, canonical: true, latitude: true, longitude: true } },
    },
  });

  let nextCursor: string | null = null;
  if (items.length > take) {
    const nextItem = items.pop();
    nextCursor = nextItem?.id ?? null;
  }

  const safeItems = await filterOrphanedEventSearchItems(items);

  const mapped = safeItems
    .map((event) => ({
      event: toPublicEventCardWithPriceFromIndex({
        sourceId: event.sourceId,
        slug: event.slug,
        title: event.title,
        description: event.description ?? null,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        status: event.status,
        templateType: event.templateType ?? null,
        interestTags: event.interestTags ?? [],
        pricingMode: event.pricingMode ?? null,
        isGratis: event.isGratis,
        priceFromCents: event.priceFromCents ?? null,
        coverImageUrl: event.coverImageUrl ?? null,
        hostName: event.hostName ?? null,
        hostUsername: event.hostUsername ?? null,
        addressId: event.addressId ?? null,
        addressRef: event.addressRef ?? null,
      }),
      organizationId: event.organizationId,
    }))
    .filter(({ event }) =>
      isPublicEventCardComplete(event) &&
      event.status !== "PAST" &&
      event.status !== "CANCELLED" &&
      event.status !== "DRAFT",
    );

  const filtered = filterByPrice(
    mapped.map((entry) => ({
      ...entry.event,
      organizationId: entry.organizationId,
    })),
    priceMin,
    priceMax,
  );

  const ranked = await rankEvents(filtered, {
    userId: params.viewerId ?? null,
    favouriteCategories: params.favouriteCategories ?? null,
    lat: params.lat ?? null,
    lng: params.lng ?? null,
  });

  const visible = ranked.filter((item) => !item.hidden);
  const ordered = (sort === "startsAt"
    ? [...visible].sort((a, b) => {
        const aMs = a.event.startsAt ? new Date(a.event.startsAt).getTime() : Number.POSITIVE_INFINITY;
        const bMs = b.event.startsAt ? new Date(b.event.startsAt).getTime() : Number.POSITIVE_INFINITY;
        if (aMs !== bMs) return aMs - bMs;
        return (a.event.id ?? 0) - (b.event.id ?? 0);
      })
    : [...visible].sort((a, b) => b.rank.score - a.rank.score)
  ).map((item) => {
    const { _priceFromCents, organizationId, ...rest } = item.event as RankedEventCard;
    return {
      ...rest,
      rank: item.rank,
    };
  });

  return { items: ordered, nextCursor };
}
