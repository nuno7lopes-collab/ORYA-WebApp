import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { fetchNotificationsPage, fetchNotificationsUnread } from "./api";

const PAGE_SIZE = 30;

export const notificationsKeys = {
  all: ["notifications"] as const,
  feed: () => [...notificationsKeys.all, "feed"] as const,
  unread: () => [...notificationsKeys.all, "unread"] as const,
};

export const useNotificationsFeed = (enabled = true) =>
  useInfiniteQuery({
    queryKey: notificationsKeys.feed(),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      fetchNotificationsPage({
        cursor: pageParam,
        limit: PAGE_SIZE,
      }),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled,
    staleTime: 1000 * 20,
  });

export const useNotificationsUnread = (enabled = true) =>
  useQuery({
    queryKey: notificationsKeys.unread(),
    queryFn: fetchNotificationsUnread,
    enabled,
    staleTime: 1000 * 30,
  });
