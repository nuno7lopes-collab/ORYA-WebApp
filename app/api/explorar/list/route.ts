import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { listRankedEvents } from "@/domain/ranking/listRankedEvents";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { buildCacheKey, getCache, setCache } from "@/lib/geo/cache";
import { getRequestContext } from "@/lib/http/requestContext";
import { logError } from "@/lib/observability/logger";
import { Prisma } from "@prisma/client";
import { PublicEventCard } from "@/domain/events/publicEventCard";

const DEFAULT_PAGE_SIZE = 12;
const CACHE_TTL_MS = 30 * 1000;

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
  const ctx = getRequestContext(req);
  const { searchParams } = new URL(req.url);

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
  const cityParam = searchParams.get("city")?.trim() || null;

  const parseCoord = (value: string | null) => {
    if (!value) return null;
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const north = parseCoord(northParam);
  const south = parseCoord(southParam);
  const east = parseCoord(eastParam);
  const west = parseCoord(westParam);

  const take = clampTake(limitParam ? parseInt(limitParam, 10) : DEFAULT_PAGE_SIZE);
  const cursorId = cursorParam ? cursorParam : null;

  const priceMin = priceMinParam ? Math.max(0, parseFloat(priceMinParam)) : 0;
  const priceMaxRaw = priceMaxParam ? parseFloat(priceMaxParam) : null;
  const priceMax = Number.isFinite(priceMaxRaw) ? priceMaxRaw : null;

  let viewerId: string | null = null;
  let favouriteCategories: string[] | null = null;
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

  const categoryFilters = (categoriesParam || "")
    .split(",")
    .map((c) => c.trim().toUpperCase())
    .filter(Boolean);

  if (typeParam === "event") {
    // Sem filtro extra: todos os eventos publicados entram.
  }

  // Filtros são aplicados no builder canónico.

  try {
    const cacheKey = buildCacheKey([
      "explorar",
      searchParam,
      cityParam ?? "",
      categoryFilters.join(","),
      templateTypesParam ?? "",
      dateParam ?? "",
      dayParam ?? "",
      startDateParam ?? "",
      endDateParam ?? "",
      sortParam ?? "",
      north ?? "",
      south ?? "",
      east ?? "",
      west ?? "",
      typeParam ?? "",
      priceMinParam ?? "",
      priceMaxParam ?? "",
      cursorId ?? "",
      take,
      viewerId ?? "anon",
    ]);
    const cached = getCache<ExploreResponse>(cacheKey);
    if (cached) {
      return jsonWrap(cached, { status: 200 });
    }

    const { items, nextCursor } = await listRankedEvents({
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
      lat: north && south ? (north + south) / 2 : null,
      lng: east && west ? (east + west) / 2 : null,
    });

    const payload: ExploreResponse = {
      items,
      pagination: {
        nextCursor,
        hasMore: nextCursor !== null,
      },
    };

    setCache(cacheKey, payload, CACHE_TTL_MS);

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
      },
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
