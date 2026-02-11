"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { computeBlobSha256Hex } from "@/lib/chat/attachmentChecksum";
import { useUser } from "@/app/hooks/useUser";
import { getOrganizationIdFromBrowser, parseOrganizationId } from "@/lib/organizationIdUtils";
import type {
  Attachment,
  ChatEvent,
  ComposerAttachment,
  ConversationItem,
  ConversationPreview,
  OrganizationMemberDirectoryItem,
  OrganizationMembersResponse,
  MemberReadState,
  Message,
  MessagePreview,
  MessagesResponse,
  ConversationsResponse,
  Reaction,
  ReplyPreview,
} from "./chat-preview.types";

const WS_PING_INTERVAL_MS = 25000;
const ONLINE_WINDOW_MS = 5 * 60 * 1000;
const WS_PROTOCOL_BASE = "orya-chat.v1";
const WS_AUTH_PROTOCOL_PREFIX = "orya-chat.auth.";

type PendingMessage = {
  id: string;
  conversationId: string;
  body: string;
  createdAt: string;
  attachments: ComposerAttachment[];
  replyTo?: ReplyPreview | null;
  status?: "sending" | "failed";
  error?: string;
};

type CreateConversationPayload =
  | {
      type: "DIRECT";
      userId: string;
    }
  | {
      type: "GROUP";
      title: string;
      memberIds: string[];
    };

const fetcher = async <T,>(url: string, options?: RequestInit): Promise<T> => {
  const res = await fetch(url, options);
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(json?.error || "Erro ao carregar.");
  }
  return json as T;
};

function formatTimeLabel(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const diffDays = Math.round((startOfToday - startOfDate) / (24 * 60 * 60 * 1000));
  if (diffDays === 0) {
    return new Intl.DateTimeFormat("pt-PT", { hour: "2-digit", minute: "2-digit" }).format(date);
  }
  if (diffDays === 1) return "Ontem";
  return new Intl.DateTimeFormat("pt-PT", { day: "2-digit", month: "short" }).format(date);
}

function formatMessageTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-PT", { hour: "2-digit", minute: "2-digit" }).format(date);
}

function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildMentionTokens(username: string | null, fullName: string | null) {
  const tokens = new Set<string>();
  if (username) {
    tokens.add(`@${username.trim()}`);
  }
  if (fullName) {
    const cleaned = fullName.trim();
    if (cleaned) {
      tokens.add(`@${cleaned}`);
      const first = cleaned.split(/\s+/)[0];
      if (first) tokens.add(`@${first}`);
    }
  }
  return Array.from(tokens)
    .map((token) => token.trim())
    .filter((token) => token.length > 1);
}

function hasMention(text: string | null | undefined, tokens: string[]) {
  if (!text || tokens.length === 0) return false;
  const normalized = text.toLowerCase();
  return tokens.some((token) => {
    const value = token.toLowerCase();
    if (!value) return false;
    if (!normalized.includes(value)) return false;
    const pattern = new RegExp(`(^|\\s)${escapeRegex(value)}(?=\\s|$)`, "i");
    return pattern.test(text);
  });
}

function resolveAttachmentTitle(attachment: Attachment) {
  const metadata = attachment.metadata && typeof attachment.metadata === "object" ? attachment.metadata : null;
  const name = metadata && typeof metadata.name === "string" ? metadata.name : null;
  if (name) return name;
  if (attachment.type === "IMAGE") return "Imagem";
  if (attachment.type === "VIDEO") return "Video";
  return "Ficheiro";
}

function resolveAttachmentMeta(attachment: Attachment) {
  const metadata = attachment.metadata && typeof attachment.metadata === "object" ? attachment.metadata : null;
  const name = metadata && typeof metadata.name === "string" ? metadata.name : "";
  const extension = name ? name.split(".").pop()?.toUpperCase() ?? "" : "";
  const sizeLabel = formatFileSize(attachment.size);
  if (extension && sizeLabel) return `${extension} ${sizeLabel}`;
  return sizeLabel || extension || undefined;
}

function sortMessages(items: Message[]) {
  return [...items].sort((a, b) => {
    const timeA = new Date(a.createdAt).getTime();
    const timeB = new Date(b.createdAt).getTime();
    if (timeA !== timeB) return timeA - timeB;
    return a.id.localeCompare(b.id);
  });
}

function hasUnreadMention({
  messages,
  unreadCount,
  lastReadMessageId,
  mentionTokens,
  viewerId,
}: {
  messages: Message[];
  unreadCount: number;
  lastReadMessageId: string | null;
  mentionTokens: string[];
  viewerId: string | null;
}) {
  if (unreadCount <= 0 || mentionTokens.length === 0 || messages.length === 0) return false;
  let candidates = messages;
  if (lastReadMessageId) {
    const idx = messages.findIndex((entry) => entry.id === lastReadMessageId);
    if (idx >= 0) {
      candidates = messages.slice(idx + 1);
    } else {
      candidates = messages.slice(Math.max(messages.length - unreadCount, 0));
    }
  } else {
    candidates = messages.slice(Math.max(messages.length - unreadCount, 0));
  }
  return candidates.some(
    (message) =>
      message.sender?.id !== viewerId &&
      hasMention(message.body ?? null, mentionTokens),
  );
}

function isMessageReadBy(member: MemberReadState, message: Message) {
  if (!member.lastReadAt || !member.lastReadMessageId) return false;
  const readTime = new Date(member.lastReadAt).getTime();
  const messageTime = new Date(message.createdAt).getTime();
  if (!Number.isFinite(readTime) || !Number.isFinite(messageTime)) return false;
  if (readTime > messageTime) return true;
  if (readTime < messageTime) return false;
  return member.lastReadMessageId >= message.id;
}

function resolveMemberName(member: {
  fullName: string | null;
  username: string | null;
}) {
  return member.fullName?.trim() || (member.username ? `@${member.username}` : "Utilizador");
}

function mapReactions(reactions: Reaction[] | undefined, viewerId: string | null) {
  if (!reactions || reactions.length === 0) return undefined;
  const map = new Map<string, { label: string; count: number; active?: boolean }>();
  reactions.forEach((reaction) => {
    const existing = map.get(reaction.emoji) ?? { label: reaction.emoji, count: 0, active: false };
    existing.count += 1;
    if (viewerId && reaction.userId === viewerId) {
      existing.active = true;
    }
    map.set(reaction.emoji, existing);
  });
  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}

