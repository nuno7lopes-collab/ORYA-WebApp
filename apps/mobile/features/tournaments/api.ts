import { api, ApiError, unwrapApiResponse } from "../../lib/api";

const PADEL_ME_MATCHES_ENDPOINT = "/api/padel/me/matches";
const PADEL_DISCOVER_ENDPOINT = "/api/padel/discover";

export type PadelOpenPairing = {
  id: number;
  paymentMode?: string | null;
  deadlineAt?: string | null;
  isExpired?: boolean;
  openSlots?: number;
  category?: { id: number; label: string } | null;
  event?: {
    id: number;
    slug: string;
    title: string;
    startsAt?: string | null;
    locationFormattedAddress?: string | null;
    addressId?: string | null;
    coverImageUrl?: string | null;
  };
};

export type PadelStandingRow = {
  entityId: number;
  pairingId: number | null;
  playerId?: number | null;
  points: number;
  wins: number;
  draws?: number;
  losses: number;
  setsFor: number;
  setsAgainst: number;
  label?: string | null;
  players?: Array<{ id?: number | null; name: string | null; username: string | null }> | null;
};
export type PadelStandingEntityType = "PAIRING" | "PLAYER";
export type PadelStandingsPayload = {
  entityType: PadelStandingEntityType;
  rows: PadelStandingRow[];
  groups: Record<string, PadelStandingRow[]>;
};

export type PadelPairingSlot = {
  id: number;
  slotRole?: string | null;
  slotStatus?: string | null;
  paymentStatus?: string | null;
  profileId?: string | null;
  invitedUserId?: string | null;
  invitedContact?: string | null;
  ticket?: { id: number; status?: string | null; stripePaymentIntentId?: string | null } | null;
};

export type PadelMyPairing = {
  id: number;
  eventId: number;
  categoryId?: number | null;
  paymentMode?: string | null;
  pairingStatus?: string | null;
  pairingJoinMode?: string | null;
  inviteToken?: string | null;
  createdByUserId?: string | null;
  slots: PadelPairingSlot[];
  event?: {
    id: number;
    slug: string;
    title?: string | null;
    organizationId?: number | null;
    templateType?: string | null;
  };
  category?: { label?: string | null } | null;
  inviteEligibility?: { ok: boolean; reason?: string; missing?: Record<string, boolean> } | null;
};

export type PadelMatch = Record<string, any>;

export type PadelDiscoverItem = {
  id: number;
  slug: string | null;
  title: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  coverImageUrl?: string | null;
  locationFormattedAddress?: string | null;
  addressId?: string | null;
  priceFrom?: number | null;
  organizationName?: string | null;
  format?: string | null;
  eligibility?: string | null;
  v2Enabled?: boolean | null;
  splitDeadlineHours?: number | null;
  competitionState?: string | null;
  levels?: Array<{ id: number; label: string }> | null;
};

export type PadelMeSummary = {
  profile: {
    id: string;
    fullName: string | null;
    username: string | null;
    avatarUrl: string | null;
    gender: string | null;
    padelLevel: string | null;
    padelPreferredSide: string | null;
    padelClubName: string | null;
  } | null;
  onboarding: { missing: Record<string, boolean>; completed: boolean };
  stats: {
    matchesPlayed: number;
    wins: number;
    losses: number;
    winRate: number;
    tournaments: number;
    pairingsActive: number;
    waitlistCount: number;
  };
  pairings: Array<Record<string, any>>;
  waitlist: Array<Record<string, any>>;
};

export type PadelMeMatch = {
  id: number;
  status: string | null;
  startTime?: string | null;
  plannedStartAt?: string | null;
  plannedEndAt?: string | null;
  courtName?: string | null;
  pairingSide?: "A" | "B" | null;
  winnerSide?: "A" | "B" | null;
  isWinner?: boolean | null;
  scoreSets?: unknown;
  score?: unknown;
  event?: {
    id: number;
    title: string | null;
    slug: string | null;
    startsAt?: string | null;
    endsAt?: string | null;
    coverImageUrl?: string | null;
  } | null;
  category?: { id: number; label: string | null } | null;
};

