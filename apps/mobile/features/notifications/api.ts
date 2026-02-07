import { api, ApiError, unwrapApiResponse } from "../../lib/api";
import type { NotificationsPage, NotificationsStatus, NotificationItem } from "./types";

type NotificationsPayload = {
  items?: NotificationItem[];
  nextCursor?: string | null;
  unreadCount?: number;
};

const toQuery = (opts: {
  cursor?: string | null;
  limit?: number;
  status?: NotificationsStatus;
}) => {
  const params = new URLSearchParams();
  if (opts.cursor) params.set("cursor", opts.cursor);
  params.set("limit", String(opts.limit ?? 30));
  if (opts.status) params.set("status", opts.status);
  return params.toString();
};

export const fetchNotificationsPage = async (
  opts: {
    cursor?: string | null;
    limit?: number;
    status?: NotificationsStatus;
  } = {},
): Promise<NotificationsPage> => {
  const response = await api.request<unknown>(`/api/me/notifications?${toQuery(opts)}`);
  const payload = unwrapApiResponse<NotificationsPayload>(response);
  return {
    items: Array.isArray(payload?.items) ? payload.items : [],
    nextCursor: payload?.nextCursor ?? null,
    unreadCount: Number.isFinite(payload?.unreadCount as number)
      ? Number(payload?.unreadCount)
      : 0,
  };
};

export const fetchNotificationsUnread = async (): Promise<{ unreadCount: number }> => {
  const page = await fetchNotificationsPage({ limit: 1, status: "all" });
  return { unreadCount: page.unreadCount };
};

export const markNotificationRead = async (notificationId: string) => {
  if (!notificationId) {
    throw new ApiError(400, "Notificação inválida.");
  }
  const response = await api.request<unknown>(
    `/api/me/notifications/${encodeURIComponent(notificationId)}/read`,
    { method: "POST" },
  );
  return unwrapApiResponse<{ ok?: boolean }>(response);
};

export const markAllNotificationsRead = async () => {
  const response = await api.request<unknown>("/api/notifications/mark-read", {
    method: "POST",
    body: JSON.stringify({ markAll: true }),
  });
  return unwrapApiResponse<{ ok?: boolean }>(response);
};
