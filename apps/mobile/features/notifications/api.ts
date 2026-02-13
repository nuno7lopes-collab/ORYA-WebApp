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

const requireAccessToken = (accessToken?: string | null) => {
  if (!accessToken) {
    throw new ApiError(401, "Precisas de iniciar sessão.");
  }
};

export const fetchNotificationsPage = async (
  opts: {
    cursor?: string | null;
    limit?: number;
  } = {},
  accessToken?: string | null,
): Promise<NotificationsPage> => {
  requireAccessToken(accessToken);
  const response = await api.requestWithAccessToken<unknown>(
    `/api/me/notifications/feed?${toQuery(opts)}`,
    accessToken,
  );
  const payload = unwrapApiResponse<NotificationsPayload>(response);
  return {
    items: Array.isArray(payload?.items) ? payload.items : [],
    nextCursor: payload?.nextCursor ?? null,
    unreadCount: Number.isFinite(payload?.unreadCount as number)
      ? Number(payload?.unreadCount)
      : 0,
  };
};

export const fetchNotificationsUnread = async (
  accessToken?: string | null,
): Promise<{ unreadCount: number }> => {
  const page = await fetchNotificationsPage({ limit: 1 }, accessToken);
  return { unreadCount: page.unreadCount };
};

export const fetchOrganizationInvites = async (accessToken?: string | null): Promise<OrganizationInvite[]> => {
  requireAccessToken(accessToken);
  const response = await api.requestWithAccessToken<unknown>("/api/org-hub/invites", accessToken);
  const payload = unwrapApiResponse<OrganizationInvitesPayload>(response);
  return Array.isArray(payload?.items) ? payload.items : [];
};

export const markNotificationRead = async (notificationId: string, accessToken?: string | null) => {
  if (!notificationId) {
    throw new ApiError(400, "Notificação inválida.");
  }
  requireAccessToken(accessToken);
  const response = await api.requestWithAccessToken<unknown>("/api/notifications/mark-read", accessToken, {
    method: "POST",
    body: JSON.stringify({ notificationId }),
  });
  return unwrapApiResponse<{ ok?: boolean }>(response);
};

export const markAllNotificationsRead = async (accessToken?: string | null) => {
  requireAccessToken(accessToken);
  const response = await api.requestWithAccessToken<unknown>("/api/notifications/mark-read", accessToken, {
    method: "POST",
    body: JSON.stringify({ markAll: true }),
  });
  return unwrapApiResponse<{ ok?: boolean }>(response);
};

export const muteNotificationTarget = async (
  params: { organizationId?: number | null; eventId?: number | null },
  accessToken?: string | null,
) => {
  if (!params.organizationId && !params.eventId) {
    throw new ApiError(400, "Destino inválido.");
  }
  requireAccessToken(accessToken);
  const response = await api.requestWithAccessToken<unknown>("/api/me/notifications/mute", accessToken, {
    method: "POST",
    body: JSON.stringify(params),
  });
  return unwrapApiResponse<{ ok?: boolean }>(response);
};

export const deleteNotification = async (notificationId: string, accessToken?: string | null) => {
  if (!notificationId) {
    throw new ApiError(400, "Notificação inválida.");
  }
  requireAccessToken(accessToken);
  const response = await api.requestWithAccessToken<unknown>("/api/me/notifications", accessToken, {
    method: "DELETE",
    body: JSON.stringify({ notificationId }),
  });
  return unwrapApiResponse<{ ok?: boolean }>(response);
};

export const unmuteNotificationTarget = async (
  params: { organizationId?: number | null; eventId?: number | null },
  accessToken?: string | null,
) => {
  if (!params.organizationId && !params.eventId) {
    throw new ApiError(400, "Destino inválido.");
  }
  requireAccessToken(accessToken);
  const response = await api.requestWithAccessToken<unknown>("/api/me/notifications/mute", accessToken, {
    method: "DELETE",
    body: JSON.stringify(params),
  });
  return unwrapApiResponse<{ ok?: boolean }>(response);
};

export const respondOrganizationInvite = async (
  inviteId: string,
  action: "ACCEPT" | "DECLINE",
  accessToken?: string | null,
) => {
  if (!inviteId) {
    throw new ApiError(400, "Convite inválido.");
  }
  requireAccessToken(accessToken);
  const response = await api.requestWithAccessToken<unknown>(
    "/api/org-hub/organizations/members/invites",
    accessToken,
    {
      method: "PATCH",
      body: JSON.stringify({ inviteId, action }),
    },
  );
  return unwrapApiResponse<{ ok?: boolean }>(response);
};
