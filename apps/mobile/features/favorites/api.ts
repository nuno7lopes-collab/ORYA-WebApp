import { api, unwrapApiResponse } from "../../lib/api";

export type FavoriteEntry = {
  eventId: number;
  notify: boolean;
  updatedAt: string;
};

export const fetchFavorites = async (): Promise<FavoriteEntry[]> => {
  const response = await api.request<unknown>("/api/events/favorites");
  const payload = unwrapApiResponse<{ items?: FavoriteEntry[] }>(response);
  return Array.isArray(payload?.items) ? payload.items : [];
};

export const toggleFavoriteRemote = async (eventId: number, notify = true) => {
  const response = await api.request<unknown>("/api/events/favorites/toggle", {
    method: "POST",
    body: JSON.stringify({ eventId, notify }),
  });
  return unwrapApiResponse<{ isFavorite?: boolean; favorite?: FavoriteEntry | null }>(response);
};

export const updateFavoriteNotify = async (eventId: number, notify: boolean) => {
  const response = await api.request<unknown>("/api/events/favorites/notify", {
    method: "POST",
    body: JSON.stringify({ eventId, notify }),
  });
  return unwrapApiResponse<{ favorite?: FavoriteEntry | null }>(response);
};
