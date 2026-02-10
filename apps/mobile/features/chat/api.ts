import { api, unwrapApiResponse } from "../../lib/api";
import {
  ChatMessagesResponse,
  ChatThreadDetail,
  ChatThreadsResponse,
} from "./types";

export const fetchChatThreads = async (
  accessToken?: string | null,
): Promise<ChatThreadsResponse> => {
  const response = await api.requestWithAccessToken<unknown>("/api/chat/threads", accessToken);
  return unwrapApiResponse<ChatThreadsResponse>(response);
};

export const fetchEventChatThread = async (
  eventId: number,
  accessToken?: string | null,
): Promise<ChatThreadDetail> => {
  const response = await api.requestWithAccessToken<unknown>(
    `/api/chat/threads/event?eventId=${encodeURIComponent(eventId)}`,
    accessToken,
  );
  return unwrapApiResponse<ChatThreadDetail>(response);
};

export const fetchChatMessages = async (
  threadId: string,
  params: { limit?: number; cursor?: string | null; after?: string | null } = {},
  accessToken?: string | null,
): Promise<ChatMessagesResponse> => {
  const search = new URLSearchParams();
  if (params.limit) search.set("limit", String(params.limit));
  if (params.cursor) search.set("cursor", params.cursor);
  if (params.after) search.set("after", params.after);
  const query = search.toString();
  const path = query
    ? `/api/chat/threads/${encodeURIComponent(threadId)}/messages?${query}`
    : `/api/chat/threads/${encodeURIComponent(threadId)}/messages`;
  const response = await api.requestWithAccessToken<unknown>(path, accessToken);
  return unwrapApiResponse<ChatMessagesResponse>(response);
};

export const sendChatMessage = async (
  threadId: string,
  body: string,
  accessToken?: string | null,
): Promise<ChatMessagesResponse["items"][number]> => {
  const response = await api.requestWithAccessToken<unknown>(
    `/api/chat/threads/${encodeURIComponent(threadId)}/messages`,
    accessToken,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    },
  );
  const payload = unwrapApiResponse<{ item: ChatMessagesResponse["items"][number] }>(response);
  return payload.item;
};

export const muteEventThread = async (
  threadId: string,
  mutedUntil: string | null,
  accessToken?: string | null,
): Promise<{ ok: boolean; mutedUntil: string | null }> => {
  const response = await api.requestWithAccessToken<unknown>(
    `/api/chat/threads/${encodeURIComponent(threadId)}/notifications`,
    accessToken,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mutedUntil }),
    },
  );
  return unwrapApiResponse<{ ok: boolean; mutedUntil: string | null }>(response);
};

export const undoEventMessage = async (
  threadId: string,
  messageId: string,
  accessToken?: string | null,
): Promise<{ ok: boolean; deletedAt: string }> => {
  const response = await api.requestWithAccessToken<unknown>(
    `/api/chat/threads/${encodeURIComponent(threadId)}/messages/${encodeURIComponent(messageId)}`,
    accessToken,
    { method: "DELETE" },
  );
  return unwrapApiResponse<{ ok: boolean; deletedAt: string }>(response);
};
