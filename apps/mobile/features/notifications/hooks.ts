import { useInfiniteQuery, useQuery, type QueryClient } from "@tanstack/react-query";
import { fetchNotificationsPage, fetchNotificationsUnread } from "./api";

const PAGE_SIZE = 30;

export const notificationsKeys = {
  all: ["notifications"] as const,
  feed: () => [...notificationsKeys.all, "feed"] as const,
  unread: () => [...notificationsKeys.all, "unread"] as const,
};

const INVALIDATE_COOLDOWN_MS = 450;
const lastInvalidations = {
  all: 0,
  unread: 0,
};

export const invalidateNotificationsAll = (queryClient: QueryClient) => {
  const now = Date.now();
  if (now - lastInvalidations.all < INVALIDATE_COOLDOWN_MS) return;
  if (queryClient.isFetching({ queryKey: notificationsKeys.feed() }) > 0) return;
  lastInvalidations.all = now;
  void queryClient.invalidateQueries({ queryKey: notificationsKeys.all });
};

export const invalidateNotificationsUnread = (queryClient: QueryClient) => {
  const now = Date.now();
  if (now - lastInvalidations.unread < INVALIDATE_COOLDOWN_MS) return;
  if (queryClient.isFetching({ queryKey: notificationsKeys.unread() }) > 0) return;
  lastInvalidations.unread = now;
  void queryClient.invalidateQueries({ queryKey: notificationsKeys.unread() });
};

export const useNotificationsFeed = (
  accessToken?: string | null,
  userId?: string | null,
  enabled = true,
) =>
  useInfiniteQuery({
    queryKey: [...notificationsKeys.feed(), userId ?? "anon"],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      fetchNotificationsPage({
        cursor: pageParam,
        limit: PAGE_SIZE,
      }, accessToken),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: enabled && Boolean(accessToken) && Boolean(userId),
    staleTime: 1000 * 20,
    refetchOnWindowFocus: false,
  });

export const useNotificationsUnread = (
  accessToken?: string | null,
  userId?: string | null,
  enabled = true,
) =>
  useQuery({
    queryKey: [...notificationsKeys.unread(), userId ?? "anon"],
    queryFn: () => fetchNotificationsUnread(accessToken),
    enabled: enabled && Boolean(accessToken) && Boolean(userId),
    staleTime: 1000 * 45,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
