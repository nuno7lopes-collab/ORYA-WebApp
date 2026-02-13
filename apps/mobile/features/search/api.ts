import { api, unwrapApiResponse } from "../../lib/api";
import { fetchDiscoverPage } from "../discover/api";
import { DiscoverOfferCard } from "../discover/types";
import { SearchOrganization, SearchUser } from "./types";

type OfferSearchResult = {
  items: DiscoverOfferCard[];
};

const normalizeSearchTerm = (query: string) =>
  query
    .trim()
    .replace(/^@+/, "")
    .replace(/["'`“”‘’]/g, "")
    .trim();

const parseResults = <T>(payload: unknown): T[] => {
  if (!payload || typeof payload !== "object") return [];

  if ("results" in payload) {
    const results = (payload as { results?: unknown }).results;
    return Array.isArray(results) ? (results as T[]) : [];
  }

  if ("items" in payload) {
    const items = (payload as { items?: unknown }).items;
    return Array.isArray(items) ? (items as T[]) : [];
  }

  if ("data" in payload && payload.data && typeof payload.data === "object") {
    const nested = payload.data as { results?: unknown; items?: unknown };
    if (Array.isArray(nested.results)) return nested.results as T[];
    if (Array.isArray(nested.items)) return nested.items as T[];
  }

  if ("result" in payload && payload.result && typeof payload.result === "object") {
    const nested = payload.result as { results?: unknown; items?: unknown };
    if (Array.isArray(nested.results)) return nested.results as T[];
    if (Array.isArray(nested.items)) return nested.items as T[];
  }

  if (Array.isArray(payload)) {
    return payload as T[];
  }

  return [];
};

export const searchOffers = async (query: string): Promise<OfferSearchResult> => {
  const q = normalizeSearchTerm(query);
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
  const q = normalizeSearchTerm(query);
  if (!q) return [];
  const response = await api.request<unknown>(
    `/api/users/search?q=${encodeURIComponent(q)}&limit=8`,
  );
  const unwrapped = unwrapApiResponse<unknown>(response);
  return parseResults<SearchUser>(unwrapped);
};

export const searchOrganizations = async (query: string): Promise<SearchOrganization[]> => {
  const q = normalizeSearchTerm(query);
  if (!q) return [];
  const response = await api.request<unknown>(
    `/api/organizations/search?q=${encodeURIComponent(q)}&limit=8`,
  );
  const unwrapped = unwrapApiResponse<unknown>(response);
  return parseResults<SearchOrganization>(unwrapped);
};
