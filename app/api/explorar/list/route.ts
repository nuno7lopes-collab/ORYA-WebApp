import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

const DEFAULT_PAGE_SIZE = 12;

type ExploreItem = {
  id: number;
  type: "EVENT" | "EXPERIENCE";
  slug: string;
  title: string;
  shortDescription: string | null;
  startsAt: string;
  endsAt: string;
  location: {
    name: string | null;
    city: string | null;
    lat: number | null;
    lng: number | null;
  };
  coverImageUrl: string | null;
  isFree: boolean;
  priceFrom: number | null;
  categories: string[];
  hostName: string | null;
  hostUsername: string | null;
  status: "ACTIVE" | "CANCELLED" | "PAST" | "DRAFT";
  isHighlighted: boolean;
};

type ExploreResponse = {
  items: ExploreItem[];
  pagination: {
    nextCursor: number | null;
    hasMore: boolean;
  };
};

function resolveStatus(event: {
  status: string;
  endsAt: Date | string | null;
}): ExploreItem["status"] {
  if (event.status === "CANCELLED") return "CANCELLED";
  if (event.status === "DRAFT") return "DRAFT";

  const now = Date.now();
  const endDate =
    event.endsAt instanceof Date
      ? event.endsAt.getTime()
      : event.endsAt
        ? new Date(event.endsAt).getTime()
        : null;

  if (endDate && endDate < now) return "PAST";
  return "ACTIVE";
}

