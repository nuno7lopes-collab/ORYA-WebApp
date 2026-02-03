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
  date?: string | null;
  day?: string | null;
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
      { locationName: { contains: q, mode: "insensitive" } },
      { locationCity: { contains: q, mode: "insensitive" } },
      { locationFormattedAddress: { contains: q, mode: "insensitive" } },
      { address: { contains: q, mode: "insensitive" } },
    ];
  }

  if (city && city.toLowerCase() !== "portugal") {
    where.locationCity = { contains: city, mode: "insensitive" };
  }

  applyCategoryFilter(where, params.categories ?? null);
  applyDateFilter(where, params.date ?? null, params.day ?? null);
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
    | "locationName"
    | "locationCity"
    | "address"
    | "latitude"
    | "longitude"
    | "locationFormattedAddress"
    | "locationSource"
  >,
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
    locationName: event.locationName ?? null,
    locationCity: event.locationCity ?? null,
    address: event.address ?? null,
    latitude: event.latitude ?? null,
    longitude: event.longitude ?? null,
    locationFormattedAddress: event.locationFormattedAddress ?? null,
    locationSource: event.locationSource ?? null,
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

  const items = await prisma.searchIndexItem.findMany(query);

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

  const computed: PublicEventCardWithPrice[] = items.map(mapSearchItemToPublicEventCardWithPrice);

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
  });

  if (!item) {
    return null;
  }

  const { _priceFromCents, ...event } = mapSearchItemToPublicEventCardWithPrice(item);
  return event;
}
