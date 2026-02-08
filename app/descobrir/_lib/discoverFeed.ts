import type { PublicEventCard } from "@/domain/events/publicEventCard";
import { getAppBaseUrl } from "@/lib/appBaseUrl";
import { headers } from "next/headers";

export type DiscoverWorld = "padel" | "events" | "services";
export type DiscoverDateFilter = "all" | "today" | "upcoming" | "weekend" | "day";

export type DiscoverServiceCard = {
  id: number;
  title: string;
  description?: string | null;
  durationMinutes: number;
  unitPriceCents: number;
  currency: string;
  kind: "GENERAL" | "COURT" | "CLASS";
  categoryTag?: string | null;
  nextAvailability?: string | null;
  addressId?: string | null;
  addressRef?: { formattedAddress?: string | null; canonical?: Record<string, unknown> | null } | null;
  organization: {
    id: number;
    publicName?: string | null;
    businessName?: string | null;
    username?: string | null;
    brandingAvatarUrl?: string | null;
    addressId?: string | null;
    addressRef?: { formattedAddress?: string | null; canonical?: Record<string, unknown> | null } | null;
  };
  instructor?: {
    id: number;
    fullName?: string | null;
    username?: string | null;
    avatarUrl?: string | null;
  } | null;
};

export type DiscoverOfferCard =
  | {
      type: "event";
      key: string;
      event: PublicEventCard;
    }
  | {
      type: "service";
      key: string;
      service: DiscoverServiceCard;
    };

export type DiscoverFeedParams = {
  worlds: DiscoverWorld[];
  q?: string | null;
  city?: string | null;
  date?: DiscoverDateFilter | null;
  day?: string | null;
  priceMin?: number | null;
  priceMax?: number | null;
  lat?: number | null;
  lng?: number | null;
  distanceKm?: number | null;
  eventLimit?: number;
  serviceLimit?: number;
};

export type DiscoverFeedResult = {
  events: PublicEventCard[];
  services: DiscoverServiceCard[];
  offers: DiscoverOfferCard[];
};

const DEFAULT_EVENT_LIMIT = 50;
const DEFAULT_SERVICE_LIMIT = 20;

const toNumber = (value: unknown) => {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const toDate = (value: string | null | undefined) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
};

const toEventQueryString = (params: DiscoverFeedParams): string => {
  const query = new URLSearchParams();
  const q = params.q?.trim();
  const city = params.city?.trim();
  if (q) query.set("q", q);
  if (city) query.set("city", city);

  const worlds = params.worlds;
  const includesPadel = worlds.includes("padel");
  const includesEvents = worlds.includes("events");
  if (includesPadel && !includesEvents) {
    query.set("categories", "PADEL");
  }

  if (params.date && params.date !== "all") {
    query.set("date", params.date);
    if (params.date === "day" && params.day) query.set("day", params.day);
  }

  const priceMin = toNumber(params.priceMin);
  const priceMax = toNumber(params.priceMax);
  if (priceMin !== null) query.set("priceMin", String(priceMin));
  if (priceMax !== null) query.set("priceMax", String(priceMax));

  query.set("limit", String(params.eventLimit ?? DEFAULT_EVENT_LIMIT));
  return query.toString();
};

const toServiceQueryString = (params: DiscoverFeedParams): string => {
  const query = new URLSearchParams();
  const q = params.q?.trim();
  const city = params.city?.trim();
  if (q) query.set("q", q);
  if (city) query.set("city", city);

  if (params.date && params.date !== "all") {
    query.set("date", params.date);
    if (params.date === "day" && params.day) query.set("day", params.day);
  }

  const priceMin = toNumber(params.priceMin);
  const priceMax = toNumber(params.priceMax);
  if (priceMin !== null) query.set("priceMin", String(priceMin));
  if (priceMax !== null) query.set("priceMax", String(priceMax));

  const worlds = params.worlds;
  const includesPadel = worlds.includes("padel");
  const includesServices = worlds.includes("services");
  if (includesPadel && !includesServices) {
    query.set("kind", "COURT");
  }

  query.set("limit", String(params.serviceLimit ?? DEFAULT_SERVICE_LIMIT));
  return query.toString();
};

const filterEventsByWorlds = (events: PublicEventCard[], worlds: DiscoverWorld[]) => {
  const includesPadel = worlds.includes("padel");
  const includesEvents = worlds.includes("events");
  if (includesPadel && !includesEvents) {
    return events.filter((event) => (event.categories ?? []).includes("PADEL"));
  }
  if (includesEvents && !includesPadel) {
    return events.filter((event) => !(event.categories ?? []).includes("PADEL"));
  }
  return events;
};

const filterServicesByWorlds = (services: DiscoverServiceCard[], worlds: DiscoverWorld[]) => {
  const includesPadel = worlds.includes("padel");
  const includesServices = worlds.includes("services");
  if (includesPadel && !includesServices) {
    return services.filter((service) => service.kind === "COURT");
  }
  if (includesServices && !includesPadel) {
    return services.filter((service) => service.kind !== "COURT");
  }
  return services;
};

const toRad = (value: number) => (value * Math.PI) / 180;

const distanceKm = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const earthRadius = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
  return 2 * earthRadius * Math.asin(Math.min(1, Math.sqrt(h)));
};