function clampTake(value: number | null): number {
  if (!value || Number.isNaN(value)) return DEFAULT_PAGE_SIZE;
  return Math.min(Math.max(value, 1), 50);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const typeParam = searchParams.get("type"); // event | experience | all
  const categoriesParam = searchParams.get("categories"); // comma separated
  const cityParam = searchParams.get("city");
  const searchParam = searchParams.get("q");
  const cursorParam = searchParams.get("cursor");
  const limitParam = searchParams.get("limit");
  const priceMinParam = searchParams.get("priceMin");
  const priceMaxParam = searchParams.get("priceMax");
  const dateParam = searchParams.get("date"); // today | upcoming | all

  const take = clampTake(limitParam ? parseInt(limitParam, 10) : DEFAULT_PAGE_SIZE);
  const cursorId = cursorParam ? Number(cursorParam) : null;

  const priceMin = priceMinParam ? Math.max(0, parseFloat(priceMinParam)) : 0;
  const priceMaxRaw = priceMaxParam ? parseFloat(priceMaxParam) : null;
  const priceMax = Number.isFinite(priceMaxRaw) ? priceMaxRaw : null;

  const priceMinCents = Math.round(priceMin * 100);
  const priceMaxCents = priceMax !== null ? Math.round(priceMax * 100) : null;

  const categoryFilters = (categoriesParam || "")
    .split(",")
    .map((c) => c.trim().toUpperCase())
    .filter(Boolean);

    const where: Prisma.EventWhereInput = {
      status: "PUBLISHED",
    };

  if (typeParam === "event") {
    where.type = "ORGANIZER_EVENT";
  } else if (typeParam === "experience") {
    where.type = "EXPERIENCE";
  }

  if (cityParam) {
    where.locationCity = {
      contains: cityParam,
      mode: "insensitive",
    };
  }

  if (searchParam) {
    const q = searchParam.trim();
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
      { locationName: { contains: q, mode: "insensitive" } },
      { locationCity: { contains: q, mode: "insensitive" } },
    ];
  }

  // Map categorias pedidas para templateType conhecido (fallback)
  if (categoryFilters.length > 0) {
    const mapToTemplate: Record<string, Prisma.EventTemplateType> = {
      FESTA: "PARTY",
      DESPORTO: "SPORT",
      CONCERTO: "OTHER",
      PALESTRA: "TALK",
      ARTE: "OTHER",
      COMIDA: "OTHER",
      DRINKS: "OTHER",
    };
    const templateTypes = categoryFilters
      .map((c) => mapToTemplate[c])
      .filter((v): v is Prisma.EventTemplateType => Boolean(v));

    if (templateTypes.length > 0) {
      where.templateType = { in: templateTypes };
    }
  }

  if (dateParam === "today") {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);
    where.startsAt = { gte: startOfDay, lte: endOfDay };
  } else if (dateParam === "upcoming") {
    const now = new Date();
    where.startsAt = { gte: now };
  }

  // Filtro de preço (priceMax === null significa sem limite superior)
  const priceFilters: Prisma.EventWhereInput[] = [];
  if (priceMinCents > 0 && priceMaxCents !== null) {
    priceFilters.push({
      isFree: false,
      ticketTypes: {
        some: {
          price: {
            gte: priceMinCents,
            lte: priceMaxCents,
          },
        },
      },
    });
  } else if (priceMinCents > 0) {
    priceFilters.push({
      isFree: false,
      ticketTypes: {
        some: {
          price: {
            gte: priceMinCents,
          },
        },
      },
    });
  } else if (priceMaxCents !== null) {
    priceFilters.push({
      OR: [
        { isFree: true },
        {
          ticketTypes: {
            some: {
              price: {
                lte: priceMaxCents,
              },
            },
          },
        },
      ],
    });
  }

  if (priceFilters.length > 0) {
    where.AND = Array.isArray(where.AND) ? [...where.AND, ...priceFilters] : priceFilters;
  }

  const query: Prisma.EventFindManyArgs = {
    where,
    orderBy: [{ startsAt: "asc" }, { id: "asc" }],
    take: take + 1,
    include: {
      ticketTypes: {
        select: {
          price: true,
          status: true,
        },
      },
      organizer: {
        select: {
          displayName: true,
        },
      },
      owner: {
        select: {
          username: true,
          fullName: true,
        },
      },
    },
  };

  if (cursorId) {
    query.skip = 1;
    query.cursor = { id: cursorId };
  }

  try {
    const events = await prisma.event.findMany(query);

    let nextCursor: number | null = null;
    if (events.length > take) {
      const nextItem = events.pop();
      nextCursor = nextItem?.id ?? null;
    }

    const items: ExploreItem[] = events.map((event) => {
      const isExperience = event.type === "EXPERIENCE";
      const mappedType: ExploreItem["type"] = isExperience ? "EXPERIENCE" : "EVENT";
      const status = resolveStatus({
        status: event.status,
        endsAt: event.endsAt,
        isDeleted: false,
      });

      const ticketPrices = Array.isArray(event.ticketTypes)
        ? event.ticketTypes
            .map((t) => (typeof t.price === "number" ? t.price : null))
            .filter((p): p is number => p !== null)
        : [];

      let priceFrom: number | null = null;
      if (event.isFree || isExperience) {
        priceFrom = 0;
      } else if (ticketPrices.length > 0) {
        priceFrom = Math.min(...ticketPrices) / 100;
      }

      const hostName = event.organizer?.displayName ?? event.owner?.fullName ?? null;
      const hostUsername = event.owner?.username ?? null;

      const templateToCategory: Record<string, string> = {
        PARTY: "FESTA",
        SPORT: "DESPORTO",
        TALK: "PALESTRA",
      };
      const categories =
        event.templateType != null
          ? [templateToCategory[String(event.templateType)] ?? "OUTROS"]
          : [];

      return {
        id: event.id,
        type: mappedType,
        slug: event.slug,
        title: event.title,
        shortDescription: event.description?.slice(0, 200) ?? null,
        startsAt: event.startsAt ? new Date(event.startsAt).toISOString() : "",
        endsAt: event.endsAt ? new Date(event.endsAt).toISOString() : "",
        location: {
          name: event.locationName ?? null,
          city: event.locationCity ?? null,
          lat: event.latitude ?? null,
          lng: event.longitude ?? null,
        },
        coverImageUrl: event.coverImageUrl ?? null,
        isFree: event.isFree || isExperience,
        priceFrom,
        categories,
        hostName,
        hostUsername,
        status,
        isHighlighted: false,
      };
    });

    return NextResponse.json<ExploreResponse>({
      items,
      pagination: {
        nextCursor,
        hasMore: nextCursor !== null,
      },
    });
  } catch (error) {
    console.error("[api/explorar/list] erro:", error);
    return NextResponse.json<ExploreResponse>(
      {
        items: [],
        pagination: { nextCursor: null, hasMore: false },
      },
      { status: 500 },
    );
  }
}
