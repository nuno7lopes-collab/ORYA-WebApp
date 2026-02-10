import { PublicEventCard } from "@orya/shared";
import { api, unwrapApiResponse } from "../../lib/api";
import { AgoraEvent, AgoraFeedMode, AgoraPage, AgoraPageParam } from "./types";

type LegacyEventListItem = {
  id: number;
  slug: string;
  title: string;
  shortDescription: string | null;
  startDate: string;
  endDate: string;
  coverImageUrl: string | null;
  isGratis: boolean;
  priceFrom: number | null;
  category: string | null;
  venue: {
    name: string | null;
    city: string | null;
    address: string | null;
    lat: number | null;
    lng: number | null;
    formattedAddress: string | null;
    source: string | null;
    components?: Record<string, unknown> | null;
    overrides?: Record<string, unknown> | null;
  };
  stats?: {
    goingCount?: number;
  };
  interestTags?: string[];
  rank?: {
    score: number;
    reasons: Array<{ code: string; label?: string; weight?: number }>;
  };
};

type LegacyEventListPayload = {
  events?: LegacyEventListItem[];
  pagination?: {
    nextCursor?: string | null;
    hasMore?: boolean;
  };
};

const DEFAULT_LIMIT = 18;
const MIN_VALID_MS = Date.UTC(2000, 0, 1);

const parseEventDateMs = (value?: string | number | null): number | null => {
  if (value == null) return null;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    if (value > 1e12) return value;
    if (value > 1e9) return value * 1000;
    return null;
  }
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  if (/^\d+$/.test(trimmed)) {
    const numeric = Number(trimmed);
    if (!Number.isFinite(numeric)) return null;
    if (numeric > 1e12) return numeric;
    if (numeric > 1e9) return numeric * 1000;
    return null;
  }
  const parsed = new Date(trimmed).getTime();
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeNumericDate = (value?: string | null): string | undefined => {
  if (!value) return value ?? undefined;
  const trimmed = String(value).trim();
  if (!/^\d+$/.test(trimmed)) return value;
  const ms = parseEventDateMs(trimmed);
  if (ms == null) return value;
  return new Date(ms).toISOString();
};

const toPublicCard = (item: LegacyEventListItem): PublicEventCard => {
  const now = Date.now();
  const endMs = parseEventDateMs(item.endDate);
  const isPast = Boolean(endMs && endMs >= MIN_VALID_MS && endMs < now);
  const normalizedStart = normalizeNumericDate(item.startDate ?? null);
  const normalizedEnd = normalizeNumericDate(item.endDate ?? null);

  return {
    id: item.id,
    type: "EVENT",
    slug: item.slug,
    title: item.title,
    description: item.shortDescription,
    shortDescription: item.shortDescription,
    startsAt: normalizedStart ?? item.startDate,
    endsAt: normalizedEnd ?? item.endDate,
    coverImageUrl: item.coverImageUrl,
    isGratis: item.isGratis,
    priceFrom: item.priceFrom,
    categories: [item.category ?? "GERAL"],
    templateType: item.category ?? null,
    interestTags: Array.isArray(item.interestTags) ? item.interestTags : [],
    hostName: null,
    hostUsername: null,
    status: isPast ? "PAST" : "ACTIVE",
    isHighlighted: Boolean(item.stats?.goingCount && item.stats.goingCount > 20),
    rank: item.rank ?? undefined,
    location: {
      name: item.venue?.name ?? null,
      city: item.venue?.city ?? null,
      address: item.venue?.address ?? null,
      lat: item.venue?.lat ?? null,
      lng: item.venue?.lng ?? null,
      formattedAddress: item.venue?.formattedAddress ?? null,
      source: item.venue?.source ?? null,
      components: item.venue?.components ?? null,
      overrides: item.venue?.overrides ?? null,
    },
  };
};

