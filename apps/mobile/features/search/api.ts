import { DiscoverResponseSchema, PublicEventCard } from "@orya/shared";
import { api, ApiError, unwrapApiResponse } from "../../lib/api";
import { SearchOrganization, SearchUser } from "./types";

type OfferSearchResult = {
  items: PublicEventCard[];
};

const parseResults = <T>(payload: unknown): T[] => {
  if (payload && typeof payload === "object" && "results" in payload) {
    const results = (payload as { results?: unknown }).results;
    return Array.isArray(results) ? (results as T[]) : [];
  }
  return [];
};

export const searchOffers = async (query: string): Promise<OfferSearchResult> => {
  const q = query.trim();
  if (!q) return { items: [] };

  const response = await api.request<unknown>(
    `/api/explorar/list?q=${encodeURIComponent(q)}&limit=8`,
  );
  const unwrapped = unwrapApiResponse<unknown>(response);
  const parsed = DiscoverResponseSchema.safeParse(unwrapped);
  if (!parsed.success) {
    throw new ApiError(500, "Formato inválido no search de ofertas.");
  }

  return { items: parsed.data.items };
};

export const searchUsers = async (query: string): Promise<SearchUser[]> => {
  const q = query.trim();
  if (!q) return [];
  const response = await api.request<unknown>(
    `/api/users/search?q=${encodeURIComponent(q)}&limit=8`,
  );
  const unwrapped = unwrapApiResponse<unknown>(response);
  return parseResults<SearchUser>(unwrapped);
};

export const searchOrganizations = async (query: string): Promise<SearchOrganization[]> => {
  const q = query.trim();
  if (!q) return [];
  const response = await api.request<unknown>(
    `/api/organizations/search?q=${encodeURIComponent(q)}&limit=8`,
  );
  const unwrapped = unwrapApiResponse<unknown>(response);
  return parseResults<SearchOrganization>(unwrapped);
};
