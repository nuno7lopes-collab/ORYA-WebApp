import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { listRankedEvents } from "@/domain/ranking/listRankedEvents";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { buildCacheKey, getCache, setCache } from "@/lib/geo/cache";
import { getRequestContext } from "@/lib/http/requestContext";
import { logError, logInfo } from "@/lib/observability/logger";
import { EventTemplateType, Prisma } from "@prisma/client";
import {
  isPublicEventCardComplete,
  PublicEventCard,
  PublicEventCardWithPrice,
  toPublicEventCardWithPrice,
} from "@/domain/events/publicEventCard";
import { PUBLIC_EVENT_DISCOVER_STATUSES } from "@/domain/events/publicStatus";

import { getUserWithPolicy } from "@/lib/auth/getUserWithPolicy";
const DEFAULT_PAGE_SIZE = 12;
const CACHE_TTL_MS = 30 * 1000;
const MAP_MODE_LIMIT = 50;

type ExploreItem = PublicEventCard;

type ExploreResponse = {
  items: ExploreItem[];
  pagination: {
    nextCursor: string | null;
    hasMore: boolean;
  };
};
function clampTake(value: number | null): number {
  if (!value || Number.isNaN(value)) return DEFAULT_PAGE_SIZE;
  return Math.min(Math.max(value, 1), 50);
}

function quantizeCoord(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.round(value * 1000) / 1000;
}

function parseCoord(value: string | null) {
  if (!value) return null;
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toRad(value: number) {
  return (value * Math.PI) / 180;
}

function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const earthRadius = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
  return 2 * earthRadius * Math.asin(Math.min(1, Math.sqrt(h)));
}

function parseTemplateTypes(templateTypesParam: string | null): EventTemplateType[] {
  const raw = (templateTypesParam || "")
    .split(",")
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean);
  if (raw.length === 0) return [];
  const allowed = new Set(Object.values(EventTemplateType));
  return raw.filter((item): item is EventTemplateType => allowed.has(item as EventTemplateType));
}

function parseCategorySelection(categoriesParam: string | null) {
  const categoryFilters = (categoriesParam || "")
    .split(",")
    .map((c) => c.trim().toUpperCase())
    .filter(Boolean);
  if (categoryFilters.length === 0) return null;
  const hasPadel = categoryFilters.includes("PADEL");
  const hasGeneral =
    categoryFilters.includes("GERAL") ||
    categoryFilters.includes("EVENTOS") ||
    categoryFilters.includes("OTHER");
  return { hasPadel, hasGeneral };
}