export const filterEventsByDistance = (
  events: PublicEventCard[],
  params: { lat?: number | null; lng?: number | null; distanceKm?: number | null },
) => {
  if (typeof params.lat !== "number" || typeof params.lng !== "number") return events;
  const max = typeof params.distanceKm === "number" && params.distanceKm > 0 ? params.distanceKm : null;
  if (!max) return events;
  return events.filter((event) => {
    const lat = event.location?.lat;
    const lng = event.location?.lng;
    if (typeof lat !== "number" || typeof lng !== "number") return false;
    return distanceKm({ lat, lng }, { lat: params.lat as number, lng: params.lng as number }) <= max;
  });
};

const getOfferSortDate = (offer: DiscoverOfferCard): number => {
  const raw = offer.type === "event" ? offer.event.startsAt : offer.service.nextAvailability;
  const parsed = toDate(raw);
  if (!parsed) return Number.MAX_SAFE_INTEGER;
  return parsed.getTime();
};

const mapOffers = (events: PublicEventCard[], services: DiscoverServiceCard[]): DiscoverOfferCard[] => {
  const eventOffers = events.map((event) => ({
    type: "event" as const,
    key: `event-${event.id}-${event.slug}`,
    event,
  }));
  const serviceOffers = services.map((service) => ({
    type: "service" as const,
    key: `service-${service.id}`,
    service,
  }));
  return [...eventOffers, ...serviceOffers].sort((a, b) => getOfferSortDate(a) - getOfferSortDate(b));
};

const fetchJson = async <T,>(path: string): Promise<T | null> => {
  const baseUrl = getAppBaseUrl();
  const hdrs = headers();
  const resolvedHeaders =
    hdrs && typeof (hdrs as { then?: unknown }).then === "function"
      ? await (hdrs as Promise<Headers>)
      : (hdrs as Headers);
  const cookie = resolvedHeaders?.get?.("cookie") ?? null;
  const res = await fetch(`${baseUrl}${path}`, {
    cache: "no-store",
    headers: cookie ? { cookie } : undefined,
  });
  if (!res.ok) return null;
  const data = (await res.json().catch(() => null)) as T | null;
  return data ?? null;
};

export async function fetchDiscoverFeed(params: DiscoverFeedParams): Promise<DiscoverFeedResult> {
  const worlds = params.worlds.length > 0 ? params.worlds : ["padel", "events", "services"];
  const includesEventWorld = worlds.includes("events") || worlds.includes("padel");
  const includesServiceWorld = worlds.includes("services") || worlds.includes("padel");

  const [eventsPayload, servicesPayload] = await Promise.all([
    includesEventWorld
      ? fetchJson<{ ok?: boolean; items?: PublicEventCard[] }>(
          `/api/explorar/list?${toEventQueryString({ ...params, worlds })}`,
        )
      : Promise.resolve(null),
    includesServiceWorld
      ? fetchJson<{ ok?: boolean; items?: DiscoverServiceCard[] }>(
          `/api/servicos/list?${toServiceQueryString({ ...params, worlds })}`,
        )
      : Promise.resolve(null),
  ]);

  const rawEvents = eventsPayload?.ok === false ? [] : eventsPayload?.items ?? [];
  const rawServices = servicesPayload?.ok === false ? [] : servicesPayload?.items ?? [];

  let filteredEvents = filterEventsByWorlds(rawEvents, worlds);
  if (typeof params.lat === "number" && typeof params.lng === "number" && typeof params.distanceKm === "number") {
    filteredEvents = filterEventsByDistance(filteredEvents, {
      lat: params.lat,
      lng: params.lng,
      distanceKm: params.distanceKm,
    });
  }
  const filteredServices = filterServicesByWorlds(rawServices, worlds);

  return {
    events: filteredEvents,
    services: filteredServices,
    offers: mapOffers(filteredEvents, filteredServices),
  };
}

export type DiscoverEventBuckets = {
  liveEvents: PublicEventCard[];
  soonEvents: PublicEventCard[];
  cityEvents: PublicEventCard[];
};

export function splitDiscoverEvents(
  events: PublicEventCard[],
  opts: { now?: Date; soonHours?: number; city?: string | null; lat?: number | null; lng?: number | null; distanceKm?: number | null },
): DiscoverEventBuckets {
  const now = opts.now ?? new Date();
  const soonHours = opts.soonHours ?? 72;
  const soonLimit = now.getTime() + soonHours * 60 * 60 * 1000;

  const liveEvents = events.filter((event) => {
    const start = toDate(event.startsAt);
    const end = toDate(event.endsAt);
    if (!start || !end) return false;
    return start <= now && end >= now;
  });

  const soonEvents = events.filter((event) => {
    const start = toDate(event.startsAt);
    if (!start) return false;
    return start > now && start.getTime() <= soonLimit;
  });

  let cityEvents = events;
  if (opts.city && opts.city.trim()) {
    const city = opts.city.trim().toLowerCase();
    cityEvents = events.filter((event) => {
      const formatted = event.location?.formattedAddress?.toLowerCase() ?? "";
      const cityName = event.location?.city?.toLowerCase() ?? "";
      return formatted.includes(city) || cityName.includes(city);
    });
  } else if (typeof opts.lat === "number" && typeof opts.lng === "number") {
    cityEvents = filterEventsByDistance(events, {
      lat: opts.lat,
      lng: opts.lng,
      distanceKm: opts.distanceKm,
    });
  }

  return { liveEvents, soonEvents, cityEvents };
}
