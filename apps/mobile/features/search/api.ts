import { api, unwrapApiResponse } from "../../lib/api";
import { fetchDiscoverPage } from "../discover/api";
import { DiscoverOfferCard } from "../discover/types";
import { SearchOrganization, SearchUser } from "./types";

type OfferSearchResult = {
  items: DiscoverOfferCard[];
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

  const page = await fetchDiscoverPage({
    q,
    kind: "all",
    type: "all",
    limit: 8,
    cursor: null,
  });

  return { items: page.items };
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
