import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { buildCacheKey, getCache, setCache } from "@/lib/geo/cache";
import { getRequestContext } from "@/lib/http/requestContext";
import { logError } from "@/lib/observability/logger";
import { listRankedEvents } from "@/domain/ranking/listRankedEvents";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { EventStatus, Prisma } from "@prisma/client";

const DEFAULT_PAGE_SIZE = 12;
const CACHE_TTL_MS = 30 * 1000;

async function _GET(req: NextRequest) {
  const ctx = getRequestContext(req);
  const { searchParams } = new URL(req.url);
  const cursor = searchParams.get("cursor");
  const limitParam = searchParams.get("limit");
  const category = searchParams.get("category");
  const typeFilter = searchParams.get("type"); // all | free | paid
  const search = searchParams.get("q");
  const dateParam = searchParams.get("date");
  const dayParam = searchParams.get("day");
  const sortParam = searchParams.get("sort");

  const take = limitParam
    ? Math.min(parseInt(limitParam, 10) || DEFAULT_PAGE_SIZE, 50)
    : DEFAULT_PAGE_SIZE;

  type EventListItem = {
    id: number;
    slug: string;
    title: string;
    shortDescription: string | null;
    startDate: string;
    endDate: string;
    venue: {
      addressId: string | null;
      name: string | null;
      city: string | null;
      address: string | null;
      lat: number | null;
      lng: number | null;
      formattedAddress: string | null;
      source: string | null;
      components?: Record<string, unknown> | null;
      overrides?: Record<string, unknown> | null;
    };
    coverImageUrl: string | null;
    isGratis: boolean;
    priceFrom: number | null;
    category: string | null;
    tags: string[];
    stats: {
      goingCount: number;
      interestedCount: number;
    };
    wavesSummary: {
      totalWaves: number;
      onSaleCount: number;
      soldOutCount: number;
      nextWaveOpensAt: string | null;
    };
    interestTags?: string[];
    rank?: {
      score: number;
      reasons: Array<{ code: string; label?: string; weight?: number }>;
    };
  };

  let items: EventListItem[] = [];
  let nextCursor: string | null = null;
  let shouldCache = false;
  let viewerId: string | null = null;
  let favouriteCategories: string[] | null = null;

  const applyFallbackDateFilter = (where: Prisma.EventWhereInput) => {
    if (!dateParam) return;
    if (dateParam === "agora") {
      const now = new Date();
      where.OR = [
        { startsAt: { gte: now } },
        { AND: [{ startsAt: { lte: now } }, { endsAt: { gte: now } }] },
      ];
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
      where.startsAt = { gte: new Date() };
      return;
    }
    if (dateParam === "weekend") {
      const now = new Date();
      const weekday = now.getDay();
      let start = new Date(now);
      let end = new Date(now);
      if (weekday === 0) {
        start = now;
        end.setHours(23, 59, 59, 999);
      } else {
        const daysToSaturday = (6 - weekday + 7) % 7;
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
  };

  try {
    try {
      const supabase = await createSupabaseServer();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      viewerId = user?.id ?? null;
      if (viewerId) {
        const profile = await prisma.profile.findUnique({
          where: { id: viewerId },
          select: { favouriteCategories: true },
        });
        favouriteCategories = profile?.favouriteCategories ?? null;
      }
    } catch {
      viewerId = null;
      favouriteCategories = null;
    }

    const cacheKey = buildCacheKey([
      "eventos",
      category ?? "",
      typeFilter ?? "",
      search ?? "",
      dateParam ?? "",
      dayParam ?? "",
      sortParam ?? "",
      cursor ?? "",
      take,
      viewerId ?? "anon",
    ]);
    const cached = getCache<{ events: EventListItem[]; pagination: { nextCursor: string | null; hasMore: boolean } }>(
      cacheKey,
    );
    if (cached) {
      return jsonWrap(cached, { status: 200 });
    }

    const ranked = await listRankedEvents({
      q: search ?? undefined,
      categories: category ?? undefined,
      type: typeFilter ?? undefined,
      date: dateParam ?? undefined,
      day: dayParam ?? undefined,
      sort: sortParam ?? undefined,
      cursor: cursor ?? undefined,
      limit: take,
      viewerId,
      favouriteCategories,
    });

    nextCursor = ranked.nextCursor ?? null;

    let mapped = ranked.items.map((e) => {
      const priceFrom = typeof e.priceFrom === "number" ? e.priceFrom : null;
      const isGratis = Boolean(e.isGratis);
      const city = e.location?.city ?? null;

      return {
        id: e.id,
        slug: e.slug,
        title: e.title,
        shortDescription: e.shortDescription ?? null,
        startDate: e.startsAt ?? "",
        endDate: e.endsAt ?? "",
        venue: {
          addressId: e.location?.addressId ?? null,
          name: null,
          city: city ?? null,
          address: e.location?.formattedAddress ?? null,
          lat: e.location?.lat ?? null,
          lng: e.location?.lng ?? null,
          formattedAddress: e.location?.formattedAddress ?? null,
          source: null,
          components: null,
          overrides: null,
        },
        coverImageUrl: e.coverImageUrl ?? null,
        isGratis,
        priceFrom,
        category: e.templateType ?? null,
        tags: [],
        stats: {
          goingCount: e.ticketTypes?.reduce((sum, t) => sum + (t.soldQuantity ?? 0), 0) ?? 0,
          interestedCount: 0,
        },
        wavesSummary: {
          totalWaves: e.ticketTypes?.length ?? 0,
          onSaleCount: e.ticketTypes?.filter((t) => t.status === "ON_SALE").length ?? 0,
          soldOutCount: e.ticketTypes?.filter((t) => t.status === "SOLD_OUT").length ?? 0,
          nextWaveOpensAt: null,
        },
        interestTags: e.interestTags ?? [],
        rank: e.rank ?? undefined,
      };
    });

    if (typeFilter === "free") {
      mapped = mapped.filter((item) => item.isGratis);
    } else if (typeFilter === "paid") {
      mapped = mapped.filter((item) => !item.isGratis);
    }

    items = mapped;

    if (items.length === 0) {
      const fallbackStatuses =
        process.env.NODE_ENV === "production"
          ? [EventStatus.PUBLISHED, EventStatus.DATE_CHANGED, EventStatus.FINISHED]
          : [EventStatus.PUBLISHED, EventStatus.DATE_CHANGED, EventStatus.FINISHED, EventStatus.DRAFT];

      const fallbackEvents = await prisma.event.findMany({
        where: (() => {
          const now = new Date();
          const where: Prisma.EventWhereInput = {
            isDeleted: false,
            deletedAt: null,
            status: { in: fallbackStatuses },
            endsAt: { gte: now },
          };
          applyFallbackDateFilter(where);
          return where;
        })(),
        orderBy: { startsAt: "asc" },
        take,
        include: {
          addressRef: {
            select: {
              formattedAddress: true,
              canonical: true,
              latitude: true,
              longitude: true,
            },
          },
          ticketTypes: {
            select: {
              id: true,
              name: true,
              description: true,
              price: true,
              currency: true,
              status: true,
              startsAt: true,
              endsAt: true,
              totalQuantity: true,
              soldQuantity: true,
              sortOrder: true,
              padelEventCategoryLink: {
                select: { category: { select: { label: true } } },
              },
            },
          },
        },
      });

      const fallbackMapped: EventListItem[] = fallbackEvents.map((event) => {
        const ticketPrices = event.ticketTypes.map((ticket) => ticket.price);
        const priceFromCents =
          ticketPrices.length > 0 ? Math.min(...ticketPrices) : null;
        const priceFrom =
          typeof priceFromCents === "number"
            ? Math.max(0, priceFromCents) / 100
            : null;
        const hasPaid = ticketPrices.some((price) => price > 0);
        const hasFree = ticketPrices.some((price) => price === 0);
        const isGratis = hasFree && !hasPaid;

        const formattedAddress = event.addressRef?.formattedAddress ?? null;

        return {
          id: event.id,
          slug: event.slug,
          title: event.title,
          shortDescription: event.description?.slice(0, 200) ?? null,
          startDate: event.startsAt ? event.startsAt.toISOString() : "",
          endDate: event.endsAt ? event.endsAt.toISOString() : "",
          venue: {
            addressId: event.addressId ?? null,
            name: null,
            city: null,
            address: formattedAddress,
            lat: event.addressRef?.latitude ?? null,
            lng: event.addressRef?.longitude ?? null,
            formattedAddress,
            source: null,
            components: null,
            overrides: null,
          },
          coverImageUrl: event.coverImageUrl ?? null,
          isGratis,
          priceFrom,
          category: event.templateType ?? null,
          tags: [],
          stats: {
            goingCount: event.ticketTypes.reduce((sum, ticket) => sum + (ticket.soldQuantity ?? 0), 0),
            interestedCount: 0,
          },
          wavesSummary: {
            totalWaves: event.ticketTypes.length,
            onSaleCount: event.ticketTypes.filter((t) => t.status === "ON_SALE").length,
            soldOutCount: event.ticketTypes.filter((t) => t.status === "SOLD_OUT").length,
            nextWaveOpensAt: null,
          },
          interestTags: event.interestTags ?? [],
        };
      });

      items = fallbackMapped;
    }

    shouldCache = true;
  } catch (error) {
    logError("api.eventos.list", error, {
      requestId: ctx.requestId,
      correlationId: ctx.correlationId,
      orgId: ctx.orgId,
      params: {
        cursor,
        limit: take,
        category: category ?? null,
        type: typeFilter ?? null,
        q: search ?? null,
        date: dateParam ?? null,
        day: dayParam ?? null,
        sort: sortParam ?? null,
      },
    });
    items = [];
    nextCursor = null;
  }

  const payload = {
    events: items,
    pagination: {
      nextCursor,
      hasMore: nextCursor !== null,
    },
  };

  if (shouldCache) {
    const cacheKey = buildCacheKey([
      "eventos",
      category ?? "",
      typeFilter ?? "",
      search ?? "",
      dateParam ?? "",
      dayParam ?? "",
      sortParam ?? "",
      cursor ?? "",
      take,
      viewerId ?? "anon",
    ]);
    setCache(cacheKey, payload, CACHE_TTL_MS);
  }

  return jsonWrap(payload);
}
export const GET = withApiEnvelope(_GET);
