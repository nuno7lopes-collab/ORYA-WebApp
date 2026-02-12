export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { Prisma, PadelEligibilityType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resolvePadelCompetitionState } from "@/domain/padelCompetitionState";
import { enforcePublicRateLimit } from "@/lib/padel/publicRateLimit";
import { deriveIsFreeEvent } from "@/domain/events/derivedIsFree";
import { parsePadelFormat } from "@/domain/padel/formatCatalog";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { PUBLIC_EVENT_DISCOVER_STATUSES } from "@/domain/events/publicStatus";
import { PORTUGAL_CITIES } from "@/config/cities";
import { logError } from "@/lib/observability/logger";

const DEFAULT_LIMIT = 12;

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

async function _GET(req: NextRequest) {
  try {
    const rateLimited = await enforcePublicRateLimit(req, {
      keyPrefix: "padel_discover",
      max: 120,
    });
    if (rateLimited) return rateLimited;

    const params = req.nextUrl.searchParams;
    const q = params.get("q")?.trim() ?? "";
    const dateParam = params.get("date");
    const dayParam = params.get("day");
    const limit = clampLimit(params.get("limit"));
    const priceMinParam = params.get("priceMin");
    const priceMaxParam = params.get("priceMax");
    const formatParam = params.get("format");
    const eligibilityParam = params.get("eligibility");
    const levelParam = params.get("level");
    const cityParamRaw = params.get("city")?.trim() ?? "";
    const cityParam =
      cityParamRaw && cityParamRaw.toLowerCase() !== "portugal"
        ? PORTUGAL_CITIES.find((entry) => entry.toLowerCase() === cityParamRaw.toLowerCase()) ?? cityParamRaw
        : null;

    const priceMin = priceMinParam ? Math.max(0, parseFloat(priceMinParam)) : 0;
    const priceMaxRaw = priceMaxParam ? parseFloat(priceMaxParam) : null;
    const priceMax = Number.isFinite(priceMaxRaw) ? priceMaxRaw : null;
    const priceMinCents = Math.round(priceMin * 100);
    const priceMaxCents = priceMax !== null ? Math.round(priceMax * 100) : null;

    const where: Prisma.EventWhereInput = {
      templateType: "PADEL",
      status: { in: PUBLIC_EVENT_DISCOVER_STATUSES },
      isDeleted: false,
      organizationId: { not: null },
      organization: { status: "ACTIVE" },
    };

    if (q) {
      where.OR = [
        { title: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { addressRef: { formattedAddress: { contains: q, mode: "insensitive" } } },
      ];
    }

    if (cityParam) {
      const cityFilter: Prisma.EventWhereInput = {
        addressRef: { formattedAddress: { contains: cityParam, mode: "insensitive" } },
      };
      where.AND = Array.isArray(where.AND) ? [...where.AND, cityFilter] : [cityFilter];
    }

    const startsAtFilter = buildDateFilter(dateParam, dayParam);
    if (startsAtFilter) {
      where.startsAt = startsAtFilter;
    }

    const andFilters: Prisma.EventWhereInput[] = [];

    const formatFilter = parsePadelFormat(formatParam);
    if (formatFilter) {
      andFilters.push({ padelTournamentConfig: { is: { format: formatFilter } } });
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
      select: {
        id: true,
        slug: true,
        title: true,
        startsAt: true,
        endsAt: true,
        coverImageUrl: true,
        addressId: true,
        addressRef: {
          select: { formattedAddress: true, canonical: true },
        },
        status: true,
        ticketTypes: { select: { price: true, status: true } },
        organization: { select: { publicName: true, username: true } },
        padelTournamentConfig: {
          select: {
            format: true,
            eligibilityType: true,
            padelClubId: true,
            advancedSettings: true,
            padelV2Enabled: true,
            splitDeadlineHours: true,
            lifecycleStatus: true,
          },
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
        lifecycleStatus: event.padelTournamentConfig?.lifecycleStatus ?? null,
      });
      return competitionState === "DEVELOPMENT" || competitionState === "PUBLIC";
    });
    const computed = visibleEvents.map((event) => {
      const competitionState = resolvePadelCompetitionState({
        eventStatus: event.status,
        competitionState: (event.padelTournamentConfig?.advancedSettings as any)?.competitionState ?? null,
        lifecycleStatus: event.padelTournamentConfig?.lifecycleStatus ?? null,
      });
      const ticketPrices = event.ticketTypes
        .map((t) => (typeof t.price === "number" ? t.price : null))
        .filter((p): p is number => p !== null);

      const isGratis = deriveIsFreeEvent({ ticketPrices });
      const priceFromCents =
        isGratis ? 0 : ticketPrices.length > 0 ? Math.min(...ticketPrices) : null;
      const priceFrom = priceFromCents !== null ? priceFromCents / 100 : null;

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
        locationFormattedAddress: event.addressRef?.formattedAddress ?? null,
        addressId: event.addressId ?? null,
        priceFrom,
        organizationName: event.organization?.publicName ?? event.organization?.username ?? null,
        format: event.padelTournamentConfig?.format ?? null,
        eligibility: event.padelTournamentConfig?.eligibilityType ?? null,
        v2Enabled: event.padelTournamentConfig?.padelV2Enabled ?? null,
        splitDeadlineHours: event.padelTournamentConfig?.splitDeadlineHours ?? null,
        competitionState,
        levels,
        _priceFromCents: priceFromCents,
        isGratis,
      };
    });

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

    const items = filtered.map(({ _priceFromCents, isGratis: _isGratis, ...rest }) => rest);

    return jsonWrap(
      {
        ok: true,
        items,
        levels: Array.from(levelsMap.values()).sort((a, b) => a.label.localeCompare(b.label)),
      },
      { status: 200 },
    );
  } catch (err) {
    logError("api.padel.discover", err);
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
export const GET = withApiEnvelope(_GET);
