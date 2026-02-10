import { api, unwrapApiResponse } from "../../lib/api";
import {
  InboxResponse,
  MessageInvitesResponse,
  MessageInviteAcceptResponse,
  MessageRequestsResponse,
  MessageRequestResponse,
  ConversationMessagesResponse,
  ConversationMessageSendResponse,
  ConversationReadResponse,
  ConversationNotificationResponse,
} from "./types";

export const fetchMessagesInbox = async (accessToken?: string | null): Promise<InboxResponse> => {
  const response = await api.requestWithAccessToken<unknown>("/api/me/messages/inbox", accessToken);
  return unwrapApiResponse<InboxResponse>(response);
};

export const fetchMessageInvites = async (
  eventId?: number | null,
  accessToken?: string | null,
): Promise<MessageInvitesResponse> => {
  const path = eventId
    ? `/api/me/messages/invites?eventId=${encodeURIComponent(eventId)}`
    : "/api/me/messages/invites";
  const response = await api.requestWithAccessToken<unknown>(path, accessToken);
  return unwrapApiResponse<MessageInvitesResponse>(response);
};

export const acceptMessageInvite = async (
  inviteId: string,
  accessToken?: string | null,
): Promise<MessageInviteAcceptResponse> => {
  const response = await api.requestWithAccessToken<unknown>(
    `/api/me/messages/invites/${encodeURIComponent(inviteId)}/accept`,
    accessToken,
    { method: "POST" },
  );
  return unwrapApiResponse<MessageInviteAcceptResponse>(response);
};

export const fetchMessageRequests = async (
  accessToken?: string | null,
): Promise<MessageRequestsResponse> => {
  const response = await api.requestWithAccessToken<unknown>("/api/me/messages/requests", accessToken);
  return unwrapApiResponse<MessageRequestsResponse>(response);
};

export const createMessageRequest = async (
  payload: { targetUserId?: string; targetOrganizationId?: number; serviceId?: number },
  accessToken?: string | null,
): Promise<MessageRequestResponse> => {
  const response = await api.requestWithAccessToken<unknown>("/api/me/messages/requests", accessToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return unwrapApiResponse<MessageRequestResponse>(response);
};

export const acceptMessageRequest = async (
  requestId: string,
  accessToken?: string | null,
): Promise<{ conversationId: string }> => {
  const response = await api.requestWithAccessToken<unknown>(
    `/api/me/messages/requests/${encodeURIComponent(requestId)}/accept`,
    accessToken,
    { method: "POST" },
  );
  return unwrapApiResponse<{ conversationId: string }>(response);
};

export const declineMessageRequest = async (
  requestId: string,
  accessToken?: string | null,
): Promise<{ ok: boolean }> => {
  const response = await api.requestWithAccessToken<unknown>(
    `/api/me/messages/requests/${encodeURIComponent(requestId)}/decline`,
    accessToken,
    { method: "POST" },
  );
  return unwrapApiResponse<{ ok: boolean }>(response);
};

export const fetchConversationMessages = async (
  conversationId: string,
  params: { limit?: number; cursor?: string | null; after?: string | null } = {},
  accessToken?: string | null,
): Promise<ConversationMessagesResponse> => {
  const search = new URLSearchParams();
  if (params.limit) search.set("limit", String(params.limit));
  if (params.cursor) search.set("cursor", params.cursor);
  if (params.after) search.set("after", params.after);
  const query = search.toString();
  const path = query
    ? `/api/me/messages/conversations/${encodeURIComponent(conversationId)}/messages?${query}`
    : `/api/me/messages/conversations/${encodeURIComponent(conversationId)}/messages`;
  const response = await api.requestWithAccessToken<unknown>(path, accessToken);
  return unwrapApiResponse<ConversationMessagesResponse>(response);
};

export const sendConversationMessage = async (
  conversationId: string,
  body: string,
  accessToken?: string | null,
): Promise<ConversationMessageSendResponse> => {
  const response = await api.requestWithAccessToken<unknown>(
    `/api/me/messages/conversations/${encodeURIComponent(conversationId)}/messages`,
    accessToken,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    },
  );
  return unwrapApiResponse<ConversationMessageSendResponse>(response);
};

export const markConversationRead = async (
  conversationId: string,
  messageId?: string | null,
  accessToken?: string | null,
): Promise<ConversationReadResponse> => {
  const response = await api.requestWithAccessToken<unknown>(
    `/api/me/messages/conversations/${encodeURIComponent(conversationId)}/read`,
    accessToken,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId: messageId ?? null }),
    },
  );
  return unwrapApiResponse<ConversationReadResponse>(response);
};

export const muteConversation = async (
  conversationId: string,
  mutedUntil: string | null,
  accessToken?: string | null,
): Promise<ConversationNotificationResponse> => {
  const response = await api.requestWithAccessToken<unknown>(
    `/api/me/messages/conversations/${encodeURIComponent(conversationId)}/notifications`,
    accessToken,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mutedUntil }),
    },
  );
  return unwrapApiResponse<ConversationNotificationResponse>(response);
};

export const undoConversationMessage = async (
  conversationId: string,
  messageId: string,
  accessToken?: string | null,
): Promise<{ ok: boolean; deletedAt: string }> => {
  const response = await api.requestWithAccessToken<unknown>(
    `/api/me/messages/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}`,
    accessToken,
    { method: "DELETE" },
  );
  return unwrapApiResponse<{ ok: boolean; deletedAt: string }>(response);
};
