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

function withB2CScope(path: string) {
  const url = new URL(path, "https://orya.local");
  url.searchParams.set("scope", "b2c");
  const query = url.searchParams.toString();
  return `${url.pathname}${query ? `?${query}` : ""}`;
}

export const fetchMessagesInbox = async (accessToken?: string | null): Promise<InboxResponse> => {
  const response = await api.requestWithAccessToken<unknown>(
    withB2CScope("/api/messages/conversations"),
    accessToken,
  );
  return unwrapApiResponse<InboxResponse>(response);
};

export const fetchMessageInvites = async (
  eventId?: number | null,
  accessToken?: string | null,
): Promise<MessageInvitesResponse> => {
  const path = withB2CScope("/api/messages/grants");
  const url = new URL(path, "https://orya.local");
  url.searchParams.set("kind", "EVENT_INVITE");
  if (typeof eventId === "number" && Number.isFinite(eventId) && eventId > 0) {
    url.searchParams.set("eventId", String(eventId));
  }

  const response = await api.requestWithAccessToken<unknown>(
    `${url.pathname}?${url.searchParams.toString()}`,
    accessToken,
  );
  const payload = unwrapApiResponse<{ items: Array<any> }>(response);

  return {
    items: (payload.items ?? []).map((item) => ({
      id: item.id,
      threadId: item.threadId ?? item.event?.threadId ?? "",
      conversationId: item.conversationId ?? null,
      status: item.status,
      expiresAt: item.expiresAt,
      event: item.event,
    })),
  };
};

export const acceptMessageInvite = async (
  inviteId: string,
  accessToken?: string | null,
): Promise<MessageInviteAcceptResponse> => {
  const response = await api.requestWithAccessToken<unknown>(
    withB2CScope(`/api/messages/grants/${encodeURIComponent(inviteId)}/accept`),
    accessToken,
    { method: "POST" },
  );
  const payload = unwrapApiResponse<any>(response);
  const threadId = String(payload.threadId ?? payload.invite?.threadId ?? payload.conversationId ?? "");
  const conversationId =
    typeof payload.conversationId === "string"
      ? payload.conversationId
      : typeof payload.invite?.conversationId === "string"
        ? payload.invite.conversationId
        : null;
  return {
    invite: {
      id: inviteId,
      threadId,
      status: payload.invite?.status ?? payload.status ?? "ACCEPTED",
      expiresAt: payload.invite?.expiresAt ?? null,
    },
    threadId,
    conversationId,
  };
};

export const fetchMessageRequests = async (
  accessToken?: string | null,
): Promise<MessageRequestsResponse> => {
  const path = withB2CScope("/api/messages/grants");
  const url = new URL(path, "https://orya.local");
  url.searchParams.set("kind", "USER_DM_REQUEST,ORG_CONTACT_REQUEST,SERVICE_REQUEST");

  const response = await api.requestWithAccessToken<unknown>(
    `${url.pathname}?${url.searchParams.toString()}`,
    accessToken,
  );
  const payload = unwrapApiResponse<{ items: Array<any> }>(response);

  return {
    items: (payload.items ?? []).map((item) => ({
      id: item.id,
      status: item.status,
      contextType:
        item.contextType === "USER_DM"
          ? "USER_DM"
          : item.kind === "ORG_CONTACT_REQUEST"
            ? "ORG_CONTACT"
            : item.kind === "SERVICE_REQUEST"
              ? "SERVICE"
              : item.contextType ?? "USER_DM",
      contextId: item.contextId ?? null,
      createdAt: item.createdAt,
      requester: item.requester,
    })),
  };
};

export const createMessageRequest = async (
  payload: { targetUserId?: string; targetOrganizationId?: number; serviceId?: number },
  accessToken?: string | null,
): Promise<MessageRequestResponse> => {
  const contextType = payload.targetUserId
    ? "USER_DM"
    : payload.targetOrganizationId
      ? "ORG_CONTACT"
      : payload.serviceId
        ? "SERVICE"
        : null;

  const response = await api.requestWithAccessToken<unknown>(
    withB2CScope("/api/messages/conversations/resolve"),
    accessToken,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contextType,
        targetUserId: payload.targetUserId,
        targetOrganizationId: payload.targetOrganizationId,
        serviceId: payload.serviceId,
      }),
    },
  );
  return unwrapApiResponse<MessageRequestResponse>(response);
};

export const acceptMessageRequest = async (
  requestId: string,
  accessToken?: string | null,
): Promise<{ conversationId: string }> => {
  const response = await api.requestWithAccessToken<unknown>(
    withB2CScope(`/api/messages/grants/${encodeURIComponent(requestId)}/accept`),
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
    withB2CScope(`/api/messages/grants/${encodeURIComponent(requestId)}/decline`),
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
  search.set("scope", "b2c");
  const query = search.toString();
  const path = query
    ? `/api/messages/conversations/${encodeURIComponent(conversationId)}/messages?${query}`
    : `/api/messages/conversations/${encodeURIComponent(conversationId)}/messages?scope=b2c`;
  const response = await api.requestWithAccessToken<unknown>(path, accessToken);
  return unwrapApiResponse<ConversationMessagesResponse>(response);
};

export const sendConversationMessage = async (
  conversationId: string,
  body: string,
  clientMessageId?: string,
  accessToken?: string | null,
): Promise<ConversationMessageSendResponse> => {
  const resolvedClientMessageId =
    typeof clientMessageId === "string" && clientMessageId.trim().length > 0
      ? clientMessageId.trim()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  const response = await api.requestWithAccessToken<unknown>(
    `/api/messages/conversations/${encodeURIComponent(conversationId)}/messages?scope=b2c`,
    accessToken,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body, clientMessageId: resolvedClientMessageId }),
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
    `/api/messages/conversations/${encodeURIComponent(conversationId)}/read?scope=b2c`,
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
    `/api/messages/conversations/${encodeURIComponent(conversationId)}/notifications?scope=b2c`,
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
    `/api/messages/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}?scope=b2c`,
    accessToken,
    { method: "DELETE" },
  );
  return unwrapApiResponse<{ ok: boolean; deletedAt: string }>(response);
};
