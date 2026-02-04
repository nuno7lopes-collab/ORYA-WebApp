import { api, unwrapApiResponse } from "../../lib/api";
import { SocialFeedItem, SocialFeedPage } from "./types";

type SocialFeedPayload = {
  items?: SocialFeedItem[];
  pagination?: {
    nextCursor?: string | null;
    hasMore?: boolean;
  };
};

export const fetchSocialFeedPage = async (params?: {
  limit?: number;
  cursor?: string | null;
}): Promise<SocialFeedPage> => {
  const limit = params?.limit ?? 12;
  const search = new URLSearchParams();
  search.set("limit", String(limit));
  if (params?.cursor) {
    search.set("cursor", params.cursor);
  }

  const response = await api.request<unknown>(`/api/social/feed?${search.toString()}`);
  const unwrapped = unwrapApiResponse<SocialFeedPayload>(response);

  return {
    items: Array.isArray(unwrapped?.items) ? unwrapped.items : [],
    hasMore: Boolean(unwrapped?.pagination?.hasMore),
    nextCursor: unwrapped?.pagination?.nextCursor ?? null,
  };
};
