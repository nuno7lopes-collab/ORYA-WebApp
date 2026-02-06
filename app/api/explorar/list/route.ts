import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getOrganizationFollowingSet } from "@/domain/social/follows";
import { listPublicDiscoverIndex } from "@/domain/search/publicDiscover";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { buildCacheKey, getCache, setCache } from "@/lib/geo/cache";
import {
  PublicEventCard,
  PublicEventCardWithPrice,
  toPublicEventCardWithPriceFromIndex,
} from "@/domain/events/publicEventCard";

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
type ExploreItemWithPrice = PublicEventCardWithPrice;

function clampTake(value: number | null): number {
  if (!value || Number.isNaN(value)) return DEFAULT_PAGE_SIZE;
  return Math.min(Math.max(value, 1), 50);
}

async function _GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const typeParam = searchParams.get("type"); // event | all
  const categoriesParam = searchParams.get("categories"); // comma separated
  const cityParam = searchParams.get("city");
  const searchParam = searchParams.get("q");
  const cursorParam = searchParams.get("cursor");
  const limitParam = searchParams.get("limit");
  const priceMinParam = searchParams.get("priceMin");
  const priceMaxParam = searchParams.get("priceMax");
  const dateParam = searchParams.get("date"); // today | upcoming | all | day | weekend
  const dayParam = searchParams.get("day"); // YYYY-MM-DD opcional

  const take = clampTake(limitParam ? parseInt(limitParam, 10) : DEFAULT_PAGE_SIZE);
  const cursorId = cursorParam ? cursorParam : null;

  const priceMin = priceMinParam ? Math.max(0, parseFloat(priceMinParam)) : 0;
  const priceMaxRaw = priceMaxParam ? parseFloat(priceMaxParam) : null;
  const priceMax = Number.isFinite(priceMaxRaw) ? priceMaxRaw : null;

  const priceMinCents = Math.round(priceMin * 100);
  const priceMaxCents = priceMax !== null ? Math.round(priceMax * 100) : null;

  let viewerId: string | null = null;
  let profileLocation:
    | {
        locationConsent: "PENDING" | "GRANTED" | "DENIED";
        locationGranularity: "PRECISE" | "COARSE";
        locationCity: string | null;
        locationRegion: string | null;
      }
    | null = null;
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    viewerId = user?.id ?? null;
    if (viewerId) {
      profileLocation = await prisma.profile.findUnique({
        where: { id: viewerId },
        select: {
          locationConsent: true,
          locationGranularity: true,
          locationCity: true,
          locationRegion: true,
        },
      });
    }
  } catch {
    viewerId = null;
    profileLocation = null;
  }

  const categoryFilters = (categoriesParam || "")
    .split(",")
    .map((c) => c.trim().toUpperCase())
    .filter(Boolean);

  if (typeParam === "event") {
    // Sem filtro extra: todos os eventos publicados entram.
  }

  const profileCity =
    profileLocation &&
    profileLocation.locationConsent === "GRANTED" &&
    profileLocation.locationGranularity === "COARSE"
      ? profileLocation.locationCity || profileLocation.locationRegion
      : null;
  const normalizedCity = cityParam?.trim() || profileCity || null;
  const applyCityFilter = normalizedCity && normalizedCity.toLowerCase() !== "portugal";

  // Filtros são aplicados no builder canónico.

  try {
    const cacheKey = buildCacheKey([
      "explorar",
      searchParam,
      normalizedCity ?? "",
      categoryFilters.join(","),
      dateParam ?? "",
      dayParam ?? "",
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

    const { items: indexItems, nextCursor } = await listPublicDiscoverIndex({
      q: searchParam,
      city: applyCityFilter ? normalizedCity : null,
      categories: categoryFilters.join(",") || null,
      date: dateParam,
      day: dayParam,
      type: typeParam,
      priceMin: priceMinParam,
      priceMax: priceMaxParam,
      cursor: cursorId,
      limit: take,
    });

    let orderedItems = indexItems;
    if (viewerId && indexItems.length > 0 && searchParam && searchParam.trim().length >= 1) {
      const organizationIds = Array.from(
        new Set(
          indexItems
            .map((event) => event.organizationId)
            .filter((id): id is number => typeof id === "number"),
        ),
      );
      if (organizationIds.length > 0) {
        const followedIds = await getOrganizationFollowingSet(viewerId, organizationIds);
        if (followedIds.size > 0) {
          const followed: typeof indexItems = [];
          const rest: typeof indexItems = [];
          indexItems.forEach((event) => {
            if (event.organizationId && followedIds.has(event.organizationId)) {
              followed.push(event);
            } else {
              rest.push(event);
            }
          });
          orderedItems = [...followed, ...rest];
        }
      }
    }

    const computed: ExploreItemWithPrice[] = orderedItems.map((event) =>
      toPublicEventCardWithPriceFromIndex({
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
      }),
    );

    const filtered = computed.filter((item) => {
      if (priceMinCents > 0 && priceMaxCents !== null) {
        return (
          !item.isGratis &&
          item._priceFromCents !== null &&
          item._priceFromCents >= priceMinCents &&
          item._priceFromCents <= priceMaxCents
        );
      }
      if (priceMinCents > 0) {
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

    const items: ExploreItem[] = filtered.map(({ _priceFromCents, ...rest }) => rest);

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
    console.error("[api/explorar/list] erro:", error);
    // Em caso de erro, devolve lista vazia mas não rebenta o frontend
    return jsonWrap(
      {
        items: [],
        pagination: { nextCursor: null, hasMore: false },
        error: error instanceof Error ? error.message : "Erro desconhecido",
      },
      { status: 200 },
    );
  }
}
export const GET = withApiEnvelope(_GET);