function pushEventAndFilter(where: Prisma.EventWhereInput, filter: Prisma.EventWhereInput) {
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

function applyEventDateFilter(where: Prisma.EventWhereInput, dateParam: string | null, dayParam: string | null) {
  if (dateParam === "agora") {
    const now = new Date();
    pushEventAndFilter(where, {
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
    where.startsAt = { gte: new Date() };
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

function applyEventDateRangeFilter(where: Prisma.EventWhereInput, startDateParam: string | null, endDateParam: string | null): boolean {
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

function applyEventBoundsFilter(where: Prisma.EventWhereInput, bounds: { north?: number | null; south?: number | null; east?: number | null; west?: number | null }) {
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

  const addressFilter: Prisma.AddressWhereInput = {
    latitude: { gte: south, lte: north },
  };
  if (west <= east) {
    addressFilter.longitude = { gte: west, lte: east };
  } else {
    addressFilter.OR = [{ longitude: { gte: west } }, { longitude: { lte: east } }];
  }

  pushEventAndFilter(where, { addressRef: addressFilter });
}

function buildMapEventWhere(params: {
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
}) {
  const q = params.q?.trim() || null;
  const city = params.city?.trim() || null;
  const where: Prisma.EventWhereInput = {
    status: { in: PUBLIC_EVENT_DISCOVER_STATUSES },
    isDeleted: false,
    organizationId: { not: null },
    organization: { status: "ACTIVE" },
  };

  if (q) {
    pushEventAndFilter(where, {
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { addressRef: { formattedAddress: { contains: q, mode: "insensitive" } } },
      ],
    });
  }

  if (city) {
    pushEventAndFilter(where, {
      addressRef: { formattedAddress: { contains: city, mode: "insensitive" } },
    });
  }

  applyEventBoundsFilter(where, {
    north: params.north ?? null,
    south: params.south ?? null,
    east: params.east ?? null,
    west: params.west ?? null,
  });

  const categorySelection = parseCategorySelection(params.categories ?? null);
  if (categorySelection) {
    if (categorySelection.hasPadel && !categorySelection.hasGeneral) {
      pushEventAndFilter(where, { templateType: EventTemplateType.PADEL });
    } else if (!categorySelection.hasPadel && categorySelection.hasGeneral) {
      pushEventAndFilter(where, {
        OR: [{ templateType: { not: EventTemplateType.PADEL } }, { templateType: null }],
      });
    }
  }

  const templateTypes = parseTemplateTypes(params.templateTypes ?? null);
  if (templateTypes.length > 0) {
    pushEventAndFilter(where, {
      templateType: { in: templateTypes },
    });
  }

  const rangeApplied = applyEventDateRangeFilter(where, params.startDate ?? null, params.endDate ?? null);
  if (!rangeApplied) {
    applyEventDateFilter(where, params.date ?? null, params.day ?? null);
  }

  return where;
}

function filterByPrice(items: PublicEventCardWithPrice[], priceMin: number | null, priceMax: number | null) {
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

async function listMapEvents(params: {
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
  limit: number;
  priceMin: number | null;
  priceMax: number | null;
  centerLat: number | null;
  centerLng: number | null;
}) {
  const expandedTake = Math.min(Math.max(params.limit * 3, params.limit), 150);
  const events = await prisma.event.findMany({
    where: buildMapEventWhere(params),
    orderBy: [{ startsAt: "asc" }, { id: "asc" }],
    take: expandedTake,
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      startsAt: true,
      endsAt: true,
      status: true,
      templateType: true,
      interestTags: true,
      ownerUserId: true,
      organization: {
        select: {
          publicName: true,
          businessName: true,
          username: true,
          brandingAvatarUrl: true,
        },
      },
      addressId: true,
      addressRef: {
        select: { formattedAddress: true, canonical: true, latitude: true, longitude: true },
      },
      pricingMode: true,
      coverImageUrl: true,
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
          padelEventCategoryLinkId: true,
          padelEventCategoryLink: {
            select: {
              category: {
                select: { label: true },
              },
            },
          },
        },
      },
    },
  });

  const mapped = events
    .map((event) =>
      toPublicEventCardWithPrice({
        event: {
          ...event,
          description: event.description ?? null,
          templateType: event.templateType ?? null,
          addressId: event.addressId ?? null,
          pricingMode: event.pricingMode ?? null,
          coverImageUrl: event.coverImageUrl ?? null,
          addressRef: event.addressRef ?? null,
          ticketTypes: event.ticketTypes ?? [],
          interestTags: event.interestTags ?? [],
        },
      }),
    )
    .filter((event) => isPublicEventCardComplete(event));

  const priceFiltered = filterByPrice(mapped, params.priceMin, params.priceMax);

  const withDistance = priceFiltered.map((event) => {
    const lat = event.location.lat;
    const lng = event.location.lng;
    if (
      params.centerLat == null ||
      params.centerLng == null ||
      lat == null ||
      lng == null
    ) {
      return { event, dist: Number.POSITIVE_INFINITY };
    }
    return {
      event,
      dist: distanceKm(
        { lat, lng },
        { lat: params.centerLat, lng: params.centerLng },
      ),
    };
  });

  const ordered = withDistance
    .sort((a, b) => {
      if (a.dist !== b.dist) return a.dist - b.dist;
      const aMs = new Date(a.event.startsAt).getTime();
      const bMs = new Date(b.event.startsAt).getTime();
      if (aMs !== bMs) return aMs - bMs;
      return a.event.id - b.event.id;
    })
    .slice(0, params.limit)
    .map(({ event }) => {
      const { _priceFromCents, ...rest } = event;
      return rest;
    });

  return ordered;
}

const shouldExposeDetails = () => process.env.NODE_ENV !== "production";

const toErrorDetails = (error: unknown) => {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return {
      kind: "prisma_known",
      code: error.code,
      meta: error.meta ?? null,
      message: error.message,
    };
  }
  if (error instanceof Prisma.PrismaClientValidationError) {
    return { kind: "prisma_validation", message: error.message };
  }
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return { kind: "prisma_init", message: error.message };
  }
  if (error instanceof Error) {
    return { kind: "error", name: error.name, message: error.message };
  }
  return { kind: "unknown", message: String(error ?? "") };
};

async function _GET(req: NextRequest) {
  const startedAt = Date.now();
  const ctx = getRequestContext(req);
  const { searchParams } = new URL(req.url);

  const modeParam = searchParams.get("mode");
  const isMapMode = modeParam === "map";
  const typeParam = searchParams.get("type"); // event | all
  const categoriesParam = searchParams.get("categories"); // comma separated
  const searchParam = searchParams.get("q");
  const cursorParam = searchParams.get("cursor");
  const limitParam = searchParams.get("limit");
  const priceMinParam = searchParams.get("priceMin");
  const priceMaxParam = searchParams.get("priceMax");
  const dateParam = searchParams.get("date"); // today | upcoming | all | day | weekend
  const dayParam = searchParams.get("day"); // YYYY-MM-DD opcional
  const startDateParam = searchParams.get("startDate");
  const endDateParam = searchParams.get("endDate");
  const templateTypesParam = searchParams.get("templateTypes");
  const sortParam = searchParams.get("sort");
  const northParam = searchParams.get("north");
  const southParam = searchParams.get("south");
  const eastParam = searchParams.get("east");
  const westParam = searchParams.get("west");
  const latParam = searchParams.get("lat");
  const lngParam = searchParams.get("lng");
  const cityParam = searchParams.get("city")?.trim() || null;

  const north = parseCoord(northParam);
  const south = parseCoord(southParam);
  const east = parseCoord(eastParam);
  const west = parseCoord(westParam);
  const requestedCenterLat = parseCoord(latParam);
  const requestedCenterLng = parseCoord(lngParam);

  const requestedTake = clampTake(limitParam ? parseInt(limitParam, 10) : DEFAULT_PAGE_SIZE);
  const take = isMapMode ? Math.min(requestedTake, MAP_MODE_LIMIT) : requestedTake;
  const cursorId = cursorParam ? cursorParam : null;

  const priceMinRaw = priceMinParam ? parseFloat(priceMinParam) : null;
  const priceMin = Number.isFinite(priceMinRaw) ? Math.max(0, priceMinRaw as number) : null;
  const priceMaxRaw = priceMaxParam ? parseFloat(priceMaxParam) : null;
  const priceMax = Number.isFinite(priceMaxRaw) ? priceMaxRaw : null;

  let viewerId: string | null = null;
  let favouriteCategories: string[] | null = null;
  if (!isMapMode) {
    try {
      const supabase = await createSupabaseServer();
      const {
        data: { user },
      } = await getUserWithPolicy("required_verified", { supabaseOverride: supabase });
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
  }

  const categoryFilters = (categoriesParam || "")
    .split(",")
    .map((c) => c.trim().toUpperCase())
    .filter(Boolean);

  if (typeParam === "event") {
    // Sem filtro extra: todos os eventos publicados entram.
  }

  // Filtros são aplicados no builder canónico.

  try {
    const centerLat =
      requestedCenterLat ??
      (north != null && south != null ? (north + south) / 2 : null);
    const centerLng =
      requestedCenterLng ??
      (east != null && west != null ? (east + west) / 2 : null);
    const cacheNorth = isMapMode ? quantizeCoord(north) : north;
    const cacheSouth = isMapMode ? quantizeCoord(south) : south;
    const cacheEast = isMapMode ? quantizeCoord(east) : east;
    const cacheWest = isMapMode ? quantizeCoord(west) : west;
    const cacheCenterLat = isMapMode ? quantizeCoord(centerLat) : centerLat;
    const cacheCenterLng = isMapMode ? quantizeCoord(centerLng) : centerLng;

    const cacheKey = buildCacheKey([
      "explorar",
      modeParam ?? "",
      searchParam,
      cityParam ?? "",
      categoryFilters.join(","),
      templateTypesParam ?? "",
      dateParam ?? "",
      dayParam ?? "",
      startDateParam ?? "",
      endDateParam ?? "",
      sortParam ?? "",
      cacheNorth ?? "",
      cacheSouth ?? "",
      cacheEast ?? "",
      cacheWest ?? "",
      cacheCenterLat ?? "",
      cacheCenterLng ?? "",
      typeParam ?? "",
      priceMinParam ?? "",
      priceMaxParam ?? "",
      cursorId ?? "",
      take,
      viewerId ?? "anon",
    ]);
    const cached = getCache<ExploreResponse>(cacheKey);
    if (cached) {
      logInfo("api.explorar.list.latency", {
        requestId: ctx.requestId,
        correlationId: ctx.correlationId,
        mode: isMapMode ? "map" : "default",
        cacheHit: true,
        durationMs: Date.now() - startedAt,
      });
      return jsonWrap(cached, { status: 200 });
    }

    const result = isMapMode
      ? {
          items: await listMapEvents({
            q: searchParam,
            city: cityParam,
            categories: categoryFilters.join(",") || null,
            templateTypes: templateTypesParam,
            date: dateParam,
            day: dayParam,
            startDate: startDateParam,
            endDate: endDateParam,
            north,
            south,
            east,
            west,
            limit: take,
            priceMin,
            priceMax,
            centerLat,
            centerLng,
          }),
          nextCursor: null as string | null,
        }
      : await listRankedEvents({
          q: searchParam,
          city: cityParam,
          categories: categoryFilters.join(",") || null,
          templateTypes: templateTypesParam,
          date: dateParam,
          day: dayParam,
          startDate: startDateParam,
          endDate: endDateParam,
          sort: sortParam,
          north,
          south,
          east,
          west,
          type: typeParam,
          priceMin: priceMinParam,
          priceMax: priceMaxParam,
          cursor: cursorId,
          limit: take,
          viewerId,
          favouriteCategories,
          lat: centerLat,
          lng: centerLng,
        });

    const payload: ExploreResponse = {
      items: result.items,
      pagination: {
        nextCursor: result.nextCursor,
        hasMore: isMapMode ? false : result.nextCursor !== null,
      },
    };

    setCache(cacheKey, payload, CACHE_TTL_MS);

    logInfo("api.explorar.list.latency", {
      requestId: ctx.requestId,
      correlationId: ctx.correlationId,
      mode: isMapMode ? "map" : "default",
      cacheHit: false,
      durationMs: Date.now() - startedAt,
      resultCount: payload.items.length,
    });

    return jsonWrap(payload);
  } catch (error) {
    logError("api.explorar.list", error, {
      requestId: ctx.requestId,
      correlationId: ctx.correlationId,
      orgId: ctx.orgId,
      viewerId: viewerId ?? null,
      params: {
        type: typeParam ?? null,
        categories: categoriesParam ?? null,
        q: searchParam ?? null,
        cursor: cursorParam ?? null,
        limit: take,
        sort: sortParam ?? null,
        priceMin: priceMinParam ?? null,
        priceMax: priceMaxParam ?? null,
        date: dateParam ?? null,
        day: dayParam ?? null,
        startDate: startDateParam ?? null,
        endDate: endDateParam ?? null,
        north,
        south,
        east,
        west,
        templateTypes: templateTypesParam ?? null,
        city: cityParam ?? null,
        mode: modeParam ?? null,
      },
      durationMs: Date.now() - startedAt,
    });
    return jsonWrap(
      {
        ok: false,
        error: "INTERNAL_ERROR",
        message: "Não foi possível carregar explorar.",
        ...(shouldExposeDetails() ? { details: toErrorDetails(error) } : {}),
      },
      { status: 500 },
    );
  }
}
export const GET = withApiEnvelope(_GET);
