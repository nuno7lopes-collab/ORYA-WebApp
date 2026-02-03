import { DiscoverResponseSchema, PublicEventCard } from "@orya/shared";
import { api, ApiError, unwrapApiResponse } from "../../lib/api";
import {
  DiscoverDateFilter,
  DiscoverKind,
  DiscoverOfferCard,
  DiscoverPriceFilter,
  DiscoverServiceCard,
} from "./types";

type DiscoverParams = {
  q?: string;
  type?: DiscoverPriceFilter;
  kind?: DiscoverKind;
  date?: DiscoverDateFilter;
  city?: string;
  cursor?: string | null;
  limit?: number;
};

export type DiscoverPage = {
  items: DiscoverOfferCard[];
  nextCursor: string | null;
  hasMore: boolean;
};

type ServiceListResponse = {
  items?: DiscoverServiceCard[];
  pagination?: {
    nextCursor?: number | string | null;
    hasMore?: boolean;
  };
};

type CursorState = {
  event: string | null;
  service: string | null;
};

const DEFAULT_LIMIT = 12;

const toEventQueryString = (params: DiscoverParams): string => {
  const query = new URLSearchParams();
  if (params.q) query.set("q", params.q);
  if (params.city) query.set("city", params.city);
  if (params.kind === "padel") query.set("categories", "PADEL");
  if (params.kind === "events") query.set("categories", "GERAL");
  if (params.type === "free") query.set("priceMax", "0");
  if (params.type === "paid") query.set("priceMin", "0.01");
  if (params.date && params.date !== "all") query.set("date", params.date);
  if (params.cursor) query.set("cursor", params.cursor);
  query.set("limit", String(params.limit ?? DEFAULT_LIMIT));
  return query.toString();
};

const toServiceQueryString = (params: DiscoverParams): string => {
  const query = new URLSearchParams();
  if (params.q) query.set("q", params.q);
  if (params.city) query.set("city", params.city);
  if (params.type === "free") query.set("priceMax", "0");
  if (params.type === "paid") query.set("priceMin", "0.01");
  if (params.kind === "padel") query.set("kind", "COURT");
  if (params.date && params.date !== "all") query.set("date", params.date);
  if (params.cursor) query.set("cursor", params.cursor);
  query.set("limit", String(params.limit ?? DEFAULT_LIMIT));
  return query.toString();
};

const parseCursor = (cursor: string | null | undefined): CursorState => {
  if (!cursor) return { event: null, service: null };
  const parsed = new URLSearchParams(cursor);
  const event = parsed.get("e");
  const service = parsed.get("s");
  if (!event && !service) {
    return { event: cursor, service: null };
  }
  return {
    event: event || null,
    service: service || null,
  };
};

const encodeCursor = (event: string | null, service: string | null): string | null => {
  if (!event && !service) return null;
  const params = new URLSearchParams();
  if (event) params.set("e", event);
  if (service) params.set("s", service);
  return params.toString();
};

const parseServiceResponse = (payload: unknown): ServiceListResponse => {
  if (!payload || typeof payload !== "object") return {};
  const raw = payload as Record<string, unknown>;
  return {
    items: Array.isArray(raw.items) ? (raw.items as DiscoverServiceCard[]) : [],
    pagination:
      raw.pagination && typeof raw.pagination === "object"
        ? (raw.pagination as ServiceListResponse["pagination"])
        : undefined,
  };
};

const mapEventOffers = (items: PublicEventCard[]): DiscoverOfferCard[] =>
  items.map((event) => ({
    type: "event",
    key: `event-${event.id}-${event.slug}`,
    event,
  }));

const mapServiceOffers = (items: DiscoverServiceCard[]): DiscoverOfferCard[] =>
  items.map((service) => ({
    type: "service",
    key: `service-${service.id}`,
    service,
  }));

const getOfferSortDate = (item: DiscoverOfferCard): number => {
  const raw = item.type === "event" ? item.event.startsAt : item.service.nextAvailability;
  if (!raw) return Number.MAX_SAFE_INTEGER;
  const ts = new Date(raw).getTime();
  return Number.isFinite(ts) ? ts : Number.MAX_SAFE_INTEGER;
};

const fetchEvents = async (params: DiscoverParams): Promise<{ items: DiscoverOfferCard[]; nextCursor: string | null; hasMore: boolean }> => {
  const response = await api.request<unknown>(`/api/explorar/list?${toEventQueryString(params)}`);
  const unwrapped = unwrapApiResponse<unknown>(response);
  const parsed = DiscoverResponseSchema.safeParse(unwrapped);
  if (!parsed.success) {
    throw new ApiError(500, "Formato invalido na resposta de descobrir.");
  }
  return {
    items: mapEventOffers(parsed.data.items),
    nextCursor: parsed.data.pagination?.nextCursor ?? null,
    hasMore: parsed.data.pagination?.hasMore ?? false,
  };
};

const fetchServices = async (params: DiscoverParams): Promise<{ items: DiscoverOfferCard[]; nextCursor: string | null; hasMore: boolean }> => {
  const response = await api.request<unknown>(`/api/servicos/list?${toServiceQueryString(params)}`);
  const unwrapped = unwrapApiResponse<unknown>(response);
  const parsed = parseServiceResponse(unwrapped);

  const filteredItems = (() => {
    if (params.kind !== "services") return parsed.items ?? [];
    return (parsed.items ?? []).filter((service) => service.kind !== "COURT");
  })();

  return {
    items: mapServiceOffers(filteredItems),
    nextCursor: parsed.pagination?.nextCursor ? String(parsed.pagination.nextCursor) : null,
    hasMore: Boolean(parsed.pagination?.hasMore),
  };
};

export const fetchDiscoverPage = async (params: DiscoverParams = {}): Promise<DiscoverPage> => {
  const kind = params.kind ?? "all";
  const limit = params.limit ?? DEFAULT_LIMIT;
  const cursor = parseCursor(params.cursor);

  if (kind === "events") {
    const events = await fetchEvents({ ...params, kind, cursor: cursor.event, limit });
    return {
      items: events.items,
      nextCursor: events.nextCursor,
      hasMore: events.hasMore,
    };
  }

  if (kind === "services") {
    const services = await fetchServices({ ...params, kind, cursor: cursor.service, limit });
    return {
      items: services.items,
      nextCursor: services.nextCursor,
      hasMore: services.hasMore,
    };
  }

  const perSourceLimit = Math.max(6, Math.ceil(limit / 2));
  const [events, services] = await Promise.all([
    fetchEvents({ ...params, kind, cursor: cursor.event, limit: perSourceLimit }),
    fetchServices({ ...params, kind, cursor: cursor.service, limit: perSourceLimit }),
  ]);

  const merged = [...events.items, ...services.items]
    .sort((a, b) => getOfferSortDate(a) - getOfferSortDate(b))
    .slice(0, limit);

  return {
    items: merged,
    nextCursor: encodeCursor(events.nextCursor, services.nextCursor),
    hasMore: Boolean(events.hasMore || services.hasMore),
  };
};