function mapMessageToPreview({
  message,
  viewerId,
  members,
}: {
  message: Message;
  viewerId: string | null;
  members: MemberReadState[];
}): MessagePreview {
  const isSelf = Boolean(viewerId && message.sender?.id === viewerId);
  const authorId = message.sender?.id ?? (message.kind === "SYSTEM" ? "system" : undefined);
  const author = message.sender
    ? resolveMemberName({ fullName: message.sender.fullName, username: message.sender.username })
    : "Sistema";
  const attachments =
    message.attachments && message.attachments.length > 0
      ? message.attachments.map((attachment) => ({
          id: attachment.id,
          kind: (attachment.type === "IMAGE" ? "image" : "file") as "image" | "file" | "link",
          title: resolveAttachmentTitle(attachment),
          meta: resolveAttachmentMeta(attachment),
          url: attachment.url,
        }))
      : undefined;
  const reactions = mapReactions(message.reactions, viewerId);
  const replyTo =
    message.replyTo && message.replyTo.id
      ? {
          id: message.replyTo.id,
          author: (() => {
            const replyMember = members.find((member) => member.userId === message.replyTo?.senderId);
            if (replyMember) {
              return resolveMemberName({
                fullName: replyMember.profile.fullName,
                username: replyMember.profile.username,
              });
            }
            return "Utilizador";
          })(),
          text: message.replyTo.body ?? "Mensagem",
        }
      : undefined;
  let status: MessagePreview["status"];
  if (isSelf) {
    const others = members.filter((member) => member.userId !== viewerId);
    if (others.length === 0) {
      status = "sent";
    } else {
      const readByAll = others.every((member) => isMessageReadBy(member, message));
      status = readByAll ? "read" : "delivered";
    }
  }

  return {
    id: message.id,
    author,
    authorId,
    isSelf,
    text: message.body ?? "",
    time: formatMessageTime(message.createdAt),
    createdAt: message.createdAt,
    kind: message.kind ?? "TEXT",
    status,
    reactions,
    attachments,
    replyTo,
    edited: Boolean(message.editedAt),
  };
}

function mapPendingToPreview(
  pending: PendingMessage,
  authorLabel: string,
  authorId: string | null,
): MessagePreview {
  const attachments =
    pending.attachments.length > 0
      ? pending.attachments.map((attachment) => ({
          id: attachment.id,
          kind: attachment.kind as "file" | "image" | "link",
          title: attachment.title,
          meta: attachment.meta,
          urlLabel: attachment.urlLabel,
          url: attachment.url,
        }))
      : undefined;
  return {
    id: pending.id,
    author: authorLabel,
    authorId: authorId ?? "self",
    isSelf: true,
    text: pending.body,
    time: formatMessageTime(pending.createdAt),
    createdAt: pending.createdAt,
    status: pending.status ?? "sending",
    attachments,
    replyTo: pending.replyTo ?? undefined,
    error: pending.error,
  };
}

function buildConversationPreview({
  conversation,
  pinnedMessage,
  viewerId,
  hasMention,
}: {
  conversation: ConversationItem;
  pinnedMessage?: ReplyPreview | null;
  viewerId: string | null;
  hasMention?: boolean;
}): ConversationPreview {
  const members = conversation.members ?? [];
  const isGroup = conversation.type !== "DIRECT";
  const onlineCount = members.filter((member) => {
    if (!member.lastSeenAt) return false;
    const time = new Date(member.lastSeenAt).getTime();
    return Number.isFinite(time) && Date.now() - time <= ONLINE_WINDOW_MS;
  }).length;
  const otherOnlineCount = members.filter((member) => member.userId !== viewerId).filter((member) => {
    if (!member.lastSeenAt) return false;
    const time = new Date(member.lastSeenAt).getTime();
    return Number.isFinite(time) && Date.now() - time <= ONLINE_WINDOW_MS;
  }).length;
  const snippet = conversation.lastMessage?.body?.trim() || (conversation.lastMessage ? "Anexo enviado" : "Sem mensagens");

  return {
    id: conversation.id,
    name: conversation.title ?? "Conversa",
    snippet,
    time: formatTimeLabel(conversation.lastMessageAt),
    unread: conversation.unreadCount ?? 0,
    isPinned: Boolean(pinnedMessage),
    isGroup,
    hasMention,
    memberCount: members.length,
    onlineCount: onlineCount > 0 ? onlineCount : undefined,
    presenceLabel: !isGroup ? (otherOnlineCount > 0 ? "Disponivel" : "Ausente") : undefined,
    hasPinned: Boolean(pinnedMessage),
    notifLevel: conversation.notifLevel ?? undefined,
    mutedUntil: conversation.mutedUntil ?? null,
  };
}

