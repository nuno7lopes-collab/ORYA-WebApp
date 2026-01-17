import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { mapEventToCardDTO, type EventCardDTO } from "@/lib/events";

type DiscoverEvent = EventCardDTO & {
  locationName: string | null;
  latitude: number | null;
  longitude: number | null;
};

type DiscoverData = {
  liveEvents: DiscoverEvent[];
  fallbackEvents: DiscoverEvent[];
  weekEvents: DiscoverEvent[];
};

type DiscoverTab = "eventos" | "torneios" | "reservas";

type TimingTag = {
  label: string;
  tone: "live" | "soon" | "default";
};

const EVENT_SELECT = {
  id: true,
  slug: true,
  title: true,
  startsAt: true,
  endsAt: true,
  locationName: true,
  locationCity: true,
  latitude: true,
  longitude: true,
  isFree: true,
  coverImageUrl: true,
  ticketTypes: {
    select: {
      price: true,
      sortOrder: true,
    },
    orderBy: { sortOrder: "asc" },
  },
} satisfies Prisma.EventSelect;

type RawEvent = Prisma.EventGetPayload<{ select: typeof EVENT_SELECT }>;

const LIVE_LIMIT = 8;
const FALLBACK_LIMIT = 6;
const WEEK_LIMIT = 10;
const NEARBY_RADIUS_KM = 35;

function endOfDay(date: Date) {
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return end;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function mapDiscoverEvent(event: RawEvent): DiscoverEvent | null {
  const base = mapEventToCardDTO(event);
  if (!base) return null;
  return {
    ...base,
    locationName: event.locationName ?? null,
    latitude: event.latitude ?? null,
    longitude: event.longitude ?? null,
  };
}

function filterValidEvents(events: DiscoverEvent[]) {
  return events.filter((event) => Boolean(event.startsAt && event.endsAt));
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

function filterNearby(events: DiscoverEvent[], lat?: number, lng?: number) {
  if (typeof lat !== "number" || typeof lng !== "number") return events;
  return events.filter((event) => {
    if (typeof event.latitude !== "number" || typeof event.longitude !== "number") return false;
    const km = distanceKm({ lat, lng }, { lat: event.latitude, lng: event.longitude });
    return km <= NEARBY_RADIUS_KM;
  });
}

function filterByPrice(events: DiscoverEvent[], min: number | null, max: number | null) {
  if (min === null && max === null) return events;
  const upperBound = max !== null ? max : Number.POSITIVE_INFINITY;
  return events.filter((event) => {
    const value = event.isFree ? 0 : event.priceFrom;
    if (value == null) return min === null && max === null;
    if (value < (min ?? 0)) return false;
    return value <= upperBound;
  });
}

export function formatLocationLabel(event: DiscoverEvent) {
  return [event.locationName, event.locationCity].filter(Boolean).join(" - ") || "Local a anunciar";
}

export function formatPriceLabel(event: DiscoverEvent) {
  if (event.isFree) return "Gratuito";
  if (event.priceFrom == null) return "Valor a anunciar";
  const formatted = event.priceFrom.toLocaleString("pt-PT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `Desde ${formatted} EUR`;
}

export function formatEventDayLabel(event: DiscoverEvent) {
  if (!event.startsAt) return "Data a anunciar";
  return event.startsAt.toLocaleDateString("pt-PT", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
}

export function buildTimingTag(event: DiscoverEvent, now: Date): TimingTag {
  if (!event.startsAt || !event.endsAt) {
    return { label: "Agora", tone: "default" };
  }

  if (event.startsAt <= now && event.endsAt >= now) {
    return { label: "Agora", tone: "live" };
  }

  const diffMs = Math.max(event.startsAt.getTime() - now.getTime(), 0);
  const diffMinutes = Math.ceil(diffMs / 60000);
  if (diffMinutes < 60) {
    return { label: `Falta ${diffMinutes} min`, tone: "soon" };
  }
  const diffHours = Math.ceil(diffMinutes / 60);
  if (diffHours < 24) {
    return { label: `Falta ${diffHours} h`, tone: "soon" };
  }
  const diffDays = Math.ceil(diffHours / 24);
  return { label: `Falta ${diffDays} d`, tone: "default" };
}

export async function getDiscoverData(options?: {
  range?: "today" | "week" | "near";
  lat?: number;
  lng?: number;
  priceMin?: number;
  priceMax?: number;
  tab?: DiscoverTab;
}): Promise<DiscoverData> {
  const now = new Date();
  const todayEnd = endOfDay(now);
  const weekEnd = endOfDay(addDays(now, 7));
  const rangeEnd = options?.range === "today" ? todayEnd : weekEnd;
  const scopeWhere = buildDiscoverWhere(options?.tab);

  const [liveRaw, upcomingRaw] = await Promise.all([
    prisma.event.findMany({
      where: {
        ...scopeWhere,
        startsAt: { lte: now },
        endsAt: { gte: now },
      },
      select: EVENT_SELECT,
      orderBy: { startsAt: "asc" },
      take: 10,
    }),
    prisma.event.findMany({
      where: {
        ...scopeWhere,
        startsAt: { gte: now, lte: rangeEnd },
      },
      select: EVENT_SELECT,
      orderBy: { startsAt: "asc" },
      take: 30,
    }),
  ]);

  const liveEvents = filterValidEvents(
    liveRaw.map(mapDiscoverEvent).filter((event): event is DiscoverEvent => Boolean(event)),
  );

  const upcomingEvents = filterValidEvents(
    upcomingRaw.map(mapDiscoverEvent).filter((event): event is DiscoverEvent => Boolean(event)),
  );

  const nearbyFiltered =
    options?.range === "near"
      ? filterNearby(upcomingEvents, options.lat, options.lng)
      : upcomingEvents;

  const priceMin = typeof options?.priceMin === "number" ? options.priceMin : null;
  const priceMax = typeof options?.priceMax === "number" ? options.priceMax : null;
  const filteredUpcoming = filterByPrice(nearbyFiltered, priceMin, priceMax);
  const filteredLive = filterByPrice(
    options?.range === "near" ? filterNearby(liveEvents, options.lat, options.lng) : liveEvents,
    priceMin,
    priceMax,
  );

  const upcomingToday = filteredUpcoming.filter((event) => event.startsAt && event.startsAt <= todayEnd);
  const fallbackSource = upcomingToday.length > 0 ? upcomingToday : filteredUpcoming;

  return {
    liveEvents: filteredLive.slice(0, LIVE_LIMIT),
    fallbackEvents: fallbackSource.slice(0, FALLBACK_LIMIT),
    weekEvents: filteredUpcoming.slice(0, WEEK_LIMIT),
  };
}
function buildDiscoverWhere(tab?: DiscoverTab): Prisma.EventWhereInput {
  const organizationFilter: Prisma.OrganizationWhereInput = { status: "ACTIVE" };

  const base: Prisma.EventWhereInput = {
    status: { in: ["PUBLISHED", "DATE_CHANGED"] },
    isDeleted: false,
    organizationId: { not: null },
    organization: organizationFilter,
  };

  if (tab === "torneios") {
    base.AND = [
      {
        OR: [
          { tournament: { isNot: null } },
          { templateType: "PADEL" },
        ],
      },
    ];
  }

  return base;
}