export type PadelRankingRow = {
  position: number;
  points: number;
  player: { id: number; fullName: string | null; level: string | null };
};

export type PadelHistoryRow = {
  id: number;
  organizationId: number;
  eventId: number;
  categoryId: number | null;
  playerProfileId: number;
  finalPosition: number | null;
  wonTitle: boolean;
  computedAt: string | null;
  event: {
    id: number;
    title: string | null;
    slug: string | null;
    startsAt?: string | null;
    endsAt?: string | null;
  } | null;
  category?: { id: number; label: string | null } | null;
  partner?: { id: number; name: string | null } | null;
  bracketSnapshot?: Record<string, unknown> | null;
};

export type PublicTournamentListItem = {
  id: number;
  slug: string | null;
  title: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  tournament?: { id: number; format: string | null } | null;
};

export type PublicTournamentPulse = {
  list: PublicTournamentListItem[];
  detail?: Record<string, unknown> | null;
  structure?: Record<string, unknown> | null;
  live?: Record<string, unknown> | null;
};

const parseItems = <T>(payload: unknown, key: string): T[] => {
  if (!payload || typeof payload !== "object") return [];
  const raw = (payload as Record<string, unknown>)[key];
  return Array.isArray(raw) ? (raw as T[]) : [];
};

export const fetchPadelStandings = async (
  eventId: number,
  categoryId?: number | null,
): Promise<PadelStandingsPayload> => {
  if (!Number.isFinite(eventId)) {
    throw new ApiError(400, "Evento inválido.");
  }
  const query = new URLSearchParams({ eventId: String(eventId) });
  if (Number.isFinite(categoryId)) query.set("categoryId", String(categoryId));
  const response = await api.request<unknown>(`/api/padel/standings?${query.toString()}`);
  const unwrapped = unwrapApiResponse<{
    entityType?: string;
    rows?: PadelStandingRow[];
    groups?: Record<string, PadelStandingRow[]>;
  }>(response);
  return {
    entityType: unwrapped.entityType === "PLAYER" ? "PLAYER" : "PAIRING",
    rows: Array.isArray(unwrapped.rows) ? unwrapped.rows : [],
    groups: unwrapped.groups ?? {},
  };
};

export const fetchPadelMatches = async (
  eventId: number,
  categoryId?: number | null,
): Promise<PadelMatch[]> => {
  if (!Number.isFinite(eventId)) {
    throw new ApiError(400, "Evento inválido.");
  }
  const query = new URLSearchParams({ eventId: String(eventId) });
  if (Number.isFinite(categoryId)) query.set("categoryId", String(categoryId));
  const response = await api.request<unknown>(`/api/padel/matches?${query.toString()}`);
  const unwrapped = unwrapApiResponse<{ items?: PadelMatch[] }>(response);
  return parseItems<PadelMatch>(unwrapped, "items");
};

export const fetchOpenPairings = async (
  eventId: number,
  categoryId?: number | null,
): Promise<PadelOpenPairing[]> => {
  if (!Number.isFinite(eventId)) {
    throw new ApiError(400, "Evento inválido.");
  }
  const query = new URLSearchParams({ eventId: String(eventId) });
  if (Number.isFinite(categoryId)) query.set("categoryId", String(categoryId));
  const response = await api.request<unknown>(`/api/padel/public/open-pairings?${query.toString()}`);
  const unwrapped = unwrapApiResponse<{ items?: PadelOpenPairing[] }>(response);
  return parseItems<PadelOpenPairing>(unwrapped, "items");
};