function generateClientMessageId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function useChatPreviewData() {
  const { user, profile } = useUser();
  const searchParams = useSearchParams();
  const organizationIdParam = parseOrganizationId(searchParams?.get("organizationId"));
  const fallbackOrganizationId = organizationIdParam ?? getOrganizationIdFromBrowser();
  const viewerId = user?.id ?? null;
  const viewerLabel = profile?.fullName || profile?.username || "Tu";
  const mentionTokens = useMemo(
    () => buildMentionTokens(profile?.username ?? null, profile?.fullName ?? null),
    [profile?.fullName, profile?.username],
  );

  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messagesByConversation, setMessagesByConversation] = useState<Record<string, Message[]>>({});
  const [membersByConversation, setMembersByConversation] = useState<Record<string, MemberReadState[]>>({});
  const [pendingByConversation, setPendingByConversation] = useState<Record<string, PendingMessage[]>>({});
  const [nextCursorByConversation, setNextCursorByConversation] = useState<Record<string, string | null>>({});
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [loadingConversationId, setLoadingConversationId] = useState<string | null>(null);
  const [loadingHistoryId, setLoadingHistoryId] = useState<string | null>(null);
  const [conversationsError, setConversationsError] = useState<string | null>(null);
  const [messagesErrorByConversation, setMessagesErrorByConversation] = useState<Record<string, string | null>>({});
  const [sendError, setSendError] = useState<string | null>(null);
  const [attachmentsError, setAttachmentsError] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<"connected" | "reconnecting">("connected");
  const [isOffline, setIsOffline] = useState(false);
  const [typingByConversation, setTypingByConversation] = useState<Record<string, string[]>>({});
  const [mentionByConversation, setMentionByConversation] = useState<Record<string, boolean>>({});
  const [organizationId, setOrganizationId] = useState<number | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const wsPingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wsReconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wsBackoffRef = useRef(500);
  const wsConnectingRef = useRef(false);
  const isOfflineRef = useRef(false);
  const connectWsRef = useRef<(() => void) | null>(null);
  const typingTtlMapRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const lastConversationSyncRef = useRef<string | null>(null);
  const activeConversationIdRef = useRef<string | null>(activeConversationId);
  const lastReadAttemptRef = useRef<Record<string, { id: string; ts: number }>>({});
  const conversationsLoadingRef = useRef(false);
  const lastConversationsFetchAtRef = useRef(0);
  const messagesLoadingRef = useRef<Record<string, boolean>>({});
  const lastMessagesFetchAtRef = useRef<Record<string, number>>({});
  const initialMessagesLoadedRef = useRef<Set<string>>(new Set());

  const wsBaseUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    const envUrl = process.env.NEXT_PUBLIC_CHAT_WS_URL?.trim();
    if (envUrl) return envUrl;
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    return `${protocol}://${window.location.hostname}:4001`;
  }, []);

  const pinnedMessageByConversation = useMemo<Record<string, ReplyPreview | null>>(() => {
    const map: Record<string, ReplyPreview | null> = {};
    Object.entries(messagesByConversation).forEach(([conversationId, messages]) => {
      const pinned = messages
        .filter((message) => (message.pins?.length ?? 0) > 0 && !message.deletedAt)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
      if (pinned) {
        const author = pinned.sender
          ? resolveMemberName({ fullName: pinned.sender.fullName, username: pinned.sender.username })
          : "Sistema";
        map[conversationId] = {
          id: pinned.id,
          author,
          text: pinned.body ?? "Mensagem",
        };
      } else {
        map[conversationId] = null;
      }
    });
    return map;
  }, [messagesByConversation]);

  const conversationPreviews = useMemo(
    () =>
      conversations.map((conversation) => {
        const unreadCount = conversation.unreadCount ?? 0;
        const trackedMention = mentionByConversation[conversation.id] ?? false;
        const fallbackMention =
          unreadCount > 0 && mentionTokens.length > 0
            ? hasMention(conversation.lastMessage?.body ?? null, mentionTokens)
            : false;
        const hasMentionFlag = unreadCount > 0 && (trackedMention || fallbackMention);
        return buildConversationPreview({
          conversation,
          pinnedMessage: pinnedMessageByConversation[conversation.id] ?? null,
          viewerId,
          hasMention: hasMentionFlag,
        });
      }),
    [conversations, mentionByConversation, mentionTokens, pinnedMessageByConversation, viewerId],
  );

  const messagesPreviewByConversation = useMemo<Record<string, MessagePreview[]>>(() => {
    const map: Record<string, MessagePreview[]> = {};
    const allConversationIds = new Set([
      ...Object.keys(messagesByConversation),
      ...Object.keys(pendingByConversation),
    ]);

    allConversationIds.forEach((conversationId) => {
      const members = membersByConversation[conversationId] ?? [];
      const real = messagesByConversation[conversationId] ?? [];
      const pending = pendingByConversation[conversationId] ?? [];
      const realPreviews = real
        .filter((message) => !message.deletedAt)
        .map((message) => mapMessageToPreview({ message, viewerId, members }));
      const pendingPreviews = pending.map((entry) => mapPendingToPreview(entry, viewerLabel, viewerId));
      const combined = [...realPreviews, ...pendingPreviews].sort((a, b) => {
        const timeA = new Date(a.createdAt ?? 0).getTime();
        const timeB = new Date(b.createdAt ?? 0).getTime();
        if (timeA !== timeB) return timeA - timeB;
        return a.id.localeCompare(b.id);
      });
      map[conversationId] = combined;
    });
    return map;
  }, [messagesByConversation, pendingByConversation, membersByConversation, viewerId, viewerLabel]);

  const loadOrganizationId = useCallback(async () => {
    if (organizationId) return organizationId;
    if (fallbackOrganizationId) {
      setOrganizationId(fallbackOrganizationId);
      return fallbackOrganizationId;
    }
    return null;
  }, [organizationId, fallbackOrganizationId]);

  const loadOrganizationMembers = useCallback(async (): Promise<OrganizationMemberDirectoryItem[]> => {
    const orgId = organizationId ?? (await loadOrganizationId());
    if (!orgId) return [];
    const url = new URL("/api/organizacao/organizations/members", window.location.origin);
    url.searchParams.set("organizationId", String(orgId));
    try {
      const data = await fetcher<OrganizationMembersResponse>(url.pathname + url.search);
      return data.items ?? [];
    } catch {
      return [];
    }
  }, [loadOrganizationId, organizationId]);

  const updateConversations = useCallback((updater: (items: ConversationItem[]) => ConversationItem[]) => {
    setConversations((prev) => {
      const next = updater(prev);
      return [...next].sort((a, b) => {
        const timeA = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
        const timeB = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
        return timeB - timeA;
      });
    });
  }, []);

  const loadConversations = useCallback(
    async ({ incremental = false }: { incremental?: boolean } = {}) => {
      const now = Date.now();
      if (conversationsLoadingRef.current) return;
      if (incremental && now - lastConversationsFetchAtRef.current < 800) return;
      conversationsLoadingRef.current = true;
      lastConversationsFetchAtRef.current = now;
      setLoadingConversations(true);
      setConversationsError(null);
      try {
        const url = new URL("/api/chat/conversations", window.location.origin);
        if (incremental && lastConversationSyncRef.current) {
          url.searchParams.set("updatedAfter", lastConversationSyncRef.current);
        }
        const data = await fetcher<ConversationsResponse>(url.pathname + url.search);
        const items = data.items ?? [];
        if (incremental && lastConversationSyncRef.current) {
          updateConversations((prev) => {
            const map = new Map(prev.map((entry) => [entry.id, entry]));
            items.forEach((item) => map.set(item.id, { ...map.get(item.id), ...item }));
            return Array.from(map.values());
          });
        } else {
          setConversations(items);
          if (!activeConversationId && items.length) {
            setActiveConversationId(items[0].id);
          }
        }
        lastConversationSyncRef.current = new Date().toISOString();
      } catch (err) {
        setConversationsError(err instanceof Error ? err.message : "Erro ao carregar conversas.");
      } finally {
        setLoadingConversations(false);
        conversationsLoadingRef.current = false;
      }
    },
    [activeConversationId, updateConversations],
  );

  const createConversation = useCallback(
    async (payload: CreateConversationPayload) => {
      const data = await fetcher<{ ok: boolean; conversation?: { id?: string | null } | null }>(
        "/api/chat/conversations",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const id = data.conversation?.id ?? null;
      if (!id) {
        throw new Error("Erro ao criar conversa.");
      }
      await loadConversations();
      setActiveConversationId(id);
      return id;
    },
    [loadConversations],
  );

  const loadMessages = useCallback(
    async ({
      conversationId,
      cursor,
      appendOlder,
      includeMembers,
    }: {
      conversationId: string;
      cursor?: string | null;
      appendOlder?: boolean;
      includeMembers?: boolean;
    }) => {
      if (!conversationId) return;
      const mode = appendOlder ? "older" : "latest";
      const membersMode = includeMembers === false ? "nomembers" : "members";
      const key = `${conversationId}:${mode}:${membersMode}:${cursor ?? "base"}`;
      const isInitialLoad = !appendOlder && !cursor;
      if (messagesLoadingRef.current[key]) return;
      const now = Date.now();
      const lastAttempt = lastMessagesFetchAtRef.current[key] ?? 0;
      const hasExisting = (messagesByConversation[conversationId]?.length ?? 0) > 0;
      if (!appendOlder && hasExisting && now - lastAttempt < 600) return;
      messagesLoadingRef.current[key] = true;
      lastMessagesFetchAtRef.current[key] = now;
      if (appendOlder) {
        setLoadingHistoryId(conversationId);
      } else {
        setLoadingConversationId(conversationId);
      }
      setMessagesErrorByConversation((prev) => ({ ...prev, [conversationId]: null }));
      try {
        const url = new URL(`/api/chat/conversations/${conversationId}/messages`, window.location.origin);
        if (cursor) url.searchParams.set("cursor", cursor);
        if (includeMembers === false) {
          url.searchParams.set("includeMembers", "0");
        }
        const data = await fetcher<MessagesResponse>(url.pathname + url.search);
        if (data.members?.length) {
          setMembersByConversation((prev) => ({ ...prev, [conversationId]: data.members }));
        }
        setNextCursorByConversation((prev) => ({
          ...prev,
          [conversationId]: data.nextCursor ?? null,
        }));
        const incoming = data.items ?? [];
        const existing = messagesByConversation[conversationId] ?? [];
        const existingIds = new Set(existing.map((item) => item.id));
        const merged = appendOlder
          ? sortMessages([...incoming.filter((item) => !existingIds.has(item.id)), ...existing])
          : sortMessages(incoming);
        setMessagesByConversation((prev) => ({ ...prev, [conversationId]: merged }));
        if (mentionTokens.length > 0 && !appendOlder) {
          const conversationEntry = conversations.find((entry) => entry.id === conversationId) ?? null;
          const unreadCount = conversationEntry?.unreadCount ?? 0;
          const lastReadMessageId = conversationEntry?.viewerLastReadMessageId ?? null;
          const hasUnread = hasUnreadMention({
            messages: merged,
            unreadCount,
            lastReadMessageId,
            mentionTokens,
            viewerId,
          });
          if (hasUnread || mentionByConversation[conversationId]) {
            setMentionByConversation((prev) => ({ ...prev, [conversationId]: hasUnread }));
          }
        }
      } catch (err) {
        setMessagesErrorByConversation((prev) => ({
          ...prev,
          [conversationId]: err instanceof Error ? err.message : "Erro ao carregar mensagens.",
        }));
      } finally {
        if (isInitialLoad) {
          initialMessagesLoadedRef.current.add(conversationId);
        }
        setLoadingConversationId((prev) => (prev === conversationId ? null : prev));
        setLoadingHistoryId((prev) => (prev === conversationId ? null : prev));
        delete messagesLoadingRef.current[key];
      }
    },
    [conversations, mentionByConversation, mentionTokens, messagesByConversation, viewerId],
  );

  const scheduleReadReceipt = useCallback(
    async (conversationId: string) => {
      const messages = messagesByConversation[conversationId] ?? [];
      const lastMessage = [...messages].reverse().find((message) => !message.deletedAt);
      if (!lastMessage) return;
      const now = Date.now();
      const lastAttempt = lastReadAttemptRef.current[conversationId];
      if (lastAttempt && lastAttempt.id === lastMessage.id && now - lastAttempt.ts < 1500) return;
      lastReadAttemptRef.current[conversationId] = { id: lastMessage.id, ts: now };
      try {
        const res = await fetch(`/api/chat/conversations/${conversationId}/read`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lastReadMessageId: lastMessage.id }),
        });
        const json = await res.json().catch(() => null);
        if (res.ok && json?.updated !== false) {
          updateConversations((prev) =>
            prev.map((conv) =>
              conv.id === conversationId
                ? { ...conv, unreadCount: 0, viewerLastReadMessageId: lastMessage.id }
                : conv,
            ),
          );
          setMentionByConversation((prev) => ({ ...prev, [conversationId]: false }));
        }
      } catch {
        // ignore
      }
    },
    [messagesByConversation, updateConversations],
  );

  const sendWsMessage = useCallback((payload: Record<string, unknown>) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    try {
      ws.send(JSON.stringify(payload));
    } catch {
      // ignore
    }
  }, []);

  const stopWsPing = useCallback(() => {
    if (wsPingRef.current) clearInterval(wsPingRef.current);
    wsPingRef.current = null;
  }, []);

  const startWsPing = useCallback(() => {
    stopWsPing();
    wsPingRef.current = setInterval(() => {
      sendWsMessage({ type: "ping" });
    }, WS_PING_INTERVAL_MS);
  }, [sendWsMessage, stopWsPing]);

  const scheduleWsReconnect = useCallback(() => {
    if (wsReconnectRef.current || isOfflineRef.current) return;
    const delay = wsBackoffRef.current;
    wsBackoffRef.current = Math.min(delay * 1.7, 10000);
    wsReconnectRef.current = setTimeout(() => {
      wsReconnectRef.current = null;
      connectWsRef.current?.();
    }, delay);
  }, []);

  const addTypingUser = useCallback((conversationId: string, userId: string) => {
    if (!userId || userId === viewerId) return;
    const existing = typingTtlMapRef.current.get(userId);
    if (existing) clearTimeout(existing);
    const timeout = setTimeout(() => {
      typingTtlMapRef.current.delete(userId);
      setTypingByConversation((prev) => {
        const list = prev[conversationId] ?? [];
        if (!list.includes(userId)) return prev;
        return { ...prev, [conversationId]: list.filter((id) => id !== userId) };
      });
    }, 8000);
    typingTtlMapRef.current.set(userId, timeout);
    setTypingByConversation((prev) => {
      const list = prev[conversationId] ?? [];
      if (list.includes(userId)) return prev;
      return { ...prev, [conversationId]: [...list, userId] };
    });
  }, [viewerId]);

  const removeTypingUser = useCallback((conversationId: string, userId: string) => {
    const existing = typingTtlMapRef.current.get(userId);
    if (existing) clearTimeout(existing);
    typingTtlMapRef.current.delete(userId);
    setTypingByConversation((prev) => {
      const list = prev[conversationId] ?? [];
      if (!list.includes(userId)) return prev;
      return { ...prev, [conversationId]: list.filter((id) => id !== userId) };
    });
  }, []);

  const applyMessageNew = useCallback((payload: ChatEvent & { type: "message:new" }) => {
    const { message, conversationId } = payload;
    if (!message?.id) return;
    const isActive = activeConversationIdRef.current === conversationId;
    const shouldTrackMention =
      !isActive &&
      message.sender?.id !== viewerId &&
      mentionTokens.length > 0 &&
      hasMention(message.body ?? null, mentionTokens);
    setMessagesByConversation((prev) => {
      const current = prev[conversationId] ?? [];
      if (current.some((item) => item.id === message.id)) return prev;
      return { ...prev, [conversationId]: sortMessages([...current, message]) };
    });
    updateConversations((prev) =>
      prev.map((conv) =>
        conv.id === conversationId
          ? {
              ...conv,
              lastMessageAt: message.createdAt,
              lastMessage: {
                id: message.id,
                body: message.body,
                createdAt: message.createdAt,
                senderId: message.sender?.id ?? null,
              },
              unreadCount:
                message.sender?.id === viewerId
                  ? conv.unreadCount
                  : isActive
                    ? 0
                    : (conv.unreadCount ?? 0) + 1,
            }
          : conv,
      ),
    );
    if (shouldTrackMention) {
      setMentionByConversation((prev) => ({ ...prev, [conversationId]: true }));
    }
  }, [mentionTokens, updateConversations, viewerId]);

  const applyMessageUpdate = useCallback((payload: ChatEvent & { type: "message:update" }) => {
    const { message, conversationId } = payload;
    if (!message?.id) return;
    setMessagesByConversation((prev) => {
      const current = prev[conversationId] ?? [];
      return {
        ...prev,
        [conversationId]: current.map((item) => (item.id === message.id ? message : item)),
      };
    });
    updateConversations((prev) =>
      prev.map((conv) =>
        conv.id === conversationId && conv.lastMessage?.id === message.id
          ? {
              ...conv,
              lastMessage: {
                id: message.id,
                body: message.body,
                createdAt: message.createdAt,
                senderId: message.sender?.id ?? null,
              },
            }
          : conv,
      ),
    );
  }, [updateConversations]);

  const applyMessageDelete = useCallback((payload: ChatEvent & { type: "message:delete" }) => {
    const { messageId, conversationId, deletedAt, lastMessage } = payload;
    if (!messageId) return;
    setMessagesByConversation((prev) => {
      const current = prev[conversationId] ?? [];
      return {
        ...prev,
        [conversationId]: current.map((item) =>
          item.id === messageId ? { ...item, deletedAt } : item,
        ),
      };
    });
    if (payload.lastMessage !== undefined) {
      updateConversations((prev) =>
        prev.map((conv) =>
          conv.id === conversationId
            ? {
                ...conv,
                lastMessageAt: lastMessage ? lastMessage.createdAt : null,
                lastMessage: lastMessage
                  ? {
                      id: lastMessage.id,
                      body: lastMessage.body,
                      createdAt: lastMessage.createdAt,
                      senderId: lastMessage.senderId,
                    }
                  : null,
              }
            : conv,
        ),
      );
    }
  }, [updateConversations]);

  const applyReactionUpdate = useCallback((payload: ChatEvent & { type: "reaction:update" }) => {
    const { messageId, conversationId, reactions } = payload;
    if (!messageId) return;
    setMessagesByConversation((prev) => {
      const current = prev[conversationId] ?? [];
      return {
        ...prev,
        [conversationId]: current.map((item) => (item.id === messageId ? { ...item, reactions } : item)),
      };
    });
  }, []);

  const applyPinUpdate = useCallback((payload: ChatEvent & { type: "pin:update" }) => {
    const { messageId, conversationId, pins } = payload;
    if (!messageId) return;
    setMessagesByConversation((prev) => {
      const current = prev[conversationId] ?? [];
      return {
        ...prev,
        [conversationId]: current.map((item) => (item.id === messageId ? { ...item, pins } : item)),
      };
    });
  }, []);

  const applyReadReceipt = useCallback((payload: ChatEvent & { type: "message:read" }) => {
    const { conversationId, userId, lastReadMessageId } = payload;
    setMembersByConversation((prev) => {
      const members = prev[conversationId] ?? [];
      if (!members.length) return prev;
      const now = new Date().toISOString();
      return {
        ...prev,
        [conversationId]: members.map((member) =>
          member.userId === userId ? { ...member, lastReadMessageId, lastReadAt: now } : member,
        ),
      };
    });
    if (userId === viewerId) {
      lastReadAttemptRef.current[conversationId] = { id: lastReadMessageId, ts: Date.now() };
      updateConversations((prev) =>
        prev.map((conv) =>
          conv.id === conversationId ? { ...conv, viewerLastReadMessageId: lastReadMessageId } : conv,
        ),
      );
      setMentionByConversation((prev) => ({ ...prev, [conversationId]: false }));
    }
  }, [updateConversations, viewerId]);

  const applyPresenceUpdate = useCallback((payload: ChatEvent & { type: "presence:update" }) => {
    const { userId, status, lastSeenAt } = payload;
    const nextLastSeen = status === "online" ? new Date().toISOString() : lastSeenAt ?? null;
    setMembersByConversation((prev) => {
      const next: Record<string, MemberReadState[]> = {};
      Object.entries(prev).forEach(([conversationId, members]) => {
        next[conversationId] = members.map((member) =>
          member.userId === userId
            ? { ...member, profile: { ...member.profile, lastSeenAt: nextLastSeen } }
            : member,
        );
      });
      return { ...prev, ...next };
    });
    updateConversations((prev) =>
      prev.map((conv) => ({
        ...conv,
        members: conv.members.map((member) =>
          member.userId === userId ? { ...member, lastSeenAt: nextLastSeen } : member,
        ),
      })),
    );
  }, [updateConversations]);

  const handleChatEvent = useCallback(
    (event: ChatEvent) => {
      switch (event.type) {
        case "message:new":
          applyMessageNew(event);
          return;
        case "message:update":
          applyMessageUpdate(event);
          return;
        case "message:delete":
          applyMessageDelete(event);
          return;
        case "reaction:update":
          applyReactionUpdate(event);
          return;
        case "pin:update":
          applyPinUpdate(event);
          return;
        case "message:read":
          applyReadReceipt(event);
          return;
        case "typing:start":
          addTypingUser(event.conversationId, event.userId);
          return;
        case "typing:stop":
          removeTypingUser(event.conversationId, event.userId);
          return;
        case "presence:update":
          applyPresenceUpdate(event);
          return;
        case "conversation:update":
          loadConversations({ incremental: true });
          sendWsMessage({ type: "conversation:sync" });
          return;
        default:
          return;
      }
    },
    [
      addTypingUser,
      applyMessageDelete,
      applyMessageNew,
      applyMessageUpdate,
      applyPinUpdate,
      applyPresenceUpdate,
      applyReactionUpdate,
      applyReadReceipt,
      loadConversations,
      removeTypingUser,
      sendWsMessage,
    ],
  );

  const loadConversationsRef = useRef(loadConversations);
  const loadMessagesRef = useRef(loadMessages);
  const handleChatEventRef = useRef(handleChatEvent);

  useEffect(() => {
    loadConversationsRef.current = loadConversations;
  }, [loadConversations]);

  useEffect(() => {
    loadMessagesRef.current = loadMessages;
  }, [loadMessages]);

  useEffect(() => {
    handleChatEventRef.current = handleChatEvent;
  }, [handleChatEvent]);

  const connectWs = useCallback(async () => {
    if (!wsBaseUrl || isOfflineRef.current) return;
    if (wsConnectingRef.current) return;
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return;

    wsConnectingRef.current = true;
    setConnectionState("reconnecting");

    const session = await supabaseBrowser.auth.getSession();
    const token = session.data.session?.access_token;
    if (!token) {
      wsConnectingRef.current = false;
      scheduleWsReconnect();
      return;
    }

    const orgId = organizationId ?? (await loadOrganizationId());
    if (!orgId) {
      wsConnectingRef.current = false;
      scheduleWsReconnect();
      return;
    }

    const wsUrl = new URL(wsBaseUrl);
    wsUrl.searchParams.set("organizationId", String(orgId));

    const ws = new WebSocket(wsUrl.toString(), [
      WS_PROTOCOL_BASE,
      `${WS_AUTH_PROTOCOL_PREFIX}${token}`,
    ]);
    wsRef.current = ws;

    ws.onopen = () => {
      wsConnectingRef.current = false;
      wsBackoffRef.current = 500;
      setConnectionState("connected");
      startWsPing();
      sendWsMessage({ type: "conversation:sync" });
      loadConversationsRef.current?.({ incremental: true });
      const activeId = activeConversationIdRef.current;
      if (activeId) {
        loadMessagesRef.current?.({ conversationId: activeId, includeMembers: false });
      }
    };

    ws.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data) as ChatEvent;
        if (!parsed?.type) return;
        handleChatEventRef.current?.(parsed);
      } catch {
        // ignore
      }
    };

    ws.onclose = () => {
      wsConnectingRef.current = false;
      setConnectionState("reconnecting");
      stopWsPing();
      wsRef.current = null;
      scheduleWsReconnect();
    };

    ws.onerror = () => {
      wsConnectingRef.current = false;
      setConnectionState("reconnecting");
    };
  }, [
    loadOrganizationId,
    organizationId,
    scheduleWsReconnect,
    sendWsMessage,
    startWsPing,
    stopWsPing,
    wsBaseUrl,
  ]);

  const sendTyping = useCallback(
    (conversationId: string, isTyping: boolean) => {
      if (!conversationId) return;
      sendWsMessage({ type: isTyping ? "typing:start" : "typing:stop", conversationId });
    },
    [sendWsMessage],
  );

  const sendMessage = useCallback(
    async ({
      conversationId,
      body,
      attachments,
      replyTo,
    }: {
      conversationId: string;
      body: string;
      attachments: ComposerAttachment[];
      replyTo?: ReplyPreview | null;
    }) => {
      if (!conversationId) return;
      const clientMessageId = generateClientMessageId();
      const pendingId = `pending:${clientMessageId}`;
      const pendingEntry: PendingMessage = {
        id: pendingId,
        conversationId,
        body,
        createdAt: new Date().toISOString(),
        attachments,
        replyTo: replyTo ?? undefined,
        status: "sending",
      };
      setSendError(null);
      setAttachmentsError(null);
      setPendingByConversation((prev) => ({
        ...prev,
        [conversationId]: [...(prev[conversationId] ?? []), pendingEntry],
      }));

      if (isOfflineRef.current) {
        const message = "Nao e possivel enviar mensagens offline.";
        setSendError(message);
        setAttachmentsError(message);
        setPendingByConversation((prev) => ({
          ...prev,
          [conversationId]: (prev[conversationId] ?? []).map((entry) =>
            entry.id === pendingId ? { ...entry, status: "failed", error: message } : entry,
          ),
        }));
        return;
      }

      try {
        let preparedAttachments: Array<{
          type: "IMAGE" | "VIDEO" | "FILE";
          url: string;
          mime: string;
          size: number;
          metadata?: Record<string, unknown>;
        }> = [];

        const files = attachments.map((entry) => entry.file).filter(Boolean) as File[];
        if (files.length > 0) {
          const uploads = await Promise.all(
            files.map(async (file) => {
              const type: Attachment["type"] = file.type.startsWith("image/")
                ? "IMAGE"
                : file.type.startsWith("video/")
                  ? "VIDEO"
                  : "FILE";
              const checksumSha256 = await computeBlobSha256Hex(file);
              const presign = await fetcher<{
                ok: boolean;
                uploadUrl: string;
                uploadToken: string;
                path: string;
                bucket: string;
                url: string;
              }>("/api/chat/attachments/presign", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ type, mime: file.type, size: file.size, metadata: { name: file.name } }),
              });

              const upload = await supabaseBrowser.storage
                .from(presign.bucket)
                .uploadToSignedUrl(presign.path, presign.uploadToken, file, {
                  contentType: file.type,
                });

              if (upload.error) {
                throw new Error(upload.error.message || "Falha no upload");
              }

              return {
                type,
                url: presign.url,
                mime: file.type,
                size: file.size,
                metadata: {
                  name: file.name,
                  path: presign.path,
                  bucket: presign.bucket,
                  checksumSha256,
                },
              };
            }),
          );
          preparedAttachments = uploads;
        }

        const res = await fetcher<{ ok: boolean; message: Message }>("/api/chat/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversationId,
            body,
            attachments: preparedAttachments,
            clientMessageId,
            replyToMessageId: replyTo?.id ?? undefined,
          }),
        });
        if (!res?.message) {
          throw new Error("Resposta invalida.");
        }
        setPendingByConversation((prev) => ({
          ...prev,
          [conversationId]: (prev[conversationId] ?? []).filter((entry) => entry.id !== pendingId),
        }));
        setMessagesByConversation((prev) => {
          const current = prev[conversationId] ?? [];
          if (current.some((item) => item.id === res.message.id)) return prev;
          return { ...prev, [conversationId]: sortMessages([...current, res.message]) };
        });
        updateConversations((prev) =>
          prev.map((conv) =>
            conv.id === conversationId
              ? {
                  ...conv,
                  lastMessageAt: res.message.createdAt,
                  lastMessage: {
                    id: res.message.id,
                    body: res.message.body,
                    createdAt: res.message.createdAt,
                    senderId: res.message.sender?.id ?? null,
                  },
                }
              : conv,
          ),
        );
        setSendError(null);
        setAttachmentsError(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erro ao enviar.";
        setSendError(message);
        setAttachmentsError(message);
        setPendingByConversation((prev) => ({
          ...prev,
          [conversationId]: (prev[conversationId] ?? []).map((entry) =>
            entry.id === pendingId ? { ...entry, status: "failed", error: message } : entry,
          ),
        }));
      }
    },
    [updateConversations],
  );

  const editMessage = useCallback(async (messageId: string, body: string) => {
    if (!messageId || !body.trim()) return;
    try {
      const res = await fetcher<{ ok: boolean; message: Message }>(`/api/chat/messages/${messageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      if (!res?.message) return;
      setMessagesByConversation((prev) => {
        const conversationId = res.message.conversationId;
        const current = prev[conversationId] ?? [];
        return {
          ...prev,
          [conversationId]: current.map((item) => (item.id === messageId ? res.message : item)),
        };
      });
    } catch {
      // ignore
    }
  }, []);

  const retryPendingMessage = useCallback(
    (conversationId: string, pendingId: string) => {
      const pending = pendingByConversation[conversationId]?.find((entry) => entry.id === pendingId);
      if (!pending) return;
      setPendingByConversation((prev) => ({
        ...prev,
        [conversationId]: (prev[conversationId] ?? []).filter((entry) => entry.id !== pendingId),
      }));
      void sendMessage({
        conversationId,
        body: pending.body,
        attachments: pending.attachments,
        replyTo: pending.replyTo ?? undefined,
      });
    },
    [pendingByConversation, sendMessage],
  );

  const removePendingMessage = useCallback((conversationId: string, pendingId: string) => {
    setPendingByConversation((prev) => ({
      ...prev,
      [conversationId]: (prev[conversationId] ?? []).filter((entry) => entry.id !== pendingId),
    }));
  }, []);

  const updateConversationNotifications = useCallback(
    async ({
      conversationId,
      level,
      mutedUntil,
    }: {
      conversationId: string;
      level: "ALL" | "MENTIONS_ONLY" | "OFF";
      mutedUntil: string | null;
    }) => {
      const res = await fetcher<{ ok: boolean; notifLevel: string; mutedUntil: string | null }>(
        `/api/chat/conversations/${conversationId}/notifications`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notifLevel: level, mutedUntil }),
        },
      );
      setConversations((prev) =>
        prev.map((conv) =>
          conv.id === conversationId
            ? { ...conv, notifLevel: res.notifLevel as ConversationItem["notifLevel"], mutedUntil: res.mutedUntil }
            : conv,
        ),
      );
    },
    [],
  );

  const renameConversation = useCallback(
    async ({
      conversationId,
      title,
    }: {
      conversationId: string;
      title: string;
    }) => {
      const res = await fetcher<{ ok: boolean; conversation?: { id: string; title: string | null } }>(
        `/api/chat/conversations/${conversationId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title }),
        },
      );
      const nextTitle = res.conversation?.title ?? null;
      setConversations((prev) =>
        prev.map((conv) => (conv.id === conversationId ? { ...conv, title: nextTitle } : conv)),
      );
      return nextTitle;
    },
    [],
  );

  const leaveConversation = useCallback(
    async (conversationId: string) => {
      await fetcher<{ ok: boolean }>(`/api/chat/conversations/${conversationId}/leave`, {
        method: "POST",
      });
      const currentActive = activeConversationIdRef.current;
      setConversations((prev) => {
        const next = prev.filter((conv) => conv.id !== conversationId);
        if (currentActive === conversationId) {
          setActiveConversationId(next[0]?.id ?? null);
        }
        return next;
      });
      setMessagesByConversation((prev) => {
        const next = { ...prev };
        delete next[conversationId];
        return next;
      });
      setMembersByConversation((prev) => {
        const next = { ...prev };
        delete next[conversationId];
        return next;
      });
      setPendingByConversation((prev) => {
        const next = { ...prev };
        delete next[conversationId];
        return next;
      });
      setNextCursorByConversation((prev) => {
        const next = { ...prev };
        delete next[conversationId];
        return next;
      });
      setTypingByConversation((prev) => {
        const next = { ...prev };
        delete next[conversationId];
        return next;
      });
      setMentionByConversation((prev) => {
        const next = { ...prev };
        delete next[conversationId];
        return next;
      });
      initialMessagesLoadedRef.current.delete(conversationId);
    },
    [],
  );

  const toggleBlockUser = useCallback(
    async ({ userId, shouldBlock }: { userId: string; shouldBlock: boolean }) => {
      await fetcher<{ ok: boolean }>(`/api/chat/blocks`, {
        method: shouldBlock ? "POST" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
    },
    [],
  );

  const clearComposerErrors = useCallback(() => {
    setSendError(null);
    setAttachmentsError(null);
  }, []);

  const deleteMessage = useCallback(async (messageId: string) => {
    if (!messageId) return;
    try {
      const res = await fetcher<{ ok: boolean; deletedAt: string }>(`/api/chat/messages/${messageId}`, {
        method: "DELETE",
      });
      if (!res?.deletedAt) return;
      setMessagesByConversation((prev) => {
        const next: Record<string, Message[]> = {};
        Object.entries(prev).forEach(([conversationId, messages]) => {
          next[conversationId] = messages.map((item) =>
            item.id === messageId ? { ...item, deletedAt: res.deletedAt } : item,
          );
        });
        return next;
      });
    } catch {
      // ignore
    }
  }, []);

  const toggleReaction = useCallback(
    async (conversationId: string, messageId: string, emoji: string) => {
      if (!viewerId || !conversationId || !messageId) return;
      const message = messagesByConversation[conversationId]?.find((entry) => entry.id === messageId);
      const existing = message?.reactions?.find((reaction) => reaction.userId === viewerId) ?? null;
      const hasReacted = existing?.emoji === emoji;
      try {
        await fetcher(`/api/chat/messages/${messageId}/reactions`, {
          method: hasReacted ? "DELETE" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ emoji }),
        });
        setMessagesByConversation((prev) => {
          const current = prev[conversationId] ?? [];
          return {
            ...prev,
            [conversationId]: current.map((item) => {
              if (item.id !== messageId) return item;
              const reactions = item.reactions ?? [];
              if (hasReacted) {
                return {
                  ...item,
                  reactions: reactions.filter(
                    (reaction) => !(reaction.userId === viewerId && reaction.emoji === emoji),
                  ),
                };
              }
              const nextReactions = [
                ...reactions.filter((reaction) => reaction.userId !== viewerId),
                {
                  messageId,
                  userId: viewerId,
                  emoji,
                  createdAt: new Date().toISOString(),
                },
              ] as Reaction[];
              return { ...item, reactions: nextReactions };
            }),
          };
        });
      } catch {
        // ignore
      }
    },
    [messagesByConversation, viewerId],
  );

  const togglePin = useCallback(async (conversationId: string, messageId: string, isPinned: boolean) => {
    if (!conversationId || !messageId) return;
    try {
      await fetcher(`/api/chat/messages/${messageId}/pins`, {
        method: isPinned ? "DELETE" : "POST",
      });
      setMessagesByConversation((prev) => {
        const current = prev[conversationId] ?? [];
        return {
          ...prev,
          [conversationId]: current.map((item) => {
            if (item.id !== messageId) return item;
            if (isPinned) {
              return { ...item, pins: [] };
            }
            return {
              ...item,
              pins: [
                {
                  id: `pin-${messageId}`,
                  messageId,
                  pinnedBy: viewerId ?? "self",
                  pinnedAt: new Date().toISOString(),
                },
              ],
            };
          }),
        };
      });
    } catch {
      // ignore
    }
  }, [viewerId]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
  }, [activeConversationId]);

  useEffect(() => {
    if (!activeConversationId) return;
    if (messagesByConversation[activeConversationId]?.length) return;
    if (messagesErrorByConversation[activeConversationId]) return;
    if (initialMessagesLoadedRef.current.has(activeConversationId)) return;
    if (loadingConversationId === activeConversationId) return;
    loadMessages({ conversationId: activeConversationId });
  }, [
    activeConversationId,
    loadMessages,
    loadingConversationId,
    messagesByConversation,
    messagesErrorByConversation,
  ]);

  useEffect(() => {
    connectWsRef.current = connectWs;
  }, [connectWs]);

  useEffect(() => {
    if (!wsBaseUrl) return;
    connectWsRef.current?.();
    return () => {
      if (wsPingRef.current) clearInterval(wsPingRef.current);
      if (wsReconnectRef.current) clearTimeout(wsReconnectRef.current);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [wsBaseUrl]);

  useEffect(() => {
    const update = () => {
      const offline = typeof navigator !== "undefined" && navigator.onLine === false;
      isOfflineRef.current = offline;
      setIsOffline(offline);
      if (offline) {
        setConnectionState("reconnecting");
        wsRef.current?.close();
        return;
      }
      connectWsRef.current?.();
    };
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  const hasMoreHistoryByConversation = useMemo(() => {
    const map: Record<string, boolean> = {};
    Object.entries(nextCursorByConversation).forEach(([conversationId, cursor]) => {
      map[conversationId] = Boolean(cursor);
    });
    return map;
  }, [nextCursorByConversation]);

  const loadMoreHistory = useCallback(
    (conversationId: string) => {
      const cursor = nextCursorByConversation[conversationId];
      if (!cursor) return;
      loadMessages({ conversationId, cursor, appendOlder: true, includeMembers: false });
    },
    [loadMessages, nextCursorByConversation],
  );

  const refreshConversations = useCallback(() => {
    loadConversations();
  }, [loadConversations]);

  const refreshMessages = useCallback(
    (conversationId: string) => {
      loadMessages({ conversationId });
    },
    [loadMessages],
  );

  return {
    conversations: conversationPreviews,
    viewerId,
    viewerLabel,
    mentionTokens,
    activeConversationId,
    setActiveConversationId,
    messagesByConversation: messagesPreviewByConversation,
    membersByConversation,
    pinnedMessageByConversation,
    loadingConversations,
    loadingConversationId,
    loadingHistoryId,
    conversationsError,
    messagesErrorByConversation,
    sendError,
    attachmentsError,
    hasMoreHistoryByConversation,
    loadMoreHistory,
    refreshConversations,
    refreshMessages,
    sendMessage,
    editMessage,
    deleteMessage,
    toggleReaction,
    togglePin,
    retryPendingMessage,
    removePendingMessage,
    scheduleReadReceipt,
    typingByConversation,
    connectionState,
    isOffline,
    sendTyping,
    loadOrganizationMembers,
    createConversation,
    updateConversationNotifications,
    renameConversation,
    leaveConversation,
    toggleBlockUser,
    clearComposerErrors,
  };
}
