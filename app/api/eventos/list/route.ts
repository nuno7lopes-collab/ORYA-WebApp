import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { deriveIsFreeEvent } from "@/domain/events/derivedIsFree";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { buildCacheKey, getCache, setCache } from "@/lib/geo/cache";

const DEFAULT_PAGE_SIZE = 12;
const CACHE_TTL_MS = 30 * 1000;

async function _GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const cursor = searchParams.get("cursor");
  const limitParam = searchParams.get("limit");
  const category = searchParams.get("category");
  const typeFilter = searchParams.get("type"); // all | free | paid
  const search = searchParams.get("q");

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
      name: string | null;
      address: string | null;
      city: string | null;
      lat: number | null;
      lng: number | null;
      formattedAddress: string | null;
      source: string | null;
      components: Record<string, unknown> | null;
      overrides: Record<string, unknown> | null;
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
  };

  let items: EventListItem[] = [];
  let nextCursor: number | null = null;
  let shouldCache = false;

  try {
    const cacheKey = buildCacheKey([
      "eventos",
      category ?? "",
      typeFilter ?? "",
      search ?? "",
      cursor ?? "",
      take,
    ]);
    const cached = getCache<{ events: EventListItem[]; pagination: { nextCursor: number | null; hasMore: boolean } }>(
      cacheKey,
    );
    if (cached) {
      return jsonWrap(cached, { status: 200 });
    }

    const filters: Prisma.EventWhereInput[] = [
      { status: { in: ["PUBLISHED", "DATE_CHANGED"] } },
      { isDeleted: false },
      { organizationId: { not: null } },
      { organization: { status: "ACTIVE" } },
    ];

    if (category && category !== "all") {
      const normalized = category.toUpperCase();
      if (normalized === "PADEL" || normalized === "DESPORTO") {
        filters.push({ templateType: "PADEL" });
      } else {
        filters.push({
          OR: [{ templateType: { not: "PADEL" } }, { templateType: null }],
        });
      }
    }

    if (search && search.trim().length > 0) {
      const q = search.trim();
      filters.push({
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
          { locationName: { contains: q, mode: "insensitive" } },
          { locationCity: { contains: q, mode: "insensitive" } },
          { locationFormattedAddress: { contains: q, mode: "insensitive" } },
        ],
      });
    }

    const cursorId = cursor ? Number(cursor) : null;
    if (cursor && Number.isNaN(cursorId)) {
      return jsonWrap(
        { items: [], pagination: { nextCursor: null, hasMore: false } },
        { status: 400 },
      );
    }

    const events = await prisma.event.findMany({
      where: { AND: filters },
      orderBy: { startsAt: "asc" },
      take: take + 1, // +1 para sabermos se há mais páginas
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        startsAt: true,
        endsAt: true,
        locationName: true,
        locationCity: true,
        locationFormattedAddress: true,
        locationSource: true,
        locationComponents: true,
        locationOverrides: true,
        latitude: true,
        longitude: true,
        coverImageUrl: true,
        templateType: true,
        ticketTypes: {
          select: {
            price: true,
            totalQuantity: true,
            soldQuantity: true,
            startsAt: true,
            endsAt: true,
            status: true,
          },
        },
      },
      ...(cursorId
        ? {
            skip: 1,
            cursor: { id: cursorId },
          }
        : {}),
    });

    if (events.length > take) {
      const next = events.pop();
      nextCursor = next?.id ?? null;
    }

    let mapped = events.map((e) => {
      const priceFrom =
        e.ticketTypes && e.ticketTypes.length > 0
          ? Math.min(...e.ticketTypes.map((t) => t.price ?? 0)) / 100
          : null;
      const isGratis = deriveIsFreeEvent({ ticketPrices: e.ticketTypes?.map((t) => t.price ?? 0) ?? [] });

      const onSaleCount = e.ticketTypes?.filter((t) => t.status === "ON_SALE").length ?? 0;
      const soldOutCount = e.ticketTypes?.filter((t) => t.status === "SOLD_OUT").length ?? 0;

      return {
        id: e.id,
        slug: e.slug,
        title: e.title,
        shortDescription: e.description?.slice(0, 160) ?? null,
        startDate: e.startsAt ? new Date(e.startsAt).toISOString() : "",
        endDate: e.endsAt ? new Date(e.endsAt).toISOString() : "",
        venue: {
          name: e.locationName ?? null,
          address: e.locationFormattedAddress ?? null,
          city: e.locationCity ?? null,
          lat: e.latitude ?? null,
          lng: e.longitude ?? null,
          formattedAddress: e.locationFormattedAddress ?? null,
          source: e.locationSource ?? null,
          components:
            e.locationComponents && typeof e.locationComponents === "object"
              ? (e.locationComponents as Record<string, unknown>)
              : null,
          overrides:
            e.locationOverrides && typeof e.locationOverrides === "object"
              ? (e.locationOverrides as Record<string, unknown>)
              : null,
        },
        coverImageUrl: e.coverImageUrl ?? null,
        isGratis,
        priceFrom,
        category: e.templateType ?? null,
        tags: [],
        stats: {
          goingCount: e.ticketTypes?.reduce((sum, t) => sum + t.soldQuantity, 0) ?? 0,
          interestedCount: 0,
        },
        wavesSummary: {
          totalWaves: e.ticketTypes?.length ?? 0,
          onSaleCount,
          soldOutCount,
          nextWaveOpensAt: null,
        },
      };
    });

    if (typeFilter === "free") {
      mapped = mapped.filter((item) => item.isGratis);
    } else if (typeFilter === "paid") {
      mapped = mapped.filter((item) => !item.isGratis);
    }

    items = mapped;
    shouldCache = true;
  } catch (error) {
    console.error("[api/eventos/list] Erro ao carregar eventos, fallback para lista vazia:", error);
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
      cursor ?? "",
      take,
    ]);
    setCache(cacheKey, payload, CACHE_TTL_MS);
  }

  return jsonWrap(payload);
}
export const GET = withApiEnvelope(_GET);