export const fetchMyPairings = async (
  eventId?: number | null,
): Promise<PadelMyPairing[]> => {
  const params = new URLSearchParams();
  if (Number.isFinite(eventId)) params.set("eventId", String(eventId));
  const response = await api.request<unknown>(
    `/api/padel/pairings/my${params.toString() ? `?${params.toString()}` : ""}`,
  );
  const unwrapped = unwrapApiResponse<{ pairings?: PadelMyPairing[] }>(response);
  return parseItems<PadelMyPairing>(unwrapped, "pairings");
};

export const createPairing = async (payload: {
  eventId: number;
  categoryId?: number | null;
  paymentMode: "FULL" | "SPLIT";
  pairingJoinMode?: "INVITE_PARTNER" | "LOOKING_FOR_PARTNER";
  invitedContact?: string | null;
  targetUserId?: string | null;
  isPublicOpen?: boolean;
}): Promise<{ pairing?: PadelMyPairing | null; inviteSent?: boolean; slotId?: number | null; waitlist?: boolean }> => {
  const response = await api.request<unknown>("/api/padel/pairings", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return unwrapApiResponse(response) as {
    pairing?: PadelMyPairing | null;
    inviteSent?: boolean;
    slotId?: number | null;
    waitlist?: boolean;
  };
};

export const joinOpenPairing = async (pairingId: number) => {
  const response = await api.request<unknown>("/api/padel/pairings/open", {
    method: "POST",
    body: JSON.stringify({ pairingId }),
  });
  return unwrapApiResponse(response);
};

export const acceptInvite = async (pairingId: number) => {
  const response = await api.request<unknown>(`/api/padel/pairings/${pairingId}/accept`, {
    method: "POST",
  });
  return unwrapApiResponse(response);
};

export const declineInvite = async (pairingId: number) => {
  const response = await api.request<unknown>(`/api/padel/pairings/${pairingId}/decline`, {
    method: "POST",
  });
  return unwrapApiResponse(response);
};

export const fetchPadelSummary = async (): Promise<PadelMeSummary> => {
  const response = await api.request<unknown>("/api/padel/me/summary");
  return unwrapApiResponse(response) as PadelMeSummary;
};

export const fetchPadelMyMatches = async (params?: {
  scope?: "all" | "upcoming" | "past";
  limit?: number;
}): Promise<PadelMeMatch[]> => {
  const query = new URLSearchParams();
  if (params?.scope) query.set("scope", params.scope);
  if (typeof params?.limit === "number") query.set("limit", String(params.limit));
  const response = await api.request<unknown>(
    `${PADEL_ME_MATCHES_ENDPOINT}${query.toString() ? `?${query.toString()}` : ""}`,
  );
  const unwrapped = unwrapApiResponse<{ items?: PadelMeMatch[] }>(response);
  return parseItems<PadelMeMatch>(unwrapped, "items");
};

export const fetchPadelDiscover = async (params?: {
  q?: string;
  date?: string;
  limit?: number;
}): Promise<{ items: PadelDiscoverItem[]; levels: Array<{ id: number; label: string }> }> => {
  const query = new URLSearchParams();
  if (params?.q) query.set("q", params.q);
  if (params?.date) query.set("date", params.date);
  if (typeof params?.limit === "number") query.set("limit", String(params.limit));
  const response = await api.request<unknown>(
    `${PADEL_DISCOVER_ENDPOINT}${query.toString() ? `?${query.toString()}` : ""}`,
  );
  const unwrapped = unwrapApiResponse<{ items?: PadelDiscoverItem[]; levels?: Array<{ id: number; label: string }> }>(response);
  return {
    items: parseItems<PadelDiscoverItem>(unwrapped, "items"),
    levels: Array.isArray(unwrapped.levels) ? unwrapped.levels : [],
  };
};

export const fetchPadelRankings = async (params?: {
  scope?: "global" | "organization";
  limit?: number;
  periodDays?: number;
  tier?: string;
  clubId?: number;
  city?: string;
}): Promise<PadelRankingRow[]> => {
  const query = new URLSearchParams();
  if (params?.scope) query.set("scope", params.scope);
  if (typeof params?.limit === "number") query.set("limit", String(params.limit));
  if (typeof params?.periodDays === "number") query.set("periodDays", String(params.periodDays));
  if (params?.tier) query.set("tier", params.tier);
  if (typeof params?.clubId === "number") query.set("clubId", String(params.clubId));
  if (params?.city) query.set("city", params.city);
  const response = await api.request<unknown>(
    `/api/padel/rankings${query.toString() ? `?${query.toString()}` : ""}`,
  );
  const unwrapped = unwrapApiResponse<{ items?: PadelRankingRow[] }>(response);
  return parseItems<PadelRankingRow>(unwrapped, "items");
};

export const fetchPadelHistory = async (): Promise<{ titles: PadelHistoryRow[]; history: PadelHistoryRow[] }> => {
  const response = await api.request<unknown>("/api/padel/me/history");
  const unwrapped = unwrapApiResponse<{ titles?: PadelHistoryRow[]; history?: PadelHistoryRow[] }>(response);
  return {
    titles: parseItems<PadelHistoryRow>(unwrapped, "titles"),
    history: parseItems<PadelHistoryRow>(unwrapped, "history"),
  };
};

export const fetchTournamentsList = async (limit = 12): Promise<PublicTournamentListItem[]> => {
  const query = new URLSearchParams();
  query.set("limit", String(Math.max(1, Math.min(200, Math.floor(limit)))));
  const response = await api.request<unknown>(`/api/tournaments/list?${query.toString()}`);
  const unwrapped = unwrapApiResponse<{ tournaments?: PublicTournamentListItem[] }>(response);
  return parseItems<PublicTournamentListItem>(unwrapped, "tournaments");
};

export const fetchTournamentPublic = async (eventId: number) => {
  if (!Number.isFinite(eventId) || eventId <= 0) {
    throw new ApiError(400, "Torneio inválido.");
  }
  const response = await api.request<unknown>(`/api/tournaments/${eventId}`);
  const unwrapped = unwrapApiResponse<{ tournament?: Record<string, unknown> }>(response);
  return unwrapped.tournament ?? null;
};

export const fetchTournamentStructure = async (eventId: number) => {
  if (!Number.isFinite(eventId) || eventId <= 0) {
    throw new ApiError(400, "Torneio inválido.");
  }
  const response = await api.request<unknown>(`/api/tournaments/${eventId}/structure`);
  const unwrapped = unwrapApiResponse<{ tournament?: Record<string, unknown> }>(response);
  return unwrapped.tournament ?? null;
};

export const fetchTournamentLive = async (slug: string) => {
  const safeSlug = slug?.trim();
  if (!safeSlug) {
    throw new ApiError(400, "Slug inválido.");
  }
  const response = await api.request<unknown>(`/api/tournaments/${encodeURIComponent(safeSlug)}/live`);
  const unwrapped = unwrapApiResponse<{ tournament?: Record<string, unknown> }>(response);
  return unwrapped.tournament ?? null;
};

export const fetchPublicTournamentPulse = async (): Promise<PublicTournamentPulse> => {
  const list = await fetchTournamentsList(8);
  const featured = list.find((item) => Number.isFinite(item.id) && item.id > 0) ?? null;
  if (!featured) return { list };

  const [detail, structure, live] = await Promise.allSettled([
    fetchTournamentPublic(featured.id),
    fetchTournamentStructure(featured.id),
    featured.slug ? fetchTournamentLive(featured.slug) : Promise.resolve(null),
  ]);

  return {
    list,
    detail: detail.status === "fulfilled" ? detail.value : null,
    structure: structure.status === "fulfilled" ? structure.value : null,
    live: live.status === "fulfilled" ? live.value : null,
  };
};
