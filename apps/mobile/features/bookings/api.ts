import { api, unwrapApiResponse } from "../../lib/api";
import type {
  BookingCancelPreview,
  BookingChangeResponse,
  BookingCourtsState,
  BookingHubPayload,
  BookingItem,
} from "./types";

type BookingListPayload = {
  items?: BookingItem[];
};

type FollowListItem = {
  username?: string | null;
  kind?: "user" | "organization";
};

type FollowListPayload = {
  items?: FollowListItem[];
};

type PublicClubPayload = {
  items?: Array<{
    organizationUsername?: string | null;
  }>;
};

const normalizeOrgUsername = (value: unknown) => {
  const username = String(value ?? "").trim().toLowerCase();
  return username.length > 0 ? username : null;
};

const toCourtCards = (
  hub: BookingHubPayload,
  source: "FOLLOWING" | "NEARBY",
) =>
  (hub.sections?.courts ?? [])
    .filter((court) => Boolean(court.isActive))
    .map((court) => ({
      id: `${hub.organization.username ?? hub.organization.id}:${court.service.id}:${court.id}`,
      serviceId: court.service.id,
      orgUsername: String(hub.organization.username ?? ""),
      clubName:
        hub.organization.publicName?.trim() ||
        hub.organization.businessName?.trim() ||
        hub.organization.username?.trim() ||
        "Clube",
      courtName: court.name?.trim() || court.service.title || "Campo",
      description: court.description ?? null,
      durationMinutes: court.service.durationMinutes,
      unitPriceCents: court.service.unitPriceCents,
      currency: court.service.currency,
      coverImageUrl: court.coverImageUrl ?? null,
      source,
    }))
    .filter((item) => item.orgUsername.length > 0);

const fetchReservationHub = async (orgUsername: string): Promise<BookingHubPayload> => {
  const response = await api.request<unknown>(
    `/api/public/org/${encodeURIComponent(orgUsername)}/reservas/hub`,
  );
  return unwrapApiResponse<BookingHubPayload>(response);
};

const fetchFollowingOrganizations = async (
  userId: string,
  accessToken?: string | null,
): Promise<string[]> => {
  const response = await api.requestWithAccessToken<unknown>(
    `/api/social/following?userId=${encodeURIComponent(userId)}&limit=40&includeOrganizations=true`,
    accessToken,
  );
  const payload = unwrapApiResponse<FollowListPayload>(response);
  const usernames = new Set<string>();
  for (const item of payload.items ?? []) {
    if (item.kind !== "organization") continue;
    const normalized = normalizeOrgUsername(item.username);
    if (normalized) usernames.add(normalized);
  }
  return Array.from(usernames);
};

const fetchNearbyOrganizationUsernames = async (): Promise<string[]> => {
  const response = await api.request<unknown>("/api/padel/public/clubs?includeCourts=1&limit=24");
  const payload = unwrapApiResponse<PublicClubPayload>(response);
  const usernames = new Set<string>();
  for (const item of payload.items ?? []) {
    const normalized = normalizeOrgUsername(item.organizationUsername);
    if (normalized) usernames.add(normalized);
  }
  return Array.from(usernames);
};

const loadCourtsFromOrganizations = async (
  usernames: string[],
  source: "FOLLOWING" | "NEARBY",
) => {
  let configurationIssue: BookingCourtsState["configurationIssue"] = null;
  const responses = await Promise.all(
    usernames.map(async (username) => {
      try {
        const hub = await fetchReservationHub(username);
        return toCourtCards(hub, source);
      } catch (error: unknown) {
        const code =
          typeof error === "object" &&
          error &&
          "code" in error &&
          typeof (error as { code?: unknown }).code === "string"
            ? String((error as { code: string }).code).trim().toUpperCase()
            : null;
        if (code === "COURT_CONFIG_MISSING") {
          configurationIssue = "COURT_CONFIG_MISSING";
        }
        return [];
      }
    }),
  );
  const merged = responses.flat();
  const unique = new Map<string, (typeof merged)[number]>();
  merged.forEach((item) => {
    if (!unique.has(item.id)) unique.set(item.id, item);
  });
  return {
    items: Array.from(unique.values()),
    configurationIssue,
  };
};

export const fetchMyBookings = async (): Promise<BookingItem[]> => {
  const response = await api.request<unknown>("/api/me/reservas?compact=1");
  const payload = unwrapApiResponse<BookingListPayload>(response);
  return Array.isArray(payload?.items) ? payload.items : [];
};

export const fetchAvailableCourts = async (params: {
  userId?: string | null;
  accessToken?: string | null;
}): Promise<BookingCourtsState> => {
  const loadNearbySafe = async () => {
    try {
      return await fetchNearbyOrganizationUsernames();
    } catch {
      return [] as string[];
    }
  };
  let followingUsernames: string[] = [];
  if (params.userId) {
    try {
      followingUsernames = await fetchFollowingOrganizations(params.userId, params.accessToken);
    } catch {
      followingUsernames = [];
    }
  }
  const hasFollowingClubs = followingUsernames.length > 0;

  if (hasFollowingClubs) {
    const preferred = await loadCourtsFromOrganizations(
      followingUsernames.slice(0, 6),
      "FOLLOWING",
    );
    if (preferred.items.length > 0) {
      return {
        items: preferred.items.slice(0, 10),
        hasFollowingClubs: true,
        hasAnyClubWithUsername: true,
        configurationIssue: preferred.configurationIssue,
      };
    }
    const nearbyUsernames = await loadNearbySafe();
    const nearby = await loadCourtsFromOrganizations(nearbyUsernames.slice(0, 6), "NEARBY");
    return {
      items: nearby.items.slice(0, 10),
      hasFollowingClubs: true,
      hasAnyClubWithUsername: true,
      configurationIssue: preferred.configurationIssue ?? nearby.configurationIssue,
    };
  }

  const nearbyUsernames = await loadNearbySafe();
  const nearby = await loadCourtsFromOrganizations(nearbyUsernames.slice(0, 8), "NEARBY");
  return {
    items: nearby.items.slice(0, 10),
    hasFollowingClubs: false,
    hasAnyClubWithUsername: nearbyUsernames.length > 0,
    configurationIssue: nearby.configurationIssue,
  };
};

export const previewBookingCancellation = async (
  bookingId: number,
): Promise<BookingCancelPreview> => {
  const response = await api.request<unknown>(`/api/me/reservas/${bookingId}/cancel/preview`, {
    method: "POST",
  });
  return unwrapApiResponse<BookingCancelPreview>(response);
};

export const cancelBooking = async (bookingId: number, reason?: string | null) => {
  const body = reason?.trim()
    ? JSON.stringify({
        reason: reason.trim(),
      })
    : undefined;
  const response = await api.request<unknown>(`/api/me/reservas/${bookingId}/cancel`, {
    method: "POST",
    ...(body ? { body } : {}),
  });
  return unwrapApiResponse(response);
};

export const respondBookingChangeRequest = async (params: {
  bookingId: number;
  requestId: number;
  action: "ACCEPT" | "DECLINE";
}): Promise<BookingChangeResponse> => {
  const response = await api.request<unknown>(`/api/me/reservas/${params.bookingId}/reschedule/respond`, {
    method: "POST",
    body: JSON.stringify({
      requestId: params.requestId,
      action: params.action,
    }),
  });
  return unwrapApiResponse<BookingChangeResponse>(response);
};
