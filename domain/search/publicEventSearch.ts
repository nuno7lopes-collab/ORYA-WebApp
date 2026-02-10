import { prisma } from "@/lib/prisma";
import { Prisma, SearchIndexVisibility, SourceType } from "@prisma/client";
import { toPublicEventCardFromIndex, PublicEventCard, isPublicEventCardComplete } from "@/domain/events/publicEventCard";
import { filterOrphanedEventSearchItems } from "@/domain/searchIndex/guard";

const DEFAULT_PAGE_SIZE = 12;

function clampTake(value: number | null): number {
  if (!value || Number.isNaN(value)) return DEFAULT_PAGE_SIZE;
  return Math.min(Math.max(value, 1), 50);
}

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export type PublicSearchParams = {
  q?: string | null;
  categories?: string | null;
  date?: string | null;
  day?: string | null;
  type?: string | null;
  priceMin?: string | null;
  priceMax?: string | null;
  cursor?: string | null;
  limit?: number | null;
  from?: string | null;
  to?: string | null;
};

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

function applyCategoryFilter(where: Prisma.SearchIndexItemWhereInput, categoriesParam: string | null) {
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
    andFilters.push({ templateType: "PADEL" });
  } else if (!hasPadel && hasGeneral) {
    andFilters.push({
      OR: [{ templateType: { not: "PADEL" } }, { templateType: null }],
    });
  }

  if (andFilters.length > 0) {
    where.AND = Array.isArray(where.AND) ? [...where.AND, ...andFilters] : andFilters;
  }
}

export async function searchPublicEvents(
  params: PublicSearchParams,
): Promise<{ items: PublicEventCard[]; nextCursor: string | null }> {
  const q = params.q?.trim() || null;
  const cursorId = params.cursor ?? null;
  const take = clampTake(params.limit ?? DEFAULT_PAGE_SIZE);
  const fromDate = parseDate(params.from ?? null);
  const toDate = parseDate(params.to ?? null);
  const priceMin = parsePrice(params.priceMin ?? null);
  const priceMax = parsePrice(params.priceMax ?? null);
  const priceMinCents = priceMin !== null ? Math.round(priceMin * 100) : null;
  const priceMaxCents = priceMax !== null ? Math.round(priceMax * 100) : null;

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

  if (params.date || params.day) {
    applyDateFilter(where, params.date ?? null, params.day ?? null);
  } else if (fromDate || toDate) {
    where.startsAt = {
      ...(fromDate ? { gte: fromDate } : {}),
      ...(toDate ? { lte: toDate } : {}),
    };
  }

  applyCategoryFilter(where, params.categories ?? null);

  const query = {
    where,
    orderBy: [{ startsAt: "asc" }, { id: "asc" }],
    take: take + 1,
    ...(cursorId ? { skip: 1, cursor: { id: cursorId } } : {}),
  } satisfies Prisma.SearchIndexItemFindManyArgs;

  const events = await prisma.searchIndexItem.findMany({
    ...query,
    include: {
      addressRef: {
        select: { formattedAddress: true, canonical: true, latitude: true, longitude: true },
      },
    },
  });

  let nextCursor: string | null = null;
  if (events.length > take) {
    const nextItem = events.pop();
    nextCursor = nextItem?.id ?? null;
  }

  const safeEvents = await filterOrphanedEventSearchItems(events);

  const filtered = safeEvents.filter((item) => {
    const priceFrom = item.priceFromCents;
    if (priceMinCents !== null && priceMaxCents !== null) {
      return (
        !item.isGratis &&
        priceFrom !== null &&
        priceFrom >= priceMinCents &&
        priceFrom <= priceMaxCents
      );
    }
    if (priceMinCents !== null) {
      return !item.isGratis && priceFrom !== null && priceFrom >= priceMinCents;
    }
    if (priceMaxCents !== null) {
      return item.isGratis || (priceFrom !== null && priceFrom <= priceMaxCents);
    }
    return true;
  });

  const items = filtered
    .map((event) =>
      toPublicEventCardFromIndex({
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
      addressRef: event.addressRef ?? null,
    }),
  )
    .filter((event) => isPublicEventCardComplete(event));

  return { items, nextCursor };
}
