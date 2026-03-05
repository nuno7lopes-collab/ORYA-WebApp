import { api, unwrapApiResponse } from "../../lib/api";
import type {
  BookingCancelPreview,
  BookingChangeResponse,
  BookingClubCard,
  BookingClubsState,
  ClassEnrollmentItem,
  BookingCourtsState,
  BookingHubPayload,
  BookingItem,
} from "./types";

type BookingListPayload = {
  items?: BookingItem[];
};

type ClassEnrollmentListPayload = {
  items?: ClassEnrollmentItem[];
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

const pickCanonicalCity = (canonical?: Record<string, unknown> | null) => {
  if (!canonical) return null;
  const city = canonical.city;
  if (typeof city === "string" && city.trim()) return city.trim();
  const fallback = canonical.addressLine2;
  if (typeof fallback === "string" && fallback.trim()) return fallback.trim();
  return null;
};

const asFiniteNumber = (value: unknown) => {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
};

export const mapHubToCourtCards = (
  hub: BookingHubPayload,
  source: "FOLLOWING" | "NEARBY",
) =>
  (hub.sections?.courts ?? [])
    .filter((court) => Boolean(court.isActive))
    .map((court) => ({
      id: `${hub.organization.username ?? hub.organization.id}:${court.service.id}:${court.id}`,
      courtId: court.id,
      serviceId: court.service.id,
      orgUsername: String(hub.organization.username ?? ""),
      clubName:
        hub.organization.publicName?.trim() ||
        hub.organization.businessName?.trim() ||
        hub.organization.username?.trim() ||
        "Clube",
      clubAvatarUrl: hub.organization.brandingAvatarUrl ?? null,
      courtName: court.name?.trim() || court.service.title || "Campo",
      description: court.description ?? null,
      durationMinutes: court.service.durationMinutes,
      unitPriceCents: court.service.unitPriceCents,
      currency: court.service.currency,
      coverImageUrl: court.coverImageUrl ?? hub.organization.brandingCoverUrl ?? null,
      address: hub.organization.addressRef?.formattedAddress?.trim() || null,
      city: pickCanonicalCity(hub.organization.addressRef?.canonical ?? null),
      latitude: asFiniteNumber(hub.organization.addressRef?.lat),
      longitude: asFiniteNumber(hub.organization.addressRef?.lng),
      source,
    }))
    .filter((item) => item.orgUsername.length > 0);

export const fetchReservationHub = async (orgUsername: string): Promise<BookingHubPayload> => {
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
        return mapHubToCourtCards(hub, source);
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

const aggregateClubCards = (courts: BookingCourtsState["items"]): BookingClubCard[] => {
  const map = new Map<string, BookingClubCard>();
  courts.forEach((court) => {
    const existing = map.get(court.orgUsername);
    if (!existing) {
      map.set(court.orgUsername, {
        id: `club:${court.orgUsername}`,
        orgUsername: court.orgUsername,
        clubName: court.clubName,
        avatarUrl: court.clubAvatarUrl ?? null,
        coverImageUrl: court.coverImageUrl ?? null,
        address: court.address ?? null,
        city: court.city ?? null,
        latitude: court.latitude ?? null,
        longitude: court.longitude ?? null,
        courtsCount: 1,
        minPriceCents: Number.isFinite(court.unitPriceCents) ? court.unitPriceCents : null,
        currency: court.currency ?? null,
        source: court.source,
      });
      return;
    }
    existing.courtsCount += 1;
    if (!existing.coverImageUrl && court.coverImageUrl) {
      existing.coverImageUrl = court.coverImageUrl;
    }
    if (!existing.avatarUrl && court.clubAvatarUrl) {
      existing.avatarUrl = court.clubAvatarUrl;
    }
    if (!existing.address && court.address) {
      existing.address = court.address;
    }
    if (!existing.city && court.city) {
      existing.city = court.city;
    }
    if (existing.latitude == null && court.latitude != null) {
      existing.latitude = court.latitude;
    }
    if (existing.longitude == null && court.longitude != null) {
      existing.longitude = court.longitude;
    }
    if (Number.isFinite(court.unitPriceCents)) {
      if (existing.minPriceCents == null || court.unitPriceCents < existing.minPriceCents) {
        existing.minPriceCents = court.unitPriceCents;
      }
    }
    if (existing.source !== "FOLLOWING" && court.source === "FOLLOWING") {
      existing.source = "FOLLOWING";
    }
  });
  return Array.from(map.values()).sort((a, b) => {
    if (a.source !== b.source) return a.source === "FOLLOWING" ? -1 : 1;
    return a.clubName.localeCompare(b.clubName, "pt-PT");
  });
};

export const fetchMyBookings = async (): Promise<BookingItem[]> => {
  const response = await api.request<unknown>("/api/me/reservas?compact=1");
  const payload = unwrapApiResponse<BookingListPayload>(response);
  return Array.isArray(payload?.items) ? payload.items : [];
};

export const fetchMyClassEnrollments = async (): Promise<ClassEnrollmentItem[]> => {
  const response = await api.request<unknown>("/api/me/aulas/inscricoes");
  const payload = unwrapApiResponse<ClassEnrollmentListPayload>(response);
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

export const fetchReservableClubs = async (params: {
  userId?: string | null;
  accessToken?: string | null;
}): Promise<BookingClubsState> => {
  const courtsState = await fetchAvailableCourts(params);
  return {
    items: aggregateClubCards(courtsState.items),
    hasFollowingClubs: courtsState.hasFollowingClubs,
    hasAnyClubWithUsername: courtsState.hasAnyClubWithUsername,
    configurationIssue: courtsState.configurationIssue,
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
