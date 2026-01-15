export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { Prisma, padel_format, PadelEligibilityType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resolvePadelCompetitionState } from "@/domain/padelCompetitionState";
import { enforcePublicRateLimit } from "@/lib/padel/publicRateLimit";

const DEFAULT_LIMIT = 12;
const SUPPORTED_FORMATS = new Set<padel_format>([
  padel_format.TODOS_CONTRA_TODOS,
  padel_format.QUADRO_ELIMINATORIO,
  padel_format.GRUPOS_ELIMINATORIAS,
  padel_format.QUADRO_AB,
  padel_format.NON_STOP,
  padel_format.CAMPEONATO_LIGA,
]);

function clampLimit(raw: string | null) {
  const parsed = raw ? Number(raw) : NaN;
  if (!Number.isFinite(parsed)) return DEFAULT_LIMIT;
  return Math.min(Math.max(1, Math.floor(parsed)), 30);
}

function buildDateFilter(dateParam: string | null, dayParam: string | null) {
  if (dateParam === "today") {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);
    return { gte: startOfDay, lte: endOfDay };
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
    return { gte: start, lte: end };
  }
  if (dateParam === "day" && dayParam) {
    const day = new Date(dayParam);
    if (!Number.isNaN(day.getTime())) {
      const startOfDay = new Date(day);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(day);
      endOfDay.setHours(23, 59, 59, 999);
      return { gte: startOfDay, lte: endOfDay };
    }
  }
  return dateParam === "upcoming" ? { gte: new Date() } : null;
}

export async function GET(req: NextRequest) {
  try {
    const rateLimited = await enforcePublicRateLimit(req, {
      keyPrefix: "padel_discover",
      max: 120,
    });
    if (rateLimited) return rateLimited;

    const params = req.nextUrl.searchParams;
    const q = params.get("q")?.trim() ?? "";
    const city = params.get("city")?.trim() ?? "";
    const dateParam = params.get("date");
    const dayParam = params.get("day");
    const limit = clampLimit(params.get("limit"));
    const priceMinParam = params.get("priceMin");
    const priceMaxParam = params.get("priceMax");
    const formatParam = params.get("format");
    const eligibilityParam = params.get("eligibility");
    const levelParam = params.get("level");

    const priceMin = priceMinParam ? Math.max(0, parseFloat(priceMinParam)) : 0;
    const priceMaxRaw = priceMaxParam ? parseFloat(priceMaxParam) : null;
    const priceMax = Number.isFinite(priceMaxRaw) ? priceMaxRaw : null;
    const priceMinCents = Math.round(priceMin * 100);
    const priceMaxCents = priceMax !== null ? Math.round(priceMax * 100) : null;

    const where: Prisma.EventWhereInput = {
      templateType: "PADEL",
      status: { in: ["PUBLISHED", "DATE_CHANGED"] },
      isDeleted: false,
      organizationId: { not: null },
      organization: { status: "ACTIVE" },
    };

    if (city && city.toLowerCase() !== "portugal") {
      where.locationCity = { contains: city, mode: "insensitive" };
    }

    if (q) {
      where.OR = [
        { title: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { locationName: { contains: q, mode: "insensitive" } },
        { locationCity: { contains: q, mode: "insensitive" } },
      ];
    }

    const startsAtFilter = buildDateFilter(dateParam, dayParam);
    if (startsAtFilter) {
      where.startsAt = startsAtFilter;
    }

    const andFilters: Prisma.EventWhereInput[] = [];
    if (priceMinCents > 0 && priceMaxCents !== null) {
      andFilters.push({
        isFree: false,
        ticketTypes: {
          some: {
            price: { gte: priceMinCents, lte: priceMaxCents },
          },
        },
      });
    } else if (priceMinCents > 0) {
      andFilters.push({
        isFree: false,
        ticketTypes: {
          some: {
            price: { gte: priceMinCents },
          },
        },
      });
    } else if (priceMaxCents !== null) {
      andFilters.push({
        OR: [
          { isFree: true },
          {
            ticketTypes: {
              some: {
                price: { lte: priceMaxCents },
              },
            },
          },
        ],
      });
    }

    if (formatParam && SUPPORTED_FORMATS.has(formatParam as padel_format)) {
      andFilters.push({ padelTournamentConfig: { is: { format: formatParam as padel_format } } });
    }

    if (
      eligibilityParam &&
      Object.values(PadelEligibilityType).includes(eligibilityParam as PadelEligibilityType)
    ) {
      andFilters.push({
        padelTournamentConfig: { is: { eligibilityType: eligibilityParam as PadelEligibilityType } },
      });
    }

    if (levelParam && Number.isFinite(Number(levelParam))) {
      const levelId = Number(levelParam);
      andFilters.push({ padelCategoryLinks: { some: { padelCategoryId: levelId } } });
    }

    if (andFilters.length > 0) {
      where.AND = Array.isArray(where.AND) ? [...where.AND, ...andFilters] : andFilters;
    }

    const events = await prisma.event.findMany({
      where,
      orderBy: [{ startsAt: "asc" }, { id: "asc" }],
      take: limit,
      include: {
        ticketTypes: { select: { price: true, status: true } },
        organization: { select: { publicName: true, username: true } },
        padelTournamentConfig: {
          select: { format: true, eligibilityType: true, padelClubId: true, advancedSettings: true },
        },
        padelCategoryLinks: {
          where: { isEnabled: true },
          select: { padelCategoryId: true, category: { select: { id: true, label: true } } },
        },
      },
    });

    const levelsMap = new Map<number, { id: number; label: string }>();
    const visibleEvents = events.filter((event) => {
      const competitionState = resolvePadelCompetitionState({
        eventStatus: event.status,
        competitionState: (event.padelTournamentConfig?.advancedSettings as any)?.competitionState ?? null,
      });
      return competitionState === "DEVELOPMENT" || competitionState === "PUBLIC";
    });
    const items = visibleEvents.map((event) => {
      const ticketPrices = event.ticketTypes
        .map((t) => (typeof t.price === "number" ? t.price : null))
        .filter((p): p is number => p !== null);

      let priceFrom: number | null = null;
      if (event.isFree) {
        priceFrom = 0;
      } else if (ticketPrices.length > 0) {
        priceFrom = Math.min(...ticketPrices) / 100;
      }

      const levels = (event.padelCategoryLinks ?? [])
        .map((link) => link.category)
        .filter((c): c is { id: number; label: string } => Boolean(c));
      levels.forEach((level) => levelsMap.set(level.id, level));

      return {
        id: event.id,
        slug: event.slug,
        title: event.title,
        startsAt: event.startsAt ? event.startsAt.toISOString() : null,
        endsAt: event.endsAt ? event.endsAt.toISOString() : null,
        coverImageUrl: event.coverImageUrl ?? null,
        locationName: event.locationName ?? null,
        locationCity: event.locationCity ?? null,
        priceFrom,
        organizationName: event.organization?.publicName ?? event.organization?.username ?? null,
        format: event.padelTournamentConfig?.format ?? null,
        eligibility: event.padelTournamentConfig?.eligibilityType ?? null,
        levels,
      };
    });

    return NextResponse.json(
      {
        ok: true,
        items,
        levels: Array.from(levelsMap.values()).sort((a, b) => a.label.localeCompare(b.label)),
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("[padel/discover] error", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
