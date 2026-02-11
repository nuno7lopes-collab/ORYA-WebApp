import { PublicEventCard } from "@orya/shared";
import { api, unwrapApiResponse } from "../../lib/api";
import {
  AgendaItem,
  ProfileAgendaStats,
  ProfileSummary,
  PublicOrganizationAgendaItem,
  PublicProfileEvents,
  PublicProfilePayload,
} from "./types";

type MePayload = {
  user?: {
    id?: string;
    email?: string | null;
  } | null;
  profile?: {
    id?: string;
    full_name?: string | null;
    username?: string | null;
    avatar_url?: string | null;
    cover_url?: string | null;
    bio?: string | null;
    padel_level?: string | null;
    onboardingDone?: boolean | null;
    onboarding_done?: boolean | null;
    favourite_categories?: string[] | null;
    visibility?: "PUBLIC" | "PRIVATE" | "FOLLOWERS" | null;
    allow_email_notifications?: boolean | null;
    allow_event_reminders?: boolean | null;
    allow_follow_requests?: boolean | null;
  } | null;
};

type AgendaPayload = {
  items?: AgendaItem[];
};

type EventLookupPayload = {
  items?: Array<{
    id: number;
    slug: string | null;
    title: string;
    startsAt: string | null;
    endsAt: string | null;
    coverImageUrl: string | null;
    locationFormattedAddress: string | null;
    status: string | null;
  }>;
};

type ExploreDetailPayload = {
  item?: PublicEventCard;
};

type PublicAgendaPayload = {
  items?: Array<{
    id?: string;
    title?: string;
    startsAt?: string;
    endsAt?: string | null;
    sourceType?: string;
    status?: string;
  }>;
};

const toDate = (value?: string | null): Date | null => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const toAgendaStats = (items: AgendaItem[]): ProfileAgendaStats => {
  const now = Date.now();
  const currentYear = new Date(now).getFullYear();
  const currentMonth = new Date(now).getMonth();
  let upcoming = 0;
  let past = 0;
  let thisMonth = 0;

  items.forEach((item) => {
    const start = toDate(item.startAt);
    if (!start) return;
    if (start.getTime() >= now) upcoming += 1;
    else past += 1;

    if (start.getFullYear() === currentYear && start.getMonth() === currentMonth) {
      thisMonth += 1;
    }
  });

  return { upcoming, past, thisMonth };
};

export const fetchProfileSummary = async (
  accessToken?: string | null,
): Promise<ProfileSummary> => {
  const response = await api.requestWithAccessToken<unknown>("/api/me", accessToken);
  const payload = unwrapApiResponse<MePayload>(response);
  const profile = payload.profile ?? null;
  const user = payload.user ?? null;
  const hasBasicProfile = Boolean(profile?.full_name && profile?.username);
  const onboardingDone =
    typeof profile?.onboardingDone === "boolean"
      ? profile.onboardingDone
      : typeof profile?.onboarding_done === "boolean"
        ? profile.onboarding_done
        : hasBasicProfile;

  return {
    id: user?.id ?? profile?.id ?? "",
    email: user?.email ?? null,
    fullName: profile?.full_name ?? null,
    username: profile?.username ?? null,
    avatarUrl: profile?.avatar_url ?? null,
    coverUrl: profile?.cover_url ?? null,
    bio: profile?.bio ?? null,
    padelLevel: profile?.padel_level ?? null,
    favouriteCategories: profile?.favourite_categories ?? undefined,
    visibility: profile?.visibility ?? undefined,
    allowEmailNotifications: profile?.allow_email_notifications ?? undefined,
    allowEventReminders: profile?.allow_event_reminders ?? undefined,
    allowFollowRequests: profile?.allow_follow_requests ?? undefined,
    onboardingDone,
  };
};

export const updateProfile = async (payload: {
  accessToken?: string | null;
  fullName: string;
  username: string;
  bio?: string | null;
  avatarUrl?: string | null;
  coverUrl?: string | null;
  padelLevel?: string | null;
  favouriteCategories?: string[];
  visibility?: "PUBLIC" | "PRIVATE" | "FOLLOWERS";
  allowEmailNotifications?: boolean;
  allowEventReminders?: boolean;
  allowFollowRequests?: boolean;
}): Promise<ProfileSummary> => {
  const response = await api.requestWithAccessToken<unknown>("/api/profiles/save-basic", payload.accessToken, {
    method: "POST",
    body: JSON.stringify({
      fullName: payload.fullName,
      username: payload.username,
      bio: payload.bio,
      avatarUrl: payload.avatarUrl,
      coverUrl: payload.coverUrl,
      padelLevel: payload.padelLevel,
      favouriteCategories: payload.favouriteCategories,
      visibility: payload.visibility,
      allowEmailNotifications: payload.allowEmailNotifications,
      allowEventReminders: payload.allowEventReminders,
      allowFollowRequests: payload.allowFollowRequests,
    }),
  });

  const data = unwrapApiResponse<unknown>(response);
  const profile =
    data && typeof data === "object" && "profile" in data
      ? ((data as { profile?: Record<string, unknown> }).profile ?? null)
      : (data as Record<string, unknown> | null);
  const profileData = (profile ?? {}) as Record<string, unknown>;

  return {
    id: String(profileData.id ?? ""),
    email: (profileData.email as string | null | undefined) ?? null,
    fullName: (profileData.fullName as string | null | undefined) ?? null,
    username: (profileData.username as string | null | undefined) ?? null,
    avatarUrl: (profileData.avatarUrl as string | null | undefined) ?? null,
    coverUrl: (profileData.coverUrl as string | null | undefined) ?? null,
    bio: (profileData.bio as string | null | undefined) ?? null,
    padelLevel: (profileData.padelLevel as string | null | undefined) ?? null,
    favouriteCategories: (profileData.favouriteCategories as string[] | undefined) ?? undefined,
    visibility: (profileData.visibility as "PUBLIC" | "PRIVATE" | "FOLLOWERS" | undefined) ?? undefined,
    allowEmailNotifications:
      (profileData.allowEmailNotifications as boolean | undefined) ?? undefined,
    allowEventReminders:
      (profileData.allowEventReminders as boolean | undefined) ?? undefined,
    allowFollowRequests:
      (profileData.allowFollowRequests as boolean | undefined) ?? undefined,
    onboardingDone: Boolean(profileData.onboardingDone ?? true),
  };
};

