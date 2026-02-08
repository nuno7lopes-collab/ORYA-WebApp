import { prisma } from "@/lib/prisma";
import { EventTemplateType, Prisma, SearchIndexVisibility, SearchIndexItem } from "@prisma/client";
import {
  toPublicEventCardWithPriceFromIndex,
  PublicEventCard,
  PublicEventCardWithPrice,
} from "@/domain/events/publicEventCard";

const DEFAULT_PAGE_SIZE = 12;

type DiscoverParams = {
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
};

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

function applyDateFilter(
  where: Prisma.SearchIndexItemWhereInput,
  dateParam: string | null,
  dayParam: string | null,
) {
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

function applyDateRangeFilter(
  where: Prisma.SearchIndexItemWhereInput,
  startDateParam: string | null,
  endDateParam: string | null,
): boolean {
  if (!startDateParam && !endDateParam) return false;
  const start = startDateParam ? new Date(startDateParam) : null;
  const end = endDateParam ? new Date(endDateParam) : null;
  if (start && !Number.isNaN(start.getTime())) {
    start.setHours(0, 0, 0, 0);
  }
  if (end && !Number.isNaN(end.getTime())) {
    end.setHours(23, 59, 59, 999);
  }
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

function applyTemplateTypeFilter(
  where: Prisma.SearchIndexItemWhereInput,
  templateTypesParam: string | null,
) {
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

function applyBoundsFilter(
  where: Prisma.SearchIndexItemWhereInput,
  bounds: {
    north?: number | null;
    south?: number | null;
    east?: number | null;
    west?: number | null;
  },
) {
  if (
    bounds.north == null ||
    bounds.south == null ||
    bounds.east == null ||
    bounds.west == null
  ) {
    return;
  }

  let north = bounds.north;
  let south = bounds.south;
  let east = bounds.east;
  let west = bounds.west;

  if (![north, south, east, west].every((value) => Number.isFinite(value))) return;

  if (north < south) {
    [north, south] = [south, north];
  }

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
      : {
          OR: [{ longitude: { gte: west } }, { longitude: { lte: east } }],
        };

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

function applyCategoryFilter(
  where: Prisma.SearchIndexItemWhereInput,
  categoriesParam: string | null,
) {
  const categoryFilters = (categoriesParam || "")
    .split(",")
    .map((c) => c.trim().toUpperCase())
    .filter(Boolean);

  if (categoryFilters.length === 0) return;

  const hasPadel = categoryFilters.includes("PADEL");
  const hasGeneral =
    categoryFilters.includes("GERAL") ||
    categoryFilters.includes("EVENTOS") ||
    categoryFilters.includes("OTHER");

  const andFilters: Prisma.SearchIndexItemWhereInput[] = [];

  if (hasPadel && !hasGeneral) {
    andFilters.push({ templateType: EventTemplateType.PADEL });
  } else if (!hasPadel && hasGeneral) {
    andFilters.push({
      OR: [
        { templateType: { not: EventTemplateType.PADEL } },
        { templateType: null },
      ],
    });
  }

  if (andFilters.length > 0) {
    where.AND = Array.isArray(where.AND) ? [...where.AND, ...andFilters] : andFilters;
  }
}

function buildDiscoverWhere(params: DiscoverParams): Prisma.SearchIndexItemWhereInput {
  const q = params.q?.trim() || null;
  const city = params.city?.trim() || null;

  const where: Prisma.SearchIndexItemWhereInput = {
    visibility: SearchIndexVisibility.PUBLIC,
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

function filterDiscoverByPrice(
  items: PublicEventCardWithPrice[],
  priceMinCents: number | null,
  priceMaxCents: number | null,
) {
  return items.filter((item) => {
    if (priceMinCents !== null && priceMaxCents !== null) {
      return (
        !item.isGratis &&
        item._priceFromCents !== null &&
        item._priceFromCents >= priceMinCents &&
        item._priceFromCents <= priceMaxCents
      );
    }
    if (priceMinCents !== null) {
      return (
        !item.isGratis &&
        item._priceFromCents !== null &&
        item._priceFromCents >= priceMinCents
      );
    }
    if (priceMaxCents !== null) {
      return (
        item.isGratis ||
        (item._priceFromCents !== null && item._priceFromCents <= priceMaxCents)
      );
    }
    return true;
  });
}

function mapSearchItemToPublicEventCardWithPrice(
  event: Pick<
    SearchIndexItem,
    | "sourceId"
    | "slug"
    | "title"
    | "description"
    | "startsAt"
    | "endsAt"
    | "status"
    | "templateType"
    | "pricingMode"
    | "isGratis"
    | "priceFromCents"
    | "coverImageUrl"
    | "hostName"
    | "hostUsername"
    | "addressId"
  >,
  addressRef?: SearchIndexItem["addressRef"] | null,
): PublicEventCardWithPrice {
  return toPublicEventCardWithPriceFromIndex({
    sourceId: event.sourceId,
    slug: event.slug,
    title: event.title,
    description: event.description ?? null,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    status: event.status,
    templateType: event.templateType ?? null,
    pricingMode: event.pricingMode ?? null,
    isGratis: event.isGratis,
    priceFromCents: event.priceFromCents ?? null,
    coverImageUrl: event.coverImageUrl ?? null,
    hostName: event.hostName ?? null,
    hostUsername: event.hostUsername ?? null,
    addressId: event.addressId ?? null,
    addressRef: addressRef ?? null,
  });
}

export async function listPublicDiscoverIndex(
  params: DiscoverParams,
): Promise<{ items: SearchIndexItem[]; nextCursor: string | null }> {
  const cursorId = params.cursor ?? null;
  const take = clampTake(params.limit ?? DEFAULT_PAGE_SIZE);

  const query = {
    where: buildDiscoverWhere(params),
    orderBy: [{ startsAt: "asc" }, { id: "asc" }],
    take: take + 1,
    ...(cursorId ? { skip: 1, cursor: { id: cursorId } } : {}),
  } satisfies Prisma.SearchIndexItemFindManyArgs;

  const items = await prisma.searchIndexItem.findMany({
    ...query,
    include: {
      addressRef: {
        select: { formattedAddress: true, canonical: true, latitude: true, longitude: true },
      },
    },
  });

  let nextCursor: string | null = null;
  if (items.length > take) {
    const nextItem = items.pop();
    nextCursor = nextItem?.id ?? null;
  }

  return { items, nextCursor };
}

export async function listPublicDiscover(
  params: DiscoverParams,
): Promise<{ items: PublicEventCard[]; nextCursor: string | null }> {
  const priceMin = parsePrice(params.priceMin ?? null);
  const priceMax = parsePrice(params.priceMax ?? null);
  const priceMinCents = priceMin !== null ? Math.round(priceMin * 100) : null;
  const priceMaxCents = priceMax !== null ? Math.round(priceMax * 100) : null;

  const { items, nextCursor } = await listPublicDiscoverIndex(params);

  const computed: PublicEventCardWithPrice[] = items.map((item) =>
    mapSearchItemToPublicEventCardWithPrice(item, item.addressRef),
  );

  const filtered = filterDiscoverByPrice(computed, priceMinCents, priceMaxCents);
  const publicItems: PublicEventCard[] = filtered.map(({ _priceFromCents, ...rest }) => rest);

  return { items: publicItems, nextCursor };
}

export async function getPublicDiscoverBySlug(slug: string): Promise<PublicEventCard | null> {
  const item = await prisma.searchIndexItem.findFirst({
    where: {
      visibility: SearchIndexVisibility.PUBLIC,
      slug,
    },
    include: {
      addressRef: {
        select: { formattedAddress: true, canonical: true, latitude: true, longitude: true },
      },
    },
  });

  if (!item) {
    return null;
  }

  const { _priceFromCents, ...event } = mapSearchItemToPublicEventCardWithPrice(item, item.addressRef);
  return event;
}
