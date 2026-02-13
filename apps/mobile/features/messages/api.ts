import { ApiError, api, unwrapApiResponse } from "../../lib/api";
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

async function requestMessagesApi<T>(
  path: string,
  accessToken?: string | null,
  init?: RequestInit,
): Promise<T> {
  const headers = new Headers(init?.headers ?? undefined);
  if (accessToken && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  const raw = await api.requestRaw<unknown>(path, {
    ...init,
    headers,
  });

  if (!raw.ok && (raw.data === null || raw.data === undefined)) {
    throw new ApiError(raw.status, raw.errorText || "Erro ao carregar.");
  }

  return unwrapApiResponse<T>(raw.data, raw.status);
}

export const fetchMessagesInbox = async (accessToken?: string | null): Promise<InboxResponse> => {
  return requestMessagesApi<InboxResponse>(
    withB2CScope("/api/messages/conversations"),
    accessToken,
  );
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

  const payload = await requestMessagesApi<{ items: Array<any> }>(
    `${url.pathname}?${url.searchParams.toString()}`,
    accessToken,
  );

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
  const payload = await requestMessagesApi<any>(
    withB2CScope(`/api/messages/grants/${encodeURIComponent(inviteId)}/accept`),
    accessToken,
    { method: "POST" },
  );
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

  const payload = await requestMessagesApi<{ items: Array<any> }>(
    `${url.pathname}?${url.searchParams.toString()}`,
    accessToken,
  );

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

  return requestMessagesApi<MessageRequestResponse>(
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
};

export const acceptMessageRequest = async (
  requestId: string,
  accessToken?: string | null,
): Promise<{ conversationId: string }> => {
  return requestMessagesApi<{ conversationId: string }>(
    withB2CScope(`/api/messages/grants/${encodeURIComponent(requestId)}/accept`),
    accessToken,
    { method: "POST" },
  );
};

export const declineMessageRequest = async (
  requestId: string,
  accessToken?: string | null,
): Promise<{ ok: boolean }> => {
  return requestMessagesApi<{ ok: boolean }>(
    withB2CScope(`/api/messages/grants/${encodeURIComponent(requestId)}/decline`),
    accessToken,
    { method: "POST" },
  );
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
  return requestMessagesApi<ConversationMessagesResponse>(path, accessToken);
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
  return requestMessagesApi<ConversationMessageSendResponse>(
    `/api/messages/conversations/${encodeURIComponent(conversationId)}/messages?scope=b2c`,
    accessToken,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body, clientMessageId: resolvedClientMessageId }),
    },
  );
};

export const markConversationRead = async (
  conversationId: string,
  messageId?: string | null,
  accessToken?: string | null,
): Promise<ConversationReadResponse> => {
  return requestMessagesApi<ConversationReadResponse>(
    `/api/messages/conversations/${encodeURIComponent(conversationId)}/read?scope=b2c`,
    accessToken,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId: messageId ?? null }),
    },
  );
};

export const muteConversation = async (
  conversationId: string,
  mutedUntil: string | null,
  accessToken?: string | null,
): Promise<ConversationNotificationResponse> => {
  return requestMessagesApi<ConversationNotificationResponse>(
    `/api/messages/conversations/${encodeURIComponent(conversationId)}/notifications?scope=b2c`,
    accessToken,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mutedUntil }),
    },
  );
};

export const undoConversationMessage = async (
  conversationId: string,
  messageId: string,
  accessToken?: string | null,
): Promise<{ ok: boolean; deletedAt: string }> => {
  return requestMessagesApi<{ ok: boolean; deletedAt: string }>(
    `/api/messages/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}?scope=b2c`,
    accessToken,
    { method: "DELETE" },
  );
};
