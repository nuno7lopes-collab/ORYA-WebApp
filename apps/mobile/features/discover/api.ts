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
  mode?: "map";
  date?: DiscoverDateFilter;
  city?: string;
  startDate?: string;
  endDate?: string;
  templateTypes?: string;
  priceMin?: number | null;
  priceMax?: number | null;
  north?: number;
  south?: number;
  east?: number;
  west?: number;
  lat?: number;
  lng?: number;
  cursor?: string | null;
  limit?: number;
  signal?: AbortSignal;
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

const DONE_CURSOR = "__done__";

const DEFAULT_LIMIT = 12;

type SourcePage = {
  items: DiscoverOfferCard[];
  nextCursor: string | null;
  hasMore: boolean;
};

const toEventQueryString = (params: DiscoverParams): string => {
  const query = new URLSearchParams();
  if (params.mode) query.set("mode", params.mode);
  if (params.q) query.set("q", params.q);
  if (params.city) query.set("city", params.city);
  if (params.kind === "padel") query.set("categories", "PADEL");
  if (typeof params.priceMin === "number") query.set("priceMin", String(params.priceMin));
  if (typeof params.priceMax === "number") query.set("priceMax", String(params.priceMax));
  if (params.startDate) query.set("startDate", params.startDate);
  if (params.endDate) query.set("endDate", params.endDate);
  if (params.templateTypes) query.set("templateTypes", params.templateTypes);
  if (typeof params.north === "number") query.set("north", String(params.north));
  if (typeof params.south === "number") query.set("south", String(params.south));
  if (typeof params.east === "number") query.set("east", String(params.east));
  if (typeof params.west === "number") query.set("west", String(params.west));
  if (typeof params.lat === "number") query.set("lat", String(params.lat));
  if (typeof params.lng === "number") query.set("lng", String(params.lng));
  if (params.type === "free" && typeof params.priceMin !== "number" && typeof params.priceMax !== "number") {
    query.set("priceMax", "0");
  }
  if (params.type === "paid" && typeof params.priceMin !== "number" && typeof params.priceMax !== "number") {
    query.set("priceMin", "0.01");
  }
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

const toRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : null;

const toStringOrNull = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value : null;

const fetchEvents = async (params: DiscoverParams): Promise<SourcePage> => {
  const response = await api.request<unknown>(`/api/explorar/list?${toEventQueryString(params)}`, {
    signal: params.signal,
  });
  const responseRecord = toRecord(response);
  const meta = {
    requestId: toStringOrNull(responseRecord?.requestId),
    correlationId: toStringOrNull(responseRecord?.correlationId),
  };
  const unwrapped = unwrapApiResponse<unknown>(response);
  const parsed = DiscoverResponseSchema.safeParse(unwrapped);
  if (!parsed.success) {
    const unwrappedRecord = toRecord(unwrapped);
    const rawItems = Array.isArray(unwrappedRecord?.items) ? unwrappedRecord.items : null;
    const sample = Array.isArray(rawItems) && rawItems.length > 0
      ? {
          firstItemKeys:
            rawItems[0] && typeof rawItems[0] === "object"
              ? Object.keys(rawItems[0] as Record<string, unknown>)
              : null,
          firstItem: rawItems[0],
        }
      : { firstItemKeys: null, firstItem: null };
    console.warn("[discover][events] schema_mismatch", {
      ...meta,
      issues: parsed.error.issues,
      responseKeys: unwrappedRecord ? Object.keys(unwrappedRecord) : null,
      ...sample,
    });
    throw new ApiError(500, "Formato inválido na resposta de descobrir.");
  }
  const nextCursor = toStringOrNull(parsed.data.pagination?.nextCursor);
  const hasMore = Boolean(parsed.data.pagination?.hasMore && nextCursor);
  return {
    items: mapEventOffers(parsed.data.items),
    nextCursor,
    hasMore,
  };
};

const normalizeServiceCursor = (value: number | string | null | undefined): string | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return toStringOrNull(value);
};

const fetchServices = async (params: DiscoverParams): Promise<SourcePage> => {
  const response = await api.request<unknown>(`/api/servicos/list?${toServiceQueryString(params)}`, {
    signal: params.signal,
  });
  const unwrapped = unwrapApiResponse<unknown>(response);
  const parsed = parseServiceResponse(unwrapped);

  const filteredItems = (() => {
    if (params.kind !== "services") return parsed.items ?? [];
    return (parsed.items ?? []).filter((service) => service.kind !== "COURT");
  })();

  const nextCursor = normalizeServiceCursor(parsed.pagination?.nextCursor);
  const hasMore = Boolean(parsed.pagination?.hasMore && nextCursor);

  return {
    items: mapServiceOffers(filteredItems),
    nextCursor,
    hasMore,
  };
};

