import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resolveTicketPricingSummary } from "@/domain/events/ticketPricing";
import { PUBLIC_EVENT_DISCOVER_STATUSES } from "@/domain/events/publicStatus";
import type { EventCardDTO } from "@/lib/events";

type DiscoverEvent = EventCardDTO & {
  latitude: number | null;
  longitude: number | null;
};

type DiscoverData = {
  currentEvents: DiscoverEvent[];
  fallbackEvents: DiscoverEvent[];
  weekEvents: DiscoverEvent[];
};

type DiscoverTab = "eventos" | "torneios" | "reservas";

type TimingTag = {
  label: string;
  tone: "now" | "soon" | "default";
};

const EVENT_SELECT = {
  id: true,
  slug: true,
  title: true,
  startsAt: true,
  endsAt: true,
  addressRef: {
    select: { formattedAddress: true, canonical: true, latitude: true, longitude: true },
  },
  pricingMode: true,
  coverImageUrl: true,
} satisfies Prisma.EventSelect;

type RawEvent = Prisma.EventGetPayload<{ select: typeof EVENT_SELECT }>;
type TicketPricingInput = {
  price: number | null;
  status: string | null;
  totalQuantity: number | null;
  soldQuantity: number | null;
};

const CURRENT_LIMIT = 8;
const FALLBACK_LIMIT = 6;
const WEEK_LIMIT = 10;
const NEARBY_RADIUS_KM = 35;
const DEV_CACHE_TTL_MS = 120_000;

type DiscoverCacheEntry = {
  ts: number;
  data: DiscoverData;
};

const DEV_CACHE: Map<string, DiscoverCacheEntry> =
  (globalThis as any).__ORYA_DISCOVER_DEV_CACHE__ ??
  ((globalThis as any).__ORYA_DISCOVER_DEV_CACHE__ = new Map<string, DiscoverCacheEntry>());

function buildCacheKey(options?: {
  range?: "today" | "week" | "near";
  lat?: number;
  lng?: number;
  priceMin?: number;
  priceMax?: number;
  tab?: DiscoverTab;
}) {
  const tab = options?.tab ?? "eventos";
  const range = options?.range ?? "week";
  const priceMin = typeof options?.priceMin === "number" ? options.priceMin : "";
  const priceMax = typeof options?.priceMax === "number" ? options.priceMax : "";
  const lat = typeof options?.lat === "number" ? options.lat.toFixed(3) : "";
  const lng = typeof options?.lng === "number" ? options.lng.toFixed(3) : "";
  return `${tab}|${range}|${priceMin}|${priceMax}|${lat}|${lng}`;
}

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

function mapDiscoverEvent(
  event: RawEvent,
  ticketMap: Map<number, TicketPricingInput[]>,
): DiscoverEvent | null {
  const pricing = resolveTicketPricingSummary({
    pricingMode: event.pricingMode ?? undefined,
    ticketTypes: ticketMap.get(event.id) ?? [],
  });

  const canonical = (event.addressRef?.canonical as Record<string, unknown> | null) ?? null;
  const locationFormattedAddress =
    event.addressRef?.formattedAddress ??
    (canonical && typeof canonical.formattedAddress === "string" && canonical.formattedAddress.trim()
      ? canonical.formattedAddress.trim()
      : null) ??
    null;
  const base: EventCardDTO = {
    id: event.id,
    slug: event.slug,
    title: event.title,
    startsAt: event.startsAt ?? null,
    endsAt: event.endsAt ?? null,
    locationFormattedAddress,
    isGratis: pricing.isGratis,
    priceFrom: pricing.priceFrom,
    coverImageUrl: event.coverImageUrl ?? null,
  };

  return {
    ...base,
    locationFormattedAddress,
    latitude: event.addressRef?.latitude ?? null,
    longitude: event.addressRef?.longitude ?? null,
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
    const value = event.isGratis ? 0 : event.priceFrom;
    if (value == null) return min === null && max === null;
    if (value < (min ?? 0)) return false;
    return value <= upperBound;
  });
}

