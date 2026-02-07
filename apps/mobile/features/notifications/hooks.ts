import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { fetchNotificationsPage, fetchNotificationsUnread } from "./api";
import type { NotificationsStatus } from "./types";

const PAGE_SIZE = 30;

export const notificationsKeys = {
  all: ["notifications"] as const,
  feed: (status: NotificationsStatus) => [...notificationsKeys.all, "feed", status] as const,
  unread: () => [...notificationsKeys.all, "unread"] as const,
};

export const useNotificationsFeed = (status: NotificationsStatus, enabled = true) =>
  useInfiniteQuery({
    queryKey: notificationsKeys.feed(status),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      fetchNotificationsPage({
        cursor: pageParam,
        limit: PAGE_SIZE,
        status,
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