const formatLiveWindowLabel = (status: AgoraEvent["agoraStatus"], startsInMinutes: number | null) => {
  if (status === "LIVE") return "A acontecer agora";
  if (status === "SOON" && startsInMinutes !== null) {
    if (startsInMinutes <= 1) return "Começa já";
    return `Começa em ${startsInMinutes}m`;
  }
  return "Em breve";
};

const toAgoraEvent = (item: PublicEventCard): AgoraEvent => {
  const now = Date.now();
  const normalizedStartsAt = normalizeNumericDate(item.startsAt ?? null) ?? item.startsAt;
  const normalizedEndsAt = normalizeNumericDate(item.endsAt ?? null) ?? item.endsAt;
  const startMs = parseEventDateMs(normalizedStartsAt ?? null);
  const endMs = parseEventDateMs(normalizedEndsAt ?? null);
  const diffMinutes =
    startMs !== null ? Math.round((startMs - now) / (1000 * 60)) : null;
  const startsInMinutes = diffMinutes !== null && diffMinutes >= 0 ? diffMinutes : null;

  let agoraStatus: AgoraEvent["agoraStatus"] = "UPCOMING";
  if (startMs !== null && endMs !== null && now >= startMs && now <= endMs) {
    agoraStatus = "LIVE";
  } else if (startsInMinutes !== null && startsInMinutes <= 90) {
    agoraStatus = "SOON";
  }

  return {
    ...item,
    startsAt: normalizedStartsAt,
    endsAt: normalizedEndsAt,
    agoraStatus,
    startsInMinutes,
    liveWindowLabel: formatLiveWindowLabel(agoraStatus, startsInMinutes),
  };
};

const filterFutureOrLive = (items: AgoraEvent[], now: number) =>
  items.filter((event) => {
    if (event.status === "CANCELLED") return false;
    const endMs = parseEventDateMs(event.endsAt ?? event.startsAt ?? null);
    if (event.status === "PAST") {
      if (!endMs || endMs < MIN_VALID_MS) return true;
      return endMs >= now;
    }
    if (!endMs || endMs < MIN_VALID_MS) return true;
    return endMs >= now;
  });

const toAgoraQueryString = (params: { cursor?: string | null; limit?: number; mode: AgoraFeedMode }) => {
  const query = new URLSearchParams();
  if (params.cursor) query.set("cursor", params.cursor);
  query.set("limit", String(params.limit ?? DEFAULT_LIMIT));
  query.set("sort", "startsAt");
  if (params.mode === "agora") query.set("date", "agora");
  return query.toString();
};

const fetchLegacyPage = async (params: { cursor?: string | null; limit?: number; mode: AgoraFeedMode }) => {
  const response = await api.request<unknown>(`/api/eventos/list?${toAgoraQueryString(params)}`, {
    headers: { Authorization: "" },
  });
  const unwrapped = unwrapApiResponse<LegacyEventListPayload>(response);
  const events = Array.isArray(unwrapped?.events) ? unwrapped.events : [];
  const pagination = unwrapped?.pagination ?? {};
  return {
    events,
    nextCursor: pagination.nextCursor ?? null,
    hasMore: typeof pagination.hasMore === "boolean" ? pagination.hasMore : pagination.nextCursor != null,
  };
};

export const fetchAgoraPage = async (
  params: Partial<AgoraPageParam> & { limit?: number } = {},
): Promise<AgoraPage> => {
  const mode: AgoraFeedMode = params.mode ?? "agora";
  const cursor = params.cursor ?? null;
  const limit = params.limit ?? DEFAULT_LIMIT;

  const page = await fetchLegacyPage({ cursor, limit, mode });
  let mapped = page.events.map((item) => toAgoraEvent(toPublicCard(item)));

  if (mode === "agora") {
    mapped = filterFutureOrLive(mapped, Date.now());
  }

  if (mode === "agora" && cursor == null && mapped.length === 0) {
    return fetchAgoraPage({ mode: "all", cursor: null, limit });
  }

  return {
    items: mapped,
    nextCursor: page.nextCursor,
    hasMore: page.hasMore,
    mode,
  };
};