export const fetchDiscoverPage = async (params: DiscoverParams = {}): Promise<DiscoverPage> => {
  const kind = params.kind ?? "all";
  const limit = Math.max(1, Math.floor(params.limit ?? DEFAULT_LIMIT));
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

  const primaryEventLimit = Math.max(1, Math.ceil(limit / 2));
  const primaryServiceLimit = Math.max(1, Math.floor(limit / 2));
  const eventsDone = cursor.event === DONE_CURSOR;
  const servicesDone = cursor.service === DONE_CURSOR;
  const shouldFetchEventsPrimary = !eventsDone;
  const shouldFetchServicesPrimary = !servicesDone;
  const [eventsResult, servicesResult] = await Promise.allSettled([
    shouldFetchEventsPrimary
      ? fetchEvents({ ...params, kind, cursor: cursor.event, limit: primaryEventLimit })
      : Promise.resolve({ items: [] as DiscoverOfferCard[], nextCursor: eventsDone ? DONE_CURSOR : null, hasMore: false }),
    shouldFetchServicesPrimary
      ? fetchServices({ ...params, kind, cursor: cursor.service, limit: primaryServiceLimit })
      : Promise.resolve({
          items: [] as DiscoverOfferCard[],
          nextCursor: servicesDone ? DONE_CURSOR : null,
          hasMore: false,
        }),
  ]);

  if (eventsResult.status === "rejected" && servicesResult.status === "rejected") {
    throw eventsResult.reason ?? servicesResult.reason ?? new ApiError(500, "Erro ao carregar ofertas.");
  }

  const events =
    eventsResult.status === "fulfilled"
      ? eventsResult.value
      : { items: [] as DiscoverOfferCard[], nextCursor: eventsDone ? DONE_CURSOR : null, hasMore: false };
  const services =
    servicesResult.status === "fulfilled"
      ? servicesResult.value
      : { items: [] as DiscoverOfferCard[], nextCursor: servicesDone ? DONE_CURSOR : null, hasMore: false };

  let merged = [...events.items, ...services.items];
  let eventsState = events;
  let servicesState = services;
  const remaining = limit - merged.length;

  if (remaining > 0 && (eventsState.hasMore || servicesState.hasMore)) {
    const extraEventLimit = eventsState.hasMore
      ? servicesState.hasMore
        ? Math.ceil(remaining / 2)
        : remaining
      : 0;
    const extraServiceLimit = servicesState.hasMore
      ? eventsState.hasMore
        ? Math.floor(remaining / 2)
        : remaining
      : 0;

    const [extraEvents, extraServices] = await Promise.allSettled([
      extraEventLimit > 0
        ? fetchEvents({
            ...params,
            kind,
            cursor: eventsState.nextCursor,
            limit: extraEventLimit,
          })
        : Promise.resolve<SourcePage>({
            items: [],
            nextCursor: eventsState.nextCursor,
            hasMore: eventsState.hasMore,
          }),
      extraServiceLimit > 0
        ? fetchServices({
            ...params,
            kind,
            cursor: servicesState.nextCursor,
            limit: extraServiceLimit,
          })
        : Promise.resolve<SourcePage>({
            items: [],
            nextCursor: servicesState.nextCursor,
            hasMore: servicesState.hasMore,
          }),
    ]);

    if (extraEvents.status === "fulfilled") {
      eventsState = extraEvents.value;
      merged = merged.concat(extraEvents.value.items);
    }
    if (extraServices.status === "fulfilled") {
      servicesState = extraServices.value;
      merged = merged.concat(extraServices.value.items);
    }
  }

  if (merged.length > limit) {
    merged = merged.slice(0, limit);
  }

  const eventCursor = eventsState.hasMore ? eventsState.nextCursor : DONE_CURSOR;
  const serviceCursor = servicesState.hasMore ? servicesState.nextCursor : DONE_CURSOR;
  const hasMore = Boolean(eventsState.hasMore || servicesState.hasMore);

  return {
    items: merged,
    nextCursor: encodeCursor(eventCursor, serviceCursor),
    hasMore,
  };
};
