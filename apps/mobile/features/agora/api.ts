import { PublicEventCard } from "@orya/shared";
import { api, unwrapApiResponse } from "../../lib/api";
import { AgoraEvent, AgoraTimeline } from "./types";

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
};

type LegacyEventListPayload = {
  events: LegacyEventListItem[];
};

const toPublicCard = (item: LegacyEventListItem): PublicEventCard => {
  const now = Date.now();
  const endAt = item.endDate ? new Date(item.endDate) : null;
  const startAt = item.startDate ? new Date(item.startDate) : null;
  const isPast = Boolean(endAt && Number.isFinite(endAt.getTime()) && endAt.getTime() < now);

  return {
    id: item.id,
    type: "EVENT",
    slug: item.slug,
    title: item.title,
    description: item.shortDescription,
    shortDescription: item.shortDescription,
    startsAt: item.startDate,
    endsAt: item.endDate,
    coverImageUrl: item.coverImageUrl,
    isGratis: item.isGratis,
    priceFrom: item.priceFrom,
    categories: [item.category ?? "GERAL"],
    hostName: null,
    hostUsername: null,
    status: isPast ? "PAST" : "ACTIVE",
    isHighlighted: Boolean(item.stats?.goingCount && item.stats.goingCount > 20),
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
  const start = item.startsAt ? new Date(item.startsAt) : null;
  const end = item.endsAt ? new Date(item.endsAt) : null;
  const startMs = start && Number.isFinite(start.getTime()) ? start.getTime() : null;
  const endMs = end && Number.isFinite(end.getTime()) ? end.getTime() : null;
  const startsInMinutes =
    startMs !== null ? Math.max(0, Math.round((startMs - now) / (1000 * 60))) : null;

  let agoraStatus: AgoraEvent["agoraStatus"] = "UPCOMING";
  if (startMs !== null && endMs !== null && now >= startMs && now <= endMs) {
    agoraStatus = "LIVE";
  } else if (startsInMinutes !== null && startsInMinutes <= 90) {
    agoraStatus = "SOON";
  }

  return {
    ...item,
    agoraStatus,
    startsInMinutes,
    liveWindowLabel: formatLiveWindowLabel(agoraStatus, startsInMinutes),
  };
};

export const fetchAgoraTimeline = async (): Promise<AgoraTimeline> => {
  const response = await api.request<unknown>("/api/eventos/list?limit=18");
  const unwrapped = unwrapApiResponse<LegacyEventListPayload>(response);
  const rawItems = Array.isArray(unwrapped?.events) ? unwrapped.events : [];
  const mapped = rawItems.map((item) => toAgoraEvent(toPublicCard(item)));
  const now = Date.now();
  const futureOrLive = mapped.filter((event) => {
    if (event.status === "CANCELLED" || event.status === "PAST") return false;
    if (!event.endsAt) return true;
    const end = new Date(event.endsAt).getTime();
    if (!Number.isFinite(end)) return true;
    return end >= now;
  });
  const within72h = futureOrLive.filter((event) => {
    if (!event.startsAt) return false;
    const start = new Date(event.startsAt).getTime();
    if (!Number.isFinite(start)) return false;
    const diffHours = (start - now) / (1000 * 60 * 60);
    return diffHours >= 0 && diffHours <= 72;
  });
  const later = futureOrLive.filter((event) => !within72h.includes(event));

  return {
    liveNow: futureOrLive.filter((event) => event.agoraStatus === "LIVE"),
    comingSoon: within72h.filter((event) => event.agoraStatus !== "LIVE"),
    upcoming: later.slice(0, 8),
  };
};
