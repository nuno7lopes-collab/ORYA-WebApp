import { api, ApiError, unwrapApiResponse } from "../../lib/api";

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
  pairingId: number;
  points: number;
  wins: number;
  losses: number;
  setsFor: number;
  setsAgainst: number;
  label?: string | null;
  players?: Array<{ name: string | null; username: string | null }> | null;
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

const parseItems = <T>(payload: unknown, key: string): T[] => {
  if (!payload || typeof payload !== "object") return [];
  const raw = (payload as Record<string, unknown>)[key];
  return Array.isArray(raw) ? (raw as T[]) : [];
};

export const fetchPadelStandings = async (
  eventId: number,
  categoryId?: number | null,
): Promise<Record<string, PadelStandingRow[]>> => {
  if (!Number.isFinite(eventId)) {
    throw new ApiError(400, "Evento inválido.");
  }
  const query = new URLSearchParams({ eventId: String(eventId) });
  if (Number.isFinite(categoryId)) query.set("categoryId", String(categoryId));
  const response = await api.request<unknown>(`/api/padel/standings?${query.toString()}`);
  const unwrapped = unwrapApiResponse<{ standings?: Record<string, PadelStandingRow[]> }>(response);
  return unwrapped.standings ?? {};
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
