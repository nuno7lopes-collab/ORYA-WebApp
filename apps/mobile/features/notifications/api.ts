import { api, ApiError, unwrapApiResponse } from "../../lib/api";
import type { NotificationsPage, AggregatedNotificationItem, OrganizationInvite } from "./types";

type NotificationsPayload = {
  items?: AggregatedNotificationItem[];
  nextCursor?: string | null;
  unreadCount?: number;
};

type OrganizationInvitesPayload = {
  items?: OrganizationInvite[];
};

const toQuery = (opts: {
  cursor?: string | null;
  limit?: number;
}) => {
  const params = new URLSearchParams();
  if (opts.cursor) params.set("cursor", opts.cursor);
  params.set("limit", String(opts.limit ?? 30));
  return params.toString();
};

export const fetchNotificationsPage = async (
  opts: {
    cursor?: string | null;
    limit?: number;
  } = {},
): Promise<NotificationsPage> => {
  const response = await api.request<unknown>(`/api/me/notifications/feed?${toQuery(opts)}`);
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
  const page = await fetchNotificationsPage({ limit: 1 });
  return { unreadCount: page.unreadCount };
};

export const fetchOrganizationInvites = async (): Promise<OrganizationInvite[]> => {
  const response = await api.request<unknown>("/api/organizacao/invites");
  const payload = unwrapApiResponse<OrganizationInvitesPayload>(response);
  return Array.isArray(payload?.items) ? payload.items : [];
};

export const markNotificationRead = async (notificationId: string) => {
  if (!notificationId) {
    throw new ApiError(400, "Notificação inválida.");
  }
  const response = await api.request<unknown>("/api/notifications/mark-read", {
    method: "POST",
    body: JSON.stringify({ notificationId }),
  });
  return unwrapApiResponse<{ ok?: boolean }>(response);
};

export const markAllNotificationsRead = async () => {
  const response = await api.request<unknown>("/api/notifications/mark-read", {
    method: "POST",
    body: JSON.stringify({ markAll: true }),
  });
  return unwrapApiResponse<{ ok?: boolean }>(response);
};

export const muteNotificationTarget = async (params: { organizationId?: number | null; eventId?: number | null }) => {
  if (!params.organizationId && !params.eventId) {
    throw new ApiError(400, "Destino inválido.");
  }
  const response = await api.request<unknown>("/api/me/notifications/mute", {
    method: "POST",
    body: JSON.stringify(params),
  });
  return unwrapApiResponse<{ ok?: boolean }>(response);
};

export const unmuteNotificationTarget = async (params: { organizationId?: number | null; eventId?: number | null }) => {
  if (!params.organizationId && !params.eventId) {
    throw new ApiError(400, "Destino inválido.");
  }
  const response = await api.request<unknown>("/api/me/notifications/mute", {
    method: "DELETE",
    body: JSON.stringify(params),
  });
  return unwrapApiResponse<{ ok?: boolean }>(response);
};

export const respondOrganizationInvite = async (inviteId: string, action: "ACCEPT" | "DECLINE") => {
  if (!inviteId) {
    throw new ApiError(400, "Convite inválido.");
  }
  const response = await api.request<unknown>("/api/organizacao/organizations/members/invites", {
    method: "PATCH",
    body: JSON.stringify({ inviteId, action }),
  });
  return unwrapApiResponse<{ ok?: boolean }>(response);
};
