import { ApiError, api, unwrapApiResponse } from "../../lib/api";
import {
  InboxResponse,
  MessageInviteStatus,
  MessageInvitesResponse,
  MessageInviteAcceptResponse,
  MessageCommunityInvitesResponse,
  CommunityInviteRedeemResponse,
  MessageRequestsResponse,
  MessageRequestResponse,
  ConversationMessagesResponse,
  ConversationMessageSendResponse,
  ConversationReadResponse,
  ConversationNotificationResponse,
  MessageReactionResponse,
} from "./types";

function withB2CScope(path: string) {
  const url = new URL(path, "https://orya.local");
  url.searchParams.set("scope", "b2c");
  const query = url.searchParams.toString();
  return `${url.pathname}${query ? `?${query}` : ""}`;
}

type GrantRequesterPayload = {
  id: string;
  fullName: string | null;
  username: string | null;
  avatarUrl: string | null;
};

type GrantEventPayload = {
  id: number;
  slug: string | null;
  title: string;
  startsAt: string | null;
  endsAt: string | null;
  coverImageUrl: string | null;
  addressId: string | null;
  locationFormattedAddress: string | null;
  status: string | null;
  threadId?: string | null;
};

type GrantItemPayload = {
  id: string;
  kind: string;
  status: string;
  contextType: string | null;
  contextId: string | null;
  requesterId: string | null;
  targetUserId: string | null;
  organizationId: number | null;
  targetOrganizationId: number | null;
  conversationId: string | null;
  threadId: string | null;
  eventId: number | null;
  title: string | null;
  createdAt: string;
  updatedAt: string;
  expiresAt: string | null;
  requester: GrantRequesterPayload | null;
  event: GrantEventPayload | null;
  community?: {
    conversationId: string;
    title: string;
    coverImageUrl: string | null;
    talkPolicy: string;
    accessMode: string;
    organizationId: number;
  } | null;
};

type GrantsListPayload = {
  items?: GrantItemPayload[];
};

type ActionableGrantItem = GrantItemPayload & {
  requester: GrantRequesterPayload;
};

type AcceptGrantPayload = {
  conversationId?: string | null;
  threadId?: string | null;
  status?: string | null;
  expiresAt?: string | null;
  invite?: {
    threadId?: string | null;
    conversationId?: string | null;
    status?: string | null;
    expiresAt?: string | null;
  } | null;
};

const normalizeInviteStatus = (status: string | null | undefined): MessageInviteStatus => {
  if (status === "PENDING" || status === "ACCEPTED" || status === "EXPIRED" || status === "REVOKED") {
    return status;
  }
  return "PENDING";
};

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

  const payload = await requestMessagesApi<GrantsListPayload>(
    `${url.pathname}?${url.searchParams.toString()}`,
    accessToken,
  );

  return {
    items: (payload.items ?? [])
      .filter((item) => item.kind === "EVENT_INVITE" && Boolean(item.event))
      .map((item) => ({
        id: item.id,
        threadId: item.threadId ?? item.event?.threadId ?? "",
        conversationId: item.conversationId ?? null,
        status: normalizeInviteStatus(item.status),
        expiresAt: item.expiresAt ?? null,
        event: item.event as NonNullable<typeof item.event>,
      })),
  };
};

export const fetchMessageCommunityInvites = async (
  currentUserId?: string | null,
  accessToken?: string | null,
): Promise<MessageCommunityInvitesResponse> => {
  const path = withB2CScope("/api/messages/grants");
  const url = new URL(path, "https://orya.local");
  url.searchParams.set("kind", "COMMUNITY_INVITE");
  url.searchParams.set("status", "PENDING");

  const payload = await requestMessagesApi<GrantsListPayload>(
    `${url.pathname}?${url.searchParams.toString()}`,
    accessToken,
  );

  const items = (payload.items ?? []).filter((item) => {
    if (item.kind !== "COMMUNITY_INVITE") return false;
    if (item.status !== "PENDING") return false;
    if (!item.community || !item.conversationId) return false;
    if (
      typeof currentUserId === "string" &&
      currentUserId.trim().length > 0 &&
      item.targetUserId &&
      item.targetUserId !== currentUserId
    ) {
      return false;
    }
    return true;
  });

  return {
    items: items.map((item) => ({
      id: item.id,
      conversationId: item.conversationId as string,
      status: item.status,
      createdAt: item.createdAt,
      expiresAt: item.expiresAt ?? null,
      community: item.community ?? null,
      requester: item.requester ?? null,
    })),
  };
};

