import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { fetchNotificationsPage, fetchNotificationsUnread } from "./api";

const PAGE_SIZE = 30;

export const notificationsKeys = {
  all: ["notifications"] as const,
  feed: () => [...notificationsKeys.all, "feed"] as const,
  unread: () => [...notificationsKeys.all, "unread"] as const,
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
    enabled: enabled && Boolean(accessToken),
    staleTime: 1000 * 20,
  });

export const useNotificationsUnread = (
  accessToken?: string | null,
  userId?: string | null,
  enabled = true,
) =>
  useQuery({
    queryKey: [...notificationsKeys.unread(), userId ?? "anon"],
    queryFn: () => fetchNotificationsUnread(accessToken),
    enabled: enabled && Boolean(accessToken),
    staleTime: 1000 * 30,
  });