export function formatLocationLabel(event: DiscoverEvent) {
  return event.locationFormattedAddress || null;
}

export function formatPriceLabel(event: DiscoverEvent) {
  if (event.isGratis) return "Gratuito";
  if (event.priceFrom == null) return null;
  const formatted = new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(event.priceFrom);
  return `Desde ${formatted}`;
}

export function formatEventDayLabel(event: DiscoverEvent) {
  if (!event.startsAt) return null;
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
    return { label: "Agora", tone: "now" };
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
  const isDev = process.env.NODE_ENV !== "production";
  if (isDev) {
    const key = buildCacheKey(options);
    const cached = DEV_CACHE.get(key);
    if (cached && Date.now() - cached.ts < DEV_CACHE_TTL_MS) {
      return cached.data;
    }
  }

  const now = new Date();
  const todayEnd = endOfDay(now);
  const weekEnd = endOfDay(addDays(now, 7));
  const rangeEnd = options?.range === "today" ? todayEnd : weekEnd;
  const scopeWhere = buildDiscoverWhere(options?.tab);

  const [currentRaw, upcomingRaw] = await Promise.all([
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

  const allEventIds = Array.from(new Set([...currentRaw, ...upcomingRaw].map((event) => event.id)));
  const ticketMap = await buildTicketPriceMap(allEventIds);

  const currentEvents = filterValidEvents(
    currentRaw
      .map((event) => mapDiscoverEvent(event, ticketMap))
      .filter((event): event is DiscoverEvent => Boolean(event)),
  );

  const upcomingEvents = filterValidEvents(
    upcomingRaw
      .map((event) => mapDiscoverEvent(event, ticketMap))
      .filter((event): event is DiscoverEvent => Boolean(event)),
  );

  const nearbyFiltered =
    options?.range === "near"
      ? filterNearby(upcomingEvents, options.lat, options.lng)
      : upcomingEvents;

  const priceMin = typeof options?.priceMin === "number" ? options.priceMin : null;
  const priceMax = typeof options?.priceMax === "number" ? options.priceMax : null;
  const filteredUpcoming = filterByPrice(nearbyFiltered, priceMin, priceMax);
  const filteredCurrent = filterByPrice(
    options?.range === "near" ? filterNearby(currentEvents, options.lat, options.lng) : currentEvents,
    priceMin,
    priceMax,
  );

  const upcomingToday = filteredUpcoming.filter((event) => event.startsAt && event.startsAt <= todayEnd);
  const fallbackSource = upcomingToday.length > 0 ? upcomingToday : filteredUpcoming;

  const data = {
    currentEvents: filteredCurrent.slice(0, CURRENT_LIMIT),
    fallbackEvents: fallbackSource.slice(0, FALLBACK_LIMIT),
    weekEvents: filteredUpcoming.slice(0, WEEK_LIMIT),
  };

  if (isDev) {
    const key = buildCacheKey(options);
    DEV_CACHE.set(key, { ts: Date.now(), data });
  }

  return data;
}

async function buildTicketPriceMap(eventIds: number[]) {
  const ticketMap = new Map<number, TicketPricingInput[]>();
  if (eventIds.length === 0) return ticketMap;

  const rows = await prisma.ticketType.findMany({
    where: { eventId: { in: eventIds } },
    select: {
      eventId: true,
      price: true,
      status: true,
      totalQuantity: true,
      soldQuantity: true,
    },
  });

  for (const row of rows) {
    const current = ticketMap.get(row.eventId) ?? [];
    current.push({
      price: row.price ?? null,
      status: row.status ?? null,
      totalQuantity: row.totalQuantity ?? null,
      soldQuantity: row.soldQuantity ?? null,
    });
    ticketMap.set(row.eventId, current);
  }
  return ticketMap;
}
function buildDiscoverWhere(tab?: DiscoverTab): Prisma.EventWhereInput {
  const organizationFilter: Prisma.OrganizationWhereInput = { status: "ACTIVE" };

  const base: Prisma.EventWhereInput = {
    status: { in: PUBLIC_EVENT_DISCOVER_STATUSES },
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