export const acceptMessageInvite = async (
  inviteId: string,
  accessToken?: string | null,
): Promise<MessageInviteAcceptResponse> => {
  const payload = await requestMessagesApi<AcceptGrantPayload>(
    withB2CScope(`/api/messages/grants/${encodeURIComponent(inviteId)}/accept`),
    accessToken,
    { method: "POST" },
  );
  const conversationId =
    typeof payload.conversationId === "string"
      ? payload.conversationId
      : typeof payload.invite?.conversationId === "string"
        ? payload.invite.conversationId
        : null;
  const threadId =
    typeof payload.threadId === "string"
      ? payload.threadId
      : typeof payload.invite?.threadId === "string"
        ? payload.invite.threadId
        : conversationId;
  const status = normalizeInviteStatus(payload.invite?.status ?? payload.status ?? "ACCEPTED");
  const expiresAt = payload.invite?.expiresAt ?? payload.expiresAt ?? null;

  return {
    conversationId,
    threadId,
    status,
    expiresAt,
  };
};

export const acceptCommunityInvite = async (
  inviteId: string,
  accessToken?: string | null,
): Promise<MessageInviteAcceptResponse> => {
  const payload = await requestMessagesApi<AcceptGrantPayload>(
    withB2CScope(`/api/messages/grants/${encodeURIComponent(inviteId)}/accept`),
    accessToken,
    { method: "POST" },
  );
  const conversationId =
    typeof payload.conversationId === "string"
      ? payload.conversationId
      : typeof payload.invite?.conversationId === "string"
        ? payload.invite.conversationId
        : null;
  return {
    conversationId,
    threadId: conversationId,
    status: payload.status ?? payload.invite?.status ?? "ACCEPTED",
    expiresAt: payload.expiresAt ?? payload.invite?.expiresAt ?? null,
  };
};

export const redeemCommunityInviteLink = async (
  token: string,
  accessToken?: string | null,
): Promise<CommunityInviteRedeemResponse> => {
  return requestMessagesApi<CommunityInviteRedeemResponse>(
    withB2CScope("/api/messages/communities/invite-links/redeem"),
    accessToken,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    },
  );
};

export const fetchMessageRequests = async (
  currentUserId?: string | null,
  accessToken?: string | null,
): Promise<MessageRequestsResponse> => {
  const path = withB2CScope("/api/messages/grants");
  const url = new URL(path, "https://orya.local");
  url.searchParams.set("kind", "USER_DM_REQUEST");
  url.searchParams.set("status", "PENDING");

  const payload = await requestMessagesApi<GrantsListPayload>(
    `${url.pathname}?${url.searchParams.toString()}`,
    accessToken,
  );

  const actionableItems = (payload.items ?? []).filter((item): item is ActionableGrantItem => {
    if (item?.kind !== "USER_DM_REQUEST") return false;
    if (item?.status !== "PENDING") return false;
    if (!item?.requester || typeof item.requester.id !== "string") return false;

    const requesterId =
      typeof item?.requesterId === "string"
        ? item.requesterId
        : typeof item?.requester?.id === "string"
          ? item.requester.id
          : null;
    const targetUserId = typeof item?.targetUserId === "string" ? item.targetUserId : null;
    if (!requesterId || !targetUserId) return false;

    if (typeof currentUserId === "string" && currentUserId.trim().length > 0) {
      if (targetUserId !== currentUserId) return false;
      if (requesterId === currentUserId) return false;
    }

    return true;
  });

  return {
    items: actionableItems.map((item) => ({
      id: item.id,
      status: item.status,
      contextType: "USER_DM",
      contextId: item.contextId ?? null,
      createdAt: item.createdAt,
      expiresAt: item.expiresAt ?? null,
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

export const declineCommunityInvite = async (
  inviteId: string,
  accessToken?: string | null,
): Promise<{ ok: boolean }> => {
  return requestMessagesApi<{ ok: boolean }>(
    withB2CScope(`/api/messages/grants/${encodeURIComponent(inviteId)}/decline`),
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

export const reactToMessage = async (
  messageId: string,
  emoji: string,
  accessToken?: string | null,
): Promise<MessageReactionResponse> => {
  return requestMessagesApi<MessageReactionResponse>(
    `/api/messages/messages/${encodeURIComponent(messageId)}/reactions?scope=b2c`,
    accessToken,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emoji }),
    },
  );
};

export const unreactToMessage = async (
  messageId: string,
  emoji: string,
  accessToken?: string | null,
): Promise<MessageReactionResponse> => {
  return requestMessagesApi<MessageReactionResponse>(
    `/api/messages/messages/${encodeURIComponent(messageId)}/reactions?scope=b2c`,
    accessToken,
    {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emoji }),
    },
  );
};