export const fetchProfileAgenda = async (
  accessToken?: string | null,
): Promise<{
  items: AgendaItem[];
  stats: ProfileAgendaStats;
}> => {
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const response = await api.requestWithAccessToken<unknown>(
    `/api/me/agenda?month=${month}`,
    accessToken,
  );
  const payload = unwrapApiResponse<AgendaPayload>(response);
  const items = Array.isArray(payload?.items) ? payload.items : [];

  return {
    items,
    stats: toAgendaStats(items),
  };
};

export const fetchPublicProfile = async (
  username: string,
  accessToken?: string | null,
): Promise<PublicProfilePayload> => {
  const response = await api.requestWithAccessToken<unknown>(
    `/api/public/profile?username=${encodeURIComponent(username)}`,
    accessToken,
  );
  return unwrapApiResponse<PublicProfilePayload>(response);
};

export const fetchPublicProfileEvents = async (
  username: string,
  accessToken?: string | null,
): Promise<PublicProfileEvents> => {
  const response = await api.requestWithAccessToken<unknown>(
    `/api/public/profile/events?username=${encodeURIComponent(username)}`,
    accessToken,
  );
  const payload = unwrapApiResponse<PublicProfileEvents>(response);

  const shouldHydrate = Boolean(accessToken && !payload.locked && payload.privacy?.canView !== false);
  if (!shouldHydrate) {
    return payload;
  }

  const mergeWithLookup = (
    list: PublicEventCard[],
    lookupMap: Map<number, NonNullable<EventLookupPayload["items"]>[number]>,
  ) =>
    list.map((event) => {
      const lookup = lookupMap.get(event.id);
      if (!lookup) return event;
      return {
        ...event,
        coverImageUrl: event.coverImageUrl ?? lookup.coverImageUrl ?? null,
        status: event.status ?? ((lookup.status as PublicEventCard["status"]) ?? undefined),
        location: {
          ...(event.location ?? {}),
          formattedAddress: event.location?.formattedAddress ?? lookup.locationFormattedAddress ?? null,
        },
      };
    });

  let upcoming = payload.upcoming;
  let past = payload.past;

  try {
    const ids = [...new Set([...upcoming, ...past].map((event) => event.id).filter((id) => Number.isFinite(id)))];
    if (ids.length > 0) {
      const lookupResponse = await api.requestWithAccessToken<unknown>(
        `/api/eventos/lookup?ids=${ids.join(",")}`,
        accessToken,
      );
      const lookupPayload = unwrapApiResponse<EventLookupPayload>(lookupResponse);
      const lookupMap = new Map((lookupPayload.items ?? []).map((item) => [item.id, item]));
      upcoming = mergeWithLookup(upcoming, lookupMap);
      past = mergeWithLookup(past, lookupMap);
    }
  } catch {
    // Non-critical enrichment
  }

  try {
    const featuredSlug = upcoming[0]?.slug;
    if (featuredSlug) {
      const detailResponse = await api.requestWithAccessToken<unknown>(
        `/api/explorar/eventos/${encodeURIComponent(featuredSlug)}`,
        accessToken,
      );
      const detailPayload = unwrapApiResponse<ExploreDetailPayload>(detailResponse);
      if (detailPayload?.item?.slug === featuredSlug) {
        upcoming = upcoming.map((event, index) => (index === 0 ? detailPayload.item! : event));
      }
    }
  } catch {
    // Non-critical enrichment
  }

  return {
    ...payload,
    upcoming,
    past,
  };
};

export const fetchPublicOrganizationAgenda = async (
  organizationId: number,
): Promise<PublicOrganizationAgendaItem[]> => {
  if (!Number.isFinite(organizationId) || organizationId <= 0) {
    return [];
  }
  const params = new URLSearchParams({
    organizationId: String(organizationId),
    from: new Date().toISOString(),
  });
  const response = await api.request<unknown>(`/api/public/agenda?${params.toString()}`);
  const payload = unwrapApiResponse<PublicAgendaPayload>(response);
  return (payload.items ?? []).map((item) => ({
    id: String(item.id ?? ""),
    title: item.title ?? "Agenda",
    startsAt: item.startsAt ?? new Date().toISOString(),
    endsAt: item.endsAt ?? null,
    sourceType: item.sourceType ?? "EVENT",
    status: item.status ?? "ACTIVE",
  }));
};
