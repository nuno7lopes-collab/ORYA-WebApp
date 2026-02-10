"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { useVirtualizer } from "@tanstack/react-virtual";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { useUser } from "@/app/hooks/useUser";
import { Avatar } from "@/components/ui/avatar";
import { formatDateTime } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { getOrganizationIdFromBrowser, parseOrganizationId } from "@/lib/organizationIdUtils";
import {
  CTA_GHOST,
  CTA_NEUTRAL,
  CTA_PRIMARY,
  DASHBOARD_CARD,
  DASHBOARD_LABEL,
} from "@/app/organizacao/dashboardUi";

const WS_PING_INTERVAL_MS = 25000;
const TYPING_IDLE_MS = 1400;
const TYPING_TTL_MS = 8000;
const MAX_COMMANDS = 5;
const EMOJI_CHOICES = ["👍", "❤️", "😂", "🎯", "👏", "😅"];

type Reaction = {
  messageId: string;
  userId: string;
  emoji: string;
  createdAt: string;
  user?: {
    id: string;
    fullName: string | null;
    username: string | null;
    avatarUrl: string | null;
  } | null;
};

type Pin = {
  id: string;
  messageId: string;
  pinnedBy: string;
  pinnedAt: string;
};

type ConversationMember = {
  userId: string;
  role: "MEMBER" | "ADMIN";
  fullName: string | null;
  username: string | null;
  avatarUrl: string | null;
  lastSeenAt: string | null;
};

type ConversationItem = {
  id: string;
  type: "DIRECT" | "GROUP" | "CHANNEL";
  contextType?: string | null;
  contextId?: string | null;
  title: string | null;
  lastMessageAt: string | null;
  lastMessage: {
    id: string;
    body: string | null;
    createdAt: string;
    senderId: string | null;
  } | null;
  unreadCount: number;
  members: ConversationMember[];
  viewerLastReadMessageId: string | null;
  mutedUntil?: string | null;
  notifLevel?: "ALL" | "MENTIONS_ONLY" | "OFF";
};

type ContactRequest = {
  id: string;
  contextType: "ORG_CONTACT" | "SERVICE";
  contextId: string | null;
  createdAt: string;
  requester: {
    id: string;
    fullName: string | null;
    username: string | null;
    avatarUrl: string | null;
  };
  service?: {
    id: number;
    title: string | null;
    coverImageUrl: string | null;
  } | null;
};

type ConversationListItem = { type: "conversation"; key: string; conversation: ConversationItem };

type MemberReadState = {
  userId: string;
  role: "MEMBER" | "ADMIN";
  lastReadMessageId: string | null;
  lastReadAt: string | null;
  mutedUntil: string | null;
  notifLevel?: "ALL" | "MENTIONS_ONLY" | "OFF";
  profile: {
    id: string;
    fullName: string | null;
    username: string | null;
    avatarUrl: string | null;
    lastSeenAt: string | null;
  };
};

type Attachment = {
  id: string;
  type: "IMAGE" | "VIDEO" | "FILE";
  url: string;
  mime: string;
  size: number;
  metadata?: Record<string, unknown> | null;
};

type Message = {
  id: string;
  conversationId: string;
  body: string | null;
  kind?: "TEXT" | "SYSTEM";
  createdAt: string;
  editedAt?: string | null;
  deletedAt?: string | null;
  sender: {
    id: string;
    fullName: string | null;
    username: string | null;
    avatarUrl: string | null;
  } | null;
  attachments: Attachment[];
  replyTo?: {
    id: string;
    body: string | null;
    senderId: string | null;
    createdAt: string;
  } | null;
  reactions?: Reaction[];
  pins?: Pin[];
};

type PendingMessage = {
  conversationId: string;
  clientMessageId: string;
  body: string;
  createdAt: string;
  status: "PENDING" | "FAILED" | "QUEUED";
};

type OutgoingMessage = {
  conversationId: string;
  body: string;
  attachments: File[];
  clientMessageId: string;
};

type MessagesResponse = {
  ok: boolean;
  conversation: { id: string; type: "DIRECT" | "GROUP" | "CHANNEL"; title: string | null };
  members: MemberReadState[];
  items: Message[];
  nextCursor: string | null;
  error?: string;
};

type ConversationsResponse = {
  ok: boolean;
  items: ConversationItem[];
  error?: string;
};

type SearchResult = {
  messageId: string;
  conversationId: string;
  createdAt: string;
  snippet: string;
  rank: number;
};

type ChatEvent =
  | {
      type: "message:new";
      conversationId: string;
      message: Message;
    }
  | {
      type: "message:update";
      conversationId: string;
      message: Message;
    }
  | {
      type: "message:delete";
      conversationId: string;
      messageId: string;
      deletedAt: string;
      lastMessage?: {
        id: string;
        body: string | null;
        createdAt: string;
        senderId: string | null;
      } | null;
    }
  | {
      type: "reaction:update";
      conversationId: string;
      messageId: string;
      reactions: Reaction[];
    }
  | {
      type: "pin:update";
      conversationId: string;
      messageId: string;
      pins: Pin[];
    }
  | {
      type: "message:read";
      conversationId: string;
      userId: string;
      lastReadMessageId: string;
    }
  | {
      type: "typing:start" | "typing:stop";
      conversationId: string;
      userId: string;
    }
  | {
      type: "presence:update";
      userId: string;
      status: "online" | "offline";
      lastSeenAt?: string;
    }
  | {
      type: "conversation:update";
      conversationId: string;
    };

type MemberDirectoryItem = {
  userId: string;
  role: string;
  fullName: string | null;
  username: string | null;
  avatarUrl: string | null;
};

type OrganizationContextResponse = {
  ok: boolean;
  organization?: {
    id: number;
  } | null;
};

type TimelineItem =
  | { type: "date"; key: string; label: string }
  | { type: "message"; key: string; message: Message; messageIndex: number; isPending?: boolean; pending?: PendingMessage };

const fetcher = async <T,>(url: string, options?: RequestInit): Promise<T> => {
  const res = await fetch(url, options);
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(json?.error || "Erro ao carregar.");
  }
  return json as T;
};

function formatMessageTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return formatDateTime(date);
}

function formatDayLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const today = new Date();
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const startDate = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const diff = Math.floor((startToday - startDate) / (24 * 60 * 60 * 1000));
  if (diff === 0) return "Hoje";
  if (diff === 1) return "Ontem";
  return date.toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function generateClientMessageId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function sortMessages(items: Message[]) {
  return items
    .slice()
    .sort((a, b) => {
      const timeA = new Date(a.createdAt).getTime();
      const timeB = new Date(b.createdAt).getTime();
      if (timeA !== timeB) return timeA - timeB;
      return a.id.localeCompare(b.id);
    });
}

function isNearBottom(container: HTMLDivElement) {
  const distance = container.scrollHeight - container.scrollTop - container.clientHeight;
  return distance < 140;
}

function encodeCursor(message: { id: string; createdAt: string }) {
  const payload = JSON.stringify({ id: message.id, createdAt: message.createdAt });
  const base = typeof btoa === "function" ? btoa(payload) : Buffer.from(payload).toString("base64");
  return base.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function renderSnippet(snippet: string) {
  const tokens = snippet.split(/(<b>|<\/b>)/g);
  let bold = false;
  return tokens
    .map((token, index) => {
      if (token === "<b>") {
        bold = true;
        return null;
      }
      if (token === "</b>") {
        bold = false;
        return null;
      }
      if (!token) return null;
      return bold ? (
        <mark key={`h-${index}`} className="rounded bg-white/15 px-1 text-white">
          {token}
        </mark>
      ) : (
        <span key={`t-${index}`}>{token}</span>
      );
    })
    .filter(Boolean);
}

function buildConversationTitle(conversation: ConversationItem, viewerId: string | null) {
  if (conversation.title) return conversation.title;
  if (conversation.type === "CHANNEL") return "Canal";
  if (conversation.type === "GROUP") return "Grupo";
  const other = conversation.members.find((member) => member.userId !== viewerId) ?? null;
  if (!other) return "Conversa";
  return other.fullName?.trim() || (other.username ? `@${other.username}` : "Conversa");
}

function reactionLabel(reaction: Reaction) {
  const name = reaction.user?.fullName?.trim();
  if (name) return name;
  const username = reaction.user?.username?.trim();
  if (username) return `@${username}`;
  return reaction.user?.id ?? reaction.userId;
}

function groupReactions(reactions?: Reaction[]) {
  if (!reactions?.length) return [] as Array<{ emoji: string; count: number; users: string[] }>;
  const map = new Map<string, { count: number; users: string[] }>();
  reactions.forEach((reaction) => {
    const entry = map.get(reaction.emoji) ?? { count: 0, users: [] };
    entry.count += 1;
    const label = reactionLabel(reaction);
    if (label) entry.users.push(label);
    map.set(reaction.emoji, entry);
  });
  return Array.from(map.entries()).map(([emoji, entry]) => ({ emoji, count: entry.count, users: entry.users }));
}

export default function ChatInternoV2Client() {
  const { user, profile } = useUser();
  const searchParams = useSearchParams();
  const requestedConversationId = searchParams.get("conversationId");
  const requestedMessageId = searchParams.get("messageId");
  const organizationIdParam = parseOrganizationId(searchParams.get("organizationId"));
  const fallbackOrganizationId = organizationIdParam ?? getOrganizationIdFromBrowser();

  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [conversationsLoading, setConversationsLoading] = useState(true);
  const [conversationsError, setConversationsError] = useState<string | null>(null);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [conversationSearch, setConversationSearch] = useState("");
  const [contactRequests, setContactRequests] = useState<ContactRequest[]>([]);
  const [contactRequestsLoading, setContactRequestsLoading] = useState(false);
  const [contactRequestsError, setContactRequestsError] = useState<string | null>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [members, setMembers] = useState<MemberReadState[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesLoadingMore, setMessagesLoadingMore] = useState(false);
  const [messagesError, setMessagesError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [newMessagesCount, setNewMessagesCount] = useState(0);
  const [showNewMessageToast, setShowNewMessageToast] = useState(false);
  const [showUnreadToast, setShowUnreadToast] = useState(false);
  const [listHeight, setListHeight] = useState(0);

  const [pendingMessages, setPendingMessages] = useState<PendingMessage[]>([]);

  const [messageBody, setMessageBody] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [attachmentsError, setAttachmentsError] = useState<string | null>(null);

  const [directUserId, setDirectUserId] = useState("");
  const [groupTitle, setGroupTitle] = useState("");
  const [channelTitle, setChannelTitle] = useState("");
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [directory, setDirectory] = useState<MemberDirectoryItem[]>([]);
  const [directoryLoading, setDirectoryLoading] = useState(false);
  const [directoryError, setDirectoryError] = useState<string | null>(null);
  const [organizationId, setOrganizationId] = useState<number | null>(null);
  const [newConversationOpen, setNewConversationOpen] = useState(false);
  const [newConversationStep, setNewConversationStep] = useState<"DIRECT" | "GROUP" | "CHANNEL">("DIRECT");

  const [showSwitcher, setShowSwitcher] = useState(false);
  const [showSearchOverlay, setShowSearchOverlay] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [pendingScrollMessageId, setPendingScrollMessageId] = useState<string | null>(null);

  const [reactionPickerFor, setReactionPickerFor] = useState<string | null>(null);

  const [isOffline, setIsOffline] = useState(false);
  const [wsStatus, setWsStatus] = useState<"connecting" | "open" | "closed">("connecting");
  const [wsError, setWsError] = useState<string | null>(null);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);

  const listRef = useRef<HTMLDivElement | null>(null);
  const stickToBottomRef = useRef(true);
  const initialScrollRef = useRef<{ id: string | null; done: boolean }>({ id: null, done: false });
  const newMessageToastRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unreadToastRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastNewMessageToastAtRef = useRef(0);
  const prependAnchorRef = useRef<number | null>(null);
  const readDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const appliedConversationRef = useRef<string | null>(null);
  const lastConversationSyncRef = useRef<string | null>(null);
  const activeConversationIdRef = useRef<string | null>(null);
  const sendChainRef = useRef(Promise.resolve());
  const wsRef = useRef<WebSocket | null>(null);
  const wsReconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wsPingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wsBackoffRef = useRef(500);
  const wsConnectingRef = useRef(false);
  const connectWsRef = useRef<(() => void) | null>(null);
  const isOfflineRef = useRef(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingActiveRef = useRef(false);
  const typingConversationRef = useRef<string | null>(null);
  const typingTtlMapRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const leftPaneRef = useRef<HTMLDivElement | null>(null);
  const conversationListRef = useRef<HTMLDivElement | null>(null);
  const centerPaneRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);

  const activeConversation = useMemo(
    () => conversations.find((conv) => conv.id === activeConversationId) ?? conversations[0] ?? null,
    [activeConversationId, conversations],
  );

  const wsBaseUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    const envUrl = process.env.NEXT_PUBLIC_CHAT_WS_URL?.trim();
    if (envUrl) return envUrl;
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    return `${protocol}://${window.location.hostname}:4001`;
  }, []);

  const orderedMessages = useMemo(() => sortMessages(messages), [messages]);

  const displayMessages = useMemo(() => {
    if (!activeConversation) return orderedMessages;
    const pendingForConversation = pendingMessages
      .filter((entry) => entry.conversationId === activeConversation.id)
      .map((entry) => ({
        id: `pending:${entry.clientMessageId}`,
        conversationId: activeConversation.id,
        body: entry.body,
        createdAt: entry.createdAt,
        sender: user
          ? {
              id: user.id,
              fullName: profile?.fullName ?? null,
              username: profile?.username ?? null,
              avatarUrl: profile?.avatarUrl ?? null,
            }
          : null,
        attachments: [],
        reactions: [],
        pins: [],
      }));
    return sortMessages([...orderedMessages, ...pendingForConversation]);
  }, [activeConversation, orderedMessages, pendingMessages, user]);

  const firstUnreadMessageId = useMemo(() => {
    const lastReadId = activeConversation?.viewerLastReadMessageId;
    if (!lastReadId) return null;
    const index = displayMessages.findIndex((message) => message.id === lastReadId);
    if (index === -1) return null;
    const next = displayMessages[index + 1];
    return next?.id ?? null;
  }, [activeConversation?.viewerLastReadMessageId, displayMessages]);

  const timelineItems = useMemo(() => {
    const items: TimelineItem[] = [];
    let lastDateLabel = "";

    displayMessages.forEach((message, index) => {
      const dateLabel = formatDayLabel(message.createdAt);
      if (dateLabel !== lastDateLabel) {
        items.push({ type: "date", key: `date-${dateLabel}-${message.id}`, label: dateLabel });
        lastDateLabel = dateLabel;
      }

      const pending = pendingMessages.find((entry) => `pending:${entry.clientMessageId}` === message.id);
      items.push({
        type: "message",
        key: message.id,
        message,
        messageIndex: index,
        isPending: Boolean(pending),
        pending: pending ?? undefined,
      });
    });

    return items;
  }, [displayMessages, pendingMessages]);

  const firstUnreadTimelineIndex = useMemo(() => {
    if (!firstUnreadMessageId) return -1;
    return timelineItems.findIndex(
      (item) => item.type === "message" && item.message.id === firstUnreadMessageId,
    );
  }, [firstUnreadMessageId, timelineItems]);

  const conversationFiltered = useMemo(() => {
    const term = conversationSearch.trim().toLowerCase();
    return conversations.filter((conversation) => {
      if (!term) return true;
      const title = buildConversationTitle(conversation, user?.id ?? null).toLowerCase();
      return title.includes(term);
    });
  }, [conversationSearch, conversations, user?.id]);

  const orderedConversations = useMemo(() => {
    const sortByLast = (a: ConversationItem, b: ConversationItem) => {
      const timeA = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
      const timeB = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
      return timeB - timeA;
    };

    return conversationFiltered.slice().sort(sortByLast);
  }, [conversationFiltered]);

  const conversationListItems = useMemo<ConversationListItem[]>(
    () => orderedConversations.map((conversation) => ({ type: "conversation", key: conversation.id, conversation })),
    [orderedConversations],
  );

  const activeConversationIndex = useMemo(
    () => orderedConversations.findIndex((conversation) => conversation.id === activeConversation?.id),
    [activeConversation?.id, orderedConversations],
  );

  const conversationsVirtualizer = useVirtualizer({
    count: conversationListItems.length,
    getScrollElement: () => conversationListRef.current,
    estimateSize: () => 64,
    overscan: 8,
  });

  const messagesVirtualizer = useVirtualizer({
    count: timelineItems.length,
    getScrollElement: () => listRef.current,
    estimateSize: () => 80,
    overscan: 8,
  });

  const loadConversations = useCallback(
    async ({ incremental = false }: { incremental?: boolean } = {}) => {
      setConversationsError(null);
      if (!incremental) {
        setConversationsLoading(true);
      }

      try {
        const url = new URL("/api/chat/conversations", window.location.origin);
        if (incremental && lastConversationSyncRef.current) {
          url.searchParams.set("updatedAfter", lastConversationSyncRef.current);
        }
        const data = await fetcher<ConversationsResponse>(url.pathname + url.search);
        const items = data.items ?? [];

        if (incremental && lastConversationSyncRef.current) {
          setConversations((prev) => {
            const map = new Map(prev.map((item) => [item.id, item]));
            items.forEach((item) => map.set(item.id, { ...map.get(item.id), ...item }));
            return Array.from(map.values()).sort((a, b) => {
              const timeA = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
              const timeB = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
              return timeB - timeA;
            });
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
        setConversationsLoading(false);
      }
    },
    [activeConversationId],
  );

  const loadContactRequests = useCallback(async () => {
    setContactRequestsError(null);
    setContactRequestsLoading(true);
    try {
      const data = await fetcher<{ ok: boolean; items: ContactRequest[] }>("/api/chat/contact-requests");
      setContactRequests(data.items ?? []);
    } catch (err) {
      setContactRequestsError(err instanceof Error ? err.message : "Erro ao carregar pedidos.");
    } finally {
      setContactRequestsLoading(false);
    }
  }, []);

  const handleApproveContactRequest = useCallback(
    async (requestId: string) => {
      try {
        await fetcher(`/api/chat/contact-requests/${requestId}/approve`, { method: "POST" });
        await Promise.all([loadContactRequests(), loadConversations()]);
      } catch (err) {
        setContactRequestsError(err instanceof Error ? err.message : "Erro ao aprovar pedido.");
      }
    },
    [loadContactRequests, loadConversations],
  );

  const handleRejectContactRequest = useCallback(
    async (requestId: string) => {
      try {
        await fetcher(`/api/chat/contact-requests/${requestId}/reject`, { method: "POST" });
        await loadContactRequests();
      } catch (err) {
        setContactRequestsError(err instanceof Error ? err.message : "Erro ao rejeitar pedido.");
      }
    },
    [loadContactRequests],
  );

  const loadOrganizationId = useCallback(async () => {
    if (organizationId) return organizationId;
    if (fallbackOrganizationId) {
      setOrganizationId(fallbackOrganizationId);
      return fallbackOrganizationId;
    }
    return null;
  }, [organizationId, fallbackOrganizationId]);

  const loadDirectory = useCallback(async () => {
    setDirectoryLoading(true);
    setDirectoryError(null);
    try {
      const orgId = organizationId ?? (await loadOrganizationId());
      if (!orgId) {
        setDirectoryError("Sem organização ativa.");
        return;
      }
      const url = new URL("/api/organizacao/organizations/members", window.location.origin);
      url.searchParams.set("organizationId", String(orgId));
      const data = await fetcher<{ ok: boolean; items: MemberDirectoryItem[] }>(url.pathname + url.search);
      setDirectory(data.items ?? []);
    } catch (err) {
      setDirectoryError(err instanceof Error ? err.message : "Erro ao carregar membros.");
    } finally {
      setDirectoryLoading(false);
    }
  }, [loadOrganizationId, organizationId]);

  const triggerNewMessageToast = useCallback(() => {
    const now = Date.now();
    if (now - lastNewMessageToastAtRef.current < 4000) return;
    lastNewMessageToastAtRef.current = now;
    setShowNewMessageToast(true);
    if (newMessageToastRef.current) clearTimeout(newMessageToastRef.current);
    newMessageToastRef.current = setTimeout(() => {
      setShowNewMessageToast(false);
    }, 4000);
  }, []);

  const triggerUnreadToast = useCallback(() => {
    setShowUnreadToast(true);
    if (unreadToastRef.current) clearTimeout(unreadToastRef.current);
    unreadToastRef.current = setTimeout(() => {
      setShowUnreadToast(false);
    }, 4000);
  }, []);

  const loadMessages = useCallback(
    async ({
      conversationId,
      cursor,
      appendOlder,
      after,
      around,
      includeMembers,
      refreshWindow,
    }: {
      conversationId: string;
      cursor?: string | null;
      appendOlder?: boolean;
      after?: string | null;
      around?: string | null;
      includeMembers?: boolean;
      refreshWindow?: boolean;
    }) => {
      if (!conversationId) return;
      if (appendOlder) {
        setMessagesLoadingMore(true);
        prependAnchorRef.current = messagesVirtualizer.getTotalSize();
      } else if (after || refreshWindow) {
        // no loading state
      } else {
        setMessagesLoading(true);
      }
      setMessagesError(null);

      try {
        const url = new URL(`/api/chat/conversations/${conversationId}/messages`, window.location.origin);
        if (cursor) url.searchParams.set("cursor", cursor);
        if (after) url.searchParams.set("after", after);
        if (around) url.searchParams.set("around", around);
        if ((after || appendOlder) && includeMembers === false) {
          url.searchParams.set("includeMembers", "0");
        }
        const data = await fetcher<MessagesResponse>(url.pathname + url.search);

        if (data.members?.length) {
          setMembers(data.members);
        }
        if (!after && !appendOlder && !around && !refreshWindow) {
          setNextCursor(data.nextCursor ?? null);
        }
        if (appendOlder) {
          setNextCursor(data.nextCursor ?? null);
        }
        if (around) {
          setNextCursor(data.nextCursor ?? null);
        }

        setMessages((prev) => {
          if (refreshWindow) {
            const incoming = data.items ?? [];
            if (!incoming.length) return prev;
            const boundary = incoming[0];
            const boundaryTime = new Date(boundary.createdAt).getTime();
            const boundaryId = boundary.id;
            const incomingById = new Map(incoming.map((item) => [item.id, item]));
            const merged = prev
              .filter((item) => {
                if (incomingById.has(item.id)) return true;
                const itemTime = new Date(item.createdAt).getTime();
                const isWithinWindow =
                  itemTime > boundaryTime || (itemTime === boundaryTime && item.id >= boundaryId);
                return !isWithinWindow;
              })
              .map((item) => incomingById.get(item.id) ?? item);
            const existingIds = new Set(merged.map((item) => item.id));
            const additions = incoming.filter((item) => !existingIds.has(item.id));
            const combined = [...merged, ...additions];
            return sortMessages(combined);
          }
          if (appendOlder) {
            const existingIds = new Set(prev.map((item) => item.id));
            const nextItems = (data.items ?? []).filter((item) => !existingIds.has(item.id));
            return sortMessages([...nextItems, ...prev]);
          }
          if (after) {
            const existingIds = new Set(prev.map((item) => item.id));
            const nextItems = (data.items ?? []).filter((item) => !existingIds.has(item.id));
            if (!nextItems.length) return prev;
            return sortMessages([...prev, ...nextItems]);
          }
          return sortMessages(data.items ?? []);
        });

        if (after && data.items?.length) {
          setConversations((prev) =>
            prev.map((conv) =>
              conv.id === conversationId
                ? {
                    ...conv,
                    lastMessageAt: data.items?.[data.items.length - 1]?.createdAt ?? conv.lastMessageAt,
                    lastMessage: data.items?.[data.items.length - 1]
                      ? {
                          id: data.items[data.items.length - 1].id,
                          body: data.items[data.items.length - 1].body,
                          createdAt: data.items[data.items.length - 1].createdAt,
                          senderId: data.items[data.items.length - 1].sender?.id ?? null,
                        }
                      : conv.lastMessage,
                    unreadCount: 0,
                  }
                : conv,
            ),
          );
        }

        if (after && data.items?.length && listRef.current && !isNearBottom(listRef.current)) {
          setNewMessagesCount((prev) => prev + data.items.length);
          triggerNewMessageToast();
        }
      } catch (err) {
        setMessagesError(err instanceof Error ? err.message : "Erro ao carregar mensagens.");
      } finally {
        setMessagesLoading(false);
        setMessagesLoadingMore(false);
      }
    },
    [messagesVirtualizer, triggerNewMessageToast],
  );

  const scheduleReadReceipt = useCallback(() => {
    if (!activeConversation?.id || displayMessages.length === 0) return;
    const container = listRef.current;
    if (!container || !isNearBottom(container)) return;

    if (readDebounceRef.current) clearTimeout(readDebounceRef.current);
    const lastMessage = [...displayMessages]
      .reverse()
      .find((item) => !item.id.startsWith("pending:") && !item.deletedAt);
    if (!lastMessage) return;
    const conversationId = activeConversation.id;
    readDebounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/chat/conversations/${conversationId}/read`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lastReadMessageId: lastMessage.id }),
        });
        const json = await res.json().catch(() => null);
        if (res.ok && json?.updated !== false) {
          setConversations((prev) =>
            prev.map((conv) =>
              conv.id === conversationId
                ? { ...conv, unreadCount: 0, viewerLastReadMessageId: lastMessage.id }
                : conv,
            ),
          );
        }
      } catch {
        // ignore
      }
    }, 600);
  }, [activeConversation?.id, displayMessages]);

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

  const addTypingUser = useCallback(
    (userId: string) => {
      if (!userId || userId === user?.id) return;
      const existing = typingTtlMapRef.current.get(userId);
      if (existing) clearTimeout(existing);
      const timeout = setTimeout(() => {
        typingTtlMapRef.current.delete(userId);
        setTypingUsers((prev) => prev.filter((id) => id !== userId));
      }, TYPING_TTL_MS);
      typingTtlMapRef.current.set(userId, timeout);
      setTypingUsers((prev) => (prev.includes(userId) ? prev : [...prev, userId]));
    },
    [user?.id],
  );

  const removeTypingUser = useCallback((userId: string) => {
    const existing = typingTtlMapRef.current.get(userId);
    if (existing) clearTimeout(existing);
    typingTtlMapRef.current.delete(userId);
    setTypingUsers((prev) => prev.filter((id) => id !== userId));
  }, []);

  const applyMessageNew = useCallback(
    (payload: ChatEvent & { type: "message:new" }) => {
      const { message, conversationId } = payload;
      if (!message?.id || !conversationId) return;

      const isActive = activeConversationIdRef.current === conversationId;
      const nearBottom = isActive && listRef.current ? isNearBottom(listRef.current) : false;

      if (isActive) {
        setMessages((prev) => {
          if (prev.some((item) => item.id === message.id)) return prev;
          return sortMessages([...prev, message]);
        });
        if (!nearBottom) {
          setNewMessagesCount((prev) => prev + 1);
          triggerNewMessageToast();
        }
      }

      setConversations((prev) =>
        prev.map((conv) => {
          if (conv.id !== conversationId) return conv;
          const isSelf = message.sender?.id && message.sender.id === user?.id;
          const nextUnread =
            isActive && nearBottom
              ? 0
              : isSelf
                ? conv.unreadCount
                : (conv.unreadCount ?? 0) + 1;
          return {
            ...conv,
            lastMessageAt: message.createdAt,
            lastMessage: {
              id: message.id,
              body: message.body,
              createdAt: message.createdAt,
              senderId: message.sender?.id ?? null,
            },
            unreadCount: nextUnread,
          };
        }),
      );

      if (isActive && nearBottom) {
        scheduleReadReceipt();
      }
    },
    [scheduleReadReceipt, triggerNewMessageToast, user?.id],
  );

  const applyMessageUpdate = useCallback((payload: ChatEvent & { type: "message:update" }) => {
    const { message, conversationId } = payload;
    if (!message?.id) return;
    if (activeConversationIdRef.current === conversationId) {
      setMessages((prev) => prev.map((item) => (item.id === message.id ? message : item)));
    }
    setConversations((prev) =>
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
  }, []);

  const applyMessageDelete = useCallback((payload: ChatEvent & { type: "message:delete" }) => {
    const { messageId, conversationId, deletedAt, lastMessage } = payload;
    if (!messageId) return;
    if (activeConversationIdRef.current === conversationId) {
      setMessages((prev) =>
        prev.map((item) => (item.id === messageId ? { ...item, deletedAt } : item)),
      );
    }
    if (payload.lastMessage !== undefined) {
      setConversations((prev) =>
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
  }, []);

  const applyReactionUpdate = useCallback((payload: ChatEvent & { type: "reaction:update" }) => {
    const { messageId, conversationId, reactions } = payload;
    if (!messageId) return;
    if (activeConversationIdRef.current === conversationId) {
      setMessages((prev) =>
        prev.map((item) => (item.id === messageId ? { ...item, reactions } : item)),
      );
    }
  }, []);

  const applyPinUpdate = useCallback((payload: ChatEvent & { type: "pin:update" }) => {
    const { messageId, conversationId, pins } = payload;
    if (!messageId) return;
    if (activeConversationIdRef.current === conversationId) {
      setMessages((prev) =>
        prev.map((item) => (item.id === messageId ? { ...item, pins } : item)),
      );
    }
  }, []);

  const applyReadReceipt = useCallback((payload: ChatEvent & { type: "message:read" }) => {
    const { conversationId, userId, lastReadMessageId } = payload;
    if (activeConversationIdRef.current === conversationId) {
      setMembers((prev) =>
        prev.map((member) =>
          member.userId === userId ? { ...member, lastReadMessageId } : member,
        ),
      );
    }
    if (userId === user?.id) {
      setConversations((prev) =>
        prev.map((conv) =>
          conv.id === conversationId ? { ...conv, viewerLastReadMessageId: lastReadMessageId } : conv,
        ),
      );
    }
  }, [user?.id]);

  const applyPresenceUpdate = useCallback((payload: ChatEvent & { type: "presence:update" }) => {
    const { userId, status, lastSeenAt } = payload;
    const nextLastSeen = status === "online" ? new Date().toISOString() : lastSeenAt ?? null;
    setMembers((prev) =>
      prev.map((member) =>
        member.userId === userId
          ? { ...member, profile: { ...member.profile, lastSeenAt: nextLastSeen } }
          : member,
      ),
    );
    setConversations((prev) =>
      prev.map((conv) => ({
        ...conv,
        members: conv.members.map((member) =>
          member.userId === userId ? { ...member, lastSeenAt: nextLastSeen } : member,
        ),
      })),
    );
  }, []);

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
          if (activeConversationIdRef.current === event.conversationId) {
            addTypingUser(event.userId);
          }
          return;
        case "typing:stop":
          if (activeConversationIdRef.current === event.conversationId) {
            removeTypingUser(event.userId);
          }
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

  const connectWs = useCallback(async () => {
    if (!wsBaseUrl || isOfflineRef.current) return;
    if (wsConnectingRef.current) return;
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return;

    wsConnectingRef.current = true;
    setWsStatus("connecting");
    setWsError(null);

    const session = await supabaseBrowser.auth.getSession();
    const token = session.data.session?.access_token;
    if (!token) {
      wsConnectingRef.current = false;
      setWsStatus("closed");
      setWsError("UNAUTHENTICATED");
      scheduleWsReconnect();
      return;
    }

    const orgId = organizationId ?? (await loadOrganizationId());
    if (!orgId) {
      wsConnectingRef.current = false;
      setWsStatus("closed");
      setWsError("NO_ORG");
      scheduleWsReconnect();
      return;
    }

    const wsUrl = new URL(wsBaseUrl);
    wsUrl.searchParams.set("token", token);
    wsUrl.searchParams.set("organizationId", String(orgId));

    const ws = new WebSocket(wsUrl.toString());
    wsRef.current = ws;

    ws.onopen = () => {
      wsConnectingRef.current = false;
      wsBackoffRef.current = 500;
      setWsStatus("open");
      startWsPing();
      sendWsMessage({ type: "conversation:sync" });
      loadConversations({ incremental: true });
      const activeId = activeConversationIdRef.current;
      if (activeId) {
        loadMessages({ conversationId: activeId, refreshWindow: true });
      }
    };

    ws.onmessage = (messageEvent) => {
      try {
        const parsed = JSON.parse(messageEvent.data) as ChatEvent;
        if (!parsed?.type) return;
        handleChatEvent(parsed);
      } catch {
        // ignore malformed payloads
      }
    };

    ws.onclose = () => {
      wsConnectingRef.current = false;
      setWsStatus("closed");
      stopWsPing();
      wsRef.current = null;
      if (!isOfflineRef.current) {
        scheduleWsReconnect();
      }
    };

    ws.onerror = () => {
      wsConnectingRef.current = false;
      setWsStatus("closed");
    };
  }, [
    handleChatEvent,
    loadConversations,
    loadMessages,
    loadOrganizationId,
    organizationId,
    scheduleWsReconnect,
    sendWsMessage,
    startWsPing,
    stopWsPing,
    wsBaseUrl,
  ]);

  useEffect(() => {
    connectWsRef.current = () => {
      void connectWs();
    };
  }, [connectWs]);

  useEffect(() => {
    if (!user?.id) return;
    if (isOffline) {
      if (wsRef.current) wsRef.current.close();
      return;
    }
    void connectWs();
  }, [connectWs, isOffline, user?.id]);

  useEffect(() => {
    return () => {
      if (wsReconnectRef.current) clearTimeout(wsReconnectRef.current);
      stopWsPing();
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [stopWsPing]);

  useEffect(() => {
    setTypingUsers([]);
    typingTtlMapRef.current.forEach((timeout) => clearTimeout(timeout));
    typingTtlMapRef.current.clear();
  }, [activeConversation?.id]);

  useEffect(() => {
    loadConversations();
    loadDirectory();
    loadContactRequests();
  }, [loadConversations, loadDirectory, loadContactRequests]);

  useEffect(() => {
    activeConversationIdRef.current = activeConversation?.id ?? null;
  }, [activeConversation?.id]);


  useEffect(() => {
    if (!requestedConversationId) return;
    if (appliedConversationRef.current === requestedConversationId) return;
    const match = conversations.find((conv) => conv.id === requestedConversationId);
    if (!match) return;
    setActiveConversationId(match.id);
    appliedConversationRef.current = requestedConversationId;
  }, [conversations, requestedConversationId]);

  useEffect(() => {
    if (!requestedMessageId || !activeConversation?.id) return;
    loadMessages({ conversationId: activeConversation.id, around: requestedMessageId });
    setPendingScrollMessageId(requestedMessageId);
  }, [activeConversation?.id, loadMessages, requestedMessageId]);

  useEffect(() => {
    if (!activeConversation?.id) return;
    setMessages([]);
    setMembers([]);
    setNextCursor(null);
    setNewMessagesCount(0);
    setShowNewMessageToast(false);
    setShowUnreadToast(false);
    stickToBottomRef.current = true;
    initialScrollRef.current = { id: activeConversation.id, done: false };
    loadMessages({ conversationId: activeConversation.id });
    requestAnimationFrame(() => composerRef.current?.focus());
  }, [activeConversation?.id, loadMessages]);

  useEffect(() => {
    const conversationId = activeConversation?.id ?? null;
    if (typingConversationRef.current && typingConversationRef.current !== conversationId) {
      sendWsMessage({ type: "typing:stop", conversationId: typingConversationRef.current });
      typingConversationRef.current = null;
      typingActiveRef.current = false;
    }
    if (!conversationId) return;
    if (!messageBody.trim()) {
      if (typingActiveRef.current) {
        sendWsMessage({ type: "typing:stop", conversationId });
        typingActiveRef.current = false;
      }
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      return;
    }
    typingConversationRef.current = conversationId;
    if (!typingActiveRef.current) {
      sendWsMessage({ type: "typing:start", conversationId });
      typingActiveRef.current = true;
    }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      if (!typingConversationRef.current) return;
      sendWsMessage({ type: "typing:stop", conversationId: typingConversationRef.current });
      typingActiveRef.current = false;
    }, TYPING_IDLE_MS);
  }, [activeConversation?.id, messageBody, sendWsMessage]);

  useEffect(() => {
    const update = () => {
      const offline = typeof navigator !== "undefined" ? !navigator.onLine : false;
      setIsOffline(offline);
      isOfflineRef.current = offline;
    };
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  const handleRetryPending = useCallback(
    async (entry: PendingMessage) => {
      if (!activeConversation?.id) return;
      if (isOfflineRef.current) {
        setPendingMessages((prev) =>
          prev.map((item) =>
            item.clientMessageId === entry.clientMessageId ? { ...item, status: "QUEUED" } : item,
          ),
        );
        return;
      }
      setPendingMessages((prev) =>
        prev.map((item) =>
          item.clientMessageId === entry.clientMessageId ? { ...item, status: "PENDING" } : item,
        ),
      );
      try {
        const res = await fetcher<{ ok: boolean; message: Message }>("/api/chat/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversationId: activeConversation.id,
            body: entry.body,
            clientMessageId: entry.clientMessageId,
          }),
        });
        if (!res?.message) {
          throw new Error("Resposta inválida.");
        }
        setPendingMessages((prev) => prev.filter((item) => item.clientMessageId !== entry.clientMessageId));
        setMessages((prev) =>
          prev.some((item) => item.id === res.message.id) ? prev : sortMessages([...prev, res.message]),
        );
        setConversations((prev) =>
          prev.map((conv) =>
            conv.id === res.message.conversationId
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
        const isActive = activeConversationIdRef.current === res.message.conversationId;
        if (isActive && listRef.current) {
          if (!isNearBottom(listRef.current)) {
            setNewMessagesCount((prev) => prev + 1);
            triggerNewMessageToast();
          } else {
            scheduleReadReceipt();
          }
        }
      } catch {
        setPendingMessages((prev) =>
          prev.map((item) =>
            item.clientMessageId === entry.clientMessageId ? { ...item, status: "FAILED" } : item,
          ),
        );
      }
    },
    [activeConversation?.id, scheduleReadReceipt, triggerNewMessageToast],
  );

  useEffect(() => {
    if (isOffline) return;
    if (!pendingMessages.length) return;
    pendingMessages
      .filter((entry) => entry.status === "QUEUED" && entry.conversationId === activeConversation?.id)
      .forEach((entry) => {
        handleRetryPending(entry);
      });
  }, [activeConversation?.id, handleRetryPending, isOffline, pendingMessages]);

  useEffect(() => {
    if (prependAnchorRef.current === null) return;
    const prev = prependAnchorRef.current;
    const next = messagesVirtualizer.getTotalSize();
    const delta = next - prev;
    if (delta !== 0) {
      const currentOffset = listRef.current?.scrollTop ?? 0;
      messagesVirtualizer.scrollToOffset(currentOffset + delta);
    }
    prependAnchorRef.current = null;
  }, [displayMessages, messagesVirtualizer]);

  useEffect(() => {
    const conversationId = activeConversation?.id;
    if (!conversationId) return;
    if (pendingScrollMessageId) return;
    const initial = initialScrollRef.current;
    if (initial.id !== conversationId || initial.done) return;
    if (!displayMessages.length) return;

    const hasUnread = (activeConversation?.unreadCount ?? 0) > 0 && firstUnreadTimelineIndex >= 0;
    if (hasUnread) {
      messagesVirtualizer.scrollToIndex(firstUnreadTimelineIndex, { align: "start" });
      stickToBottomRef.current = false;
      triggerUnreadToast();
    } else {
      messagesVirtualizer.scrollToIndex(timelineItems.length - 1, { align: "end" });
      stickToBottomRef.current = true;
    }

    initialScrollRef.current = { id: conversationId, done: true };
  }, [
    activeConversation?.id,
    activeConversation?.unreadCount,
    displayMessages.length,
    firstUnreadTimelineIndex,
    messagesVirtualizer,
    pendingScrollMessageId,
    timelineItems.length,
    triggerUnreadToast,
  ]);

  useEffect(() => {
    if (!stickToBottomRef.current) return;
    if (!displayMessages.length) return;
    const raf = requestAnimationFrame(() => {
      messagesVirtualizer.scrollToIndex(timelineItems.length - 1, { align: "end" });
    });
    return () => cancelAnimationFrame(raf);
  }, [displayMessages.length, messagesVirtualizer, timelineItems.length]);

  useEffect(() => {
    if (!pendingScrollMessageId) return;
    const targetIndex = timelineItems.findIndex(
      (item) => item.type === "message" && item.message.id === pendingScrollMessageId,
    );
    if (targetIndex >= 0) {
      messagesVirtualizer.scrollToIndex(targetIndex, { align: "center" });
      setPendingScrollMessageId(null);
    }
  }, [messagesVirtualizer, pendingScrollMessageId, timelineItems]);

  useEffect(() => {
    scheduleReadReceipt();
    return () => {
      if (readDebounceRef.current) clearTimeout(readDebounceRef.current);
    };
  }, [scheduleReadReceipt]);

  useEffect(() => {
    return () => {
      if (readDebounceRef.current) clearTimeout(readDebounceRef.current);
      if (newMessageToastRef.current) clearTimeout(newMessageToastRef.current);
      if (unreadToastRef.current) clearTimeout(unreadToastRef.current);
    };
  }, []);

  useEffect(() => {
    const container = listRef.current;
    if (!container || typeof ResizeObserver === "undefined") return;
    const update = () => setListHeight(container.clientHeight);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const handleJumpToUnread = useCallback(() => {
    if (firstUnreadTimelineIndex >= 0) {
      messagesVirtualizer.scrollToIndex(firstUnreadTimelineIndex, { align: "start" });
      stickToBottomRef.current = false;
      return;
    }
    messagesVirtualizer.scrollToIndex(timelineItems.length - 1, { align: "end" });
  }, [firstUnreadTimelineIndex, messagesVirtualizer, timelineItems.length]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setShowSwitcher(true);
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "j") {
        event.preventDefault();
        handleJumpToUnread();
        return;
      }
      if (event.key === "Escape") {
        if (showSwitcher) setShowSwitcher(false);
        if (showSearchOverlay) setShowSearchOverlay(false);
      }
      if (event.key === "F6") {
        event.preventDefault();
        const panes = [leftPaneRef.current, centerPaneRef.current].filter(Boolean) as HTMLDivElement[];
        const active = document.activeElement as HTMLElement | null;
        const currentIndex = panes.findIndex((pane) => pane.contains(active));
        const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % panes.length;
        panes[nextIndex]?.focus();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [handleJumpToUnread, showSearchOverlay, showSwitcher]);

  const handleScroll = () => {
    if (!listRef.current) return;
    stickToBottomRef.current = isNearBottom(listRef.current);
    if (stickToBottomRef.current) {
      setNewMessagesCount(0);
      setShowNewMessageToast(false);
      if (newMessageToastRef.current) {
        clearTimeout(newMessageToastRef.current);
        newMessageToastRef.current = null;
      }
      scheduleReadReceipt();
    }
    if (listRef.current.scrollTop > 140) return;
    if (!nextCursor || messagesLoadingMore) return;
    loadMessages({
      conversationId: activeConversation?.id ?? "",
      cursor: nextCursor,
      appendOlder: true,
      includeMembers: false,
    });
  };

  const sendMessagePayload = useCallback(async (payload: OutgoingMessage) => {
    setAttachmentsError(null);
    try {
      let preparedAttachments: Array<{
        type: "IMAGE" | "VIDEO" | "FILE";
        url: string;
        mime: string;
        size: number;
        metadata?: Record<string, unknown>;
      }> = [];

      if (payload.attachments.length > 0) {
        const uploads = await Promise.all(
          payload.attachments.map(async (file) => {
            const type: Attachment["type"] = file.type.startsWith("image/")
              ? "IMAGE"
              : file.type.startsWith("video/")
                ? "VIDEO"
                : "FILE";
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
          conversationId: payload.conversationId,
          body: payload.body,
          attachments: preparedAttachments,
          clientMessageId: payload.clientMessageId,
        }),
      });
      if (!res?.message) {
        throw new Error("Resposta inválida.");
      }
      return res.message;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao enviar.";
      setAttachmentsError(message);
      setMessagesError(message);
      throw err;
    }
  }, []);

  const applySendSuccess = useCallback(
    (clientMessageId: string, message: Message) => {
      setPendingMessages((prev) => prev.filter((item) => item.clientMessageId !== clientMessageId));
      setMessages((prev) => (prev.some((item) => item.id === message.id) ? prev : sortMessages([...prev, message])));
      setConversations((prev) =>
        prev.map((conv) =>
          conv.id === message.conversationId
            ? {
                ...conv,
                lastMessageAt: message.createdAt,
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
      if (activeConversationIdRef.current === message.conversationId && listRef.current) {
        if (!isNearBottom(listRef.current)) {
          setNewMessagesCount((prev) => prev + 1);
          triggerNewMessageToast();
        } else {
          scheduleReadReceipt();
        }
      }
    },
    [scheduleReadReceipt, triggerNewMessageToast],
  );

  const enqueueSend = useCallback(
    (payload: OutgoingMessage) => {
      const clientMessageId = payload.clientMessageId;
      const chain = sendChainRef.current
        .catch(() => undefined)
        .then(() => sendMessagePayload(payload));
      sendChainRef.current = chain
        .then((message) => applySendSuccess(clientMessageId, message))
        .catch(() => {
          setPendingMessages((prev) =>
            prev.map((item) =>
              item.clientMessageId === clientMessageId ? { ...item, status: "FAILED" } : item,
            ),
          );
        });
    },
    [applySendSuccess, sendMessagePayload],
  );

  const handleSendMessage = async () => {
    if (!activeConversation?.id) return;
    if (!messageBody.trim() && attachments.length === 0) return;

    if (isOffline) {
      if (attachments.length > 0) {
        setAttachmentsError("Não é possível enviar anexos offline.");
        return;
      }
      const pendingId = generateClientMessageId();
      setPendingMessages((prev) => [
        ...prev,
        {
          conversationId: activeConversation.id,
          clientMessageId: pendingId,
          body: messageBody.trim(),
          createdAt: new Date().toISOString(),
          status: "QUEUED",
        },
      ]);
      setMessageBody("");
      setAttachments([]);
      return;
    }

    const clientMessageId = generateClientMessageId();
    setPendingMessages((prev) => [
      ...prev,
      {
        conversationId: activeConversation.id,
        clientMessageId,
        body: messageBody.trim(),
        createdAt: new Date().toISOString(),
        status: "PENDING",
      },
    ]);
    const payload: OutgoingMessage = {
      conversationId: activeConversation.id,
      body: messageBody.trim(),
      attachments: [...attachments],
      clientMessageId,
    };
    setMessagesError(null);
    setMessageBody("");
    setAttachments([]);
    sendWsMessage({ type: "typing:stop", conversationId: activeConversation.id });
    typingActiveRef.current = false;
    enqueueSend(payload);
  };

  const handleAttachmentChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;
    setAttachments((prev) => [...prev, ...files]);
    event.target.value = "";
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleCreateConversation = async () => {
    if (newConversationStep === "DIRECT" && !directUserId) return;
    if (newConversationStep === "GROUP" && (groupTitle.trim().length < 2 || selectedMemberIds.length === 0)) return;
    if (newConversationStep === "CHANNEL" && channelTitle.trim().length < 2) return;

    try {
      const payload: Record<string, unknown> = {
        type: newConversationStep,
      };
      if (newConversationStep === "DIRECT") {
        payload.userId = directUserId;
      }
      if (newConversationStep === "GROUP") {
        payload.title = groupTitle.trim();
        payload.memberIds = selectedMemberIds;
      }
      if (newConversationStep === "CHANNEL") {
        payload.title = channelTitle.trim();
        payload.memberIds = selectedMemberIds;
      }
      const res = await fetcher<{ ok: boolean; conversation: ConversationItem }>("/api/chat/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res?.conversation?.id) {
        setActiveConversationId(res.conversation.id);
        loadConversations();
        sendWsMessage({ type: "conversation:sync" });
      }
      setDirectUserId("");
      setGroupTitle("");
      setChannelTitle("");
      setSelectedMemberIds([]);
      setNewConversationOpen(false);
    } catch (err) {
      setConversationsError(err instanceof Error ? err.message : "Erro ao criar conversa.");
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    const confirmed = window.confirm("Remover esta mensagem?");
    if (!confirmed) return;
    try {
      const res = await fetcher<{ ok: boolean; deletedAt: string }>(`/api/chat/messages/${messageId}`, {
        method: "DELETE",
      });
      if (res?.deletedAt) {
        setMessages((prev) => prev.map((item) => (item.id === messageId ? { ...item, deletedAt: res.deletedAt } : item)));
      }
    } catch {
      // ignore
    }
  };

  const handleToggleReaction = async (message: Message, emoji: string) => {
    if (!user?.id) return;
    const existingReaction = (message.reactions ?? []).find((reaction) => reaction.userId === user.id) ?? null;
    const hasReacted = existingReaction?.emoji === emoji;
    try {
      await fetcher(`/api/chat/messages/${message.id}/reactions`, {
        method: hasReacted ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji }),
      });
      setMessages((prev) =>
        prev.map((item) =>
          item.id === message.id
            ? {
                ...item,
                reactions: hasReacted
                  ? (item.reactions ?? []).filter((reaction) => reaction.userId !== user.id)
                  : [
                      ...(item.reactions ?? []).filter((reaction) => reaction.userId !== user.id),
                      {
                        messageId: message.id,
                        userId: user.id,
                        emoji,
                        createdAt: new Date().toISOString(),
                        user: {
                          id: user.id,
                          fullName: profile?.fullName ?? null,
                          username: profile?.username ?? null,
                          avatarUrl: profile?.avatarUrl ?? null,
                        },
                      },
                    ],
              }
            : item,
        ),
      );
    } catch {
      // ignore
    } finally {
      setReactionPickerFor(null);
    }
  };


  const handleSearch = async () => {
    if (!searchQuery.trim() || !activeConversation?.id) return;
    setSearchLoading(true);
    try {
      const url = new URL("/api/chat/search", window.location.origin);
      url.searchParams.set("query", searchQuery.trim());
      url.searchParams.set("conversationId", activeConversation.id);
      const data = await fetcher<{ ok: boolean; items: SearchResult[] }>(url.pathname + url.search);
      setSearchResults(data.items ?? []);
    } catch {
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleJumpToMessage = async (result: SearchResult) => {
    if (!activeConversation?.id) return;
    setShowSearchOverlay(false);
    await loadMessages({ conversationId: activeConversation.id, around: result.messageId });
    setPendingScrollMessageId(result.messageId);
  };

  const scrollToMessageId = useCallback(
    async (messageId: string) => {
      const timelineIndex = timelineItems.findIndex(
        (item) => item.type === "message" && item.message.id === messageId,
      );
      if (timelineIndex >= 0) {
        messagesVirtualizer.scrollToIndex(timelineIndex, { align: "center" });
        return;
      }
      if (activeConversation?.id) {
        await loadMessages({ conversationId: activeConversation.id, around: messageId });
        setPendingScrollMessageId(messageId);
      }
    },
    [activeConversation?.id, loadMessages, messagesVirtualizer, timelineItems],
  );

  const handleUpdateNotifSettings = async (level: "ALL" | "MENTIONS_ONLY" | "OFF", mutedUntil: string | null) => {
    if (!activeConversation?.id) return;
    try {
      const res = await fetcher<{ ok: boolean; notifLevel: string; mutedUntil: string | null }>(
        `/api/chat/conversations/${activeConversation.id}/notifications`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notifLevel: level, mutedUntil }),
        },
      );
      setConversations((prev) =>
        prev.map((conv) =>
          conv.id === activeConversation.id
            ? { ...conv, notifLevel: res.notifLevel as ConversationItem["notifLevel"], mutedUntil: res.mutedUntil }
            : conv,
        ),
      );
    } catch {
      // ignore
    }
  };

  const activeTypingLabel = useMemo(() => {
    if (typingUsers.length === 0) {
      return "";
    }
    const names = typingUsers.map((userId) => {
      const member = members.find((item) => item.userId === userId);
      return member?.profile.fullName ?? member?.profile.username ?? "Alguem";
    });
    if (names.length === 1) return `${names[0]} a escrever...`;
    if (names.length === 2) return `${names[0]} e ${names[1]} a escrever...`;
    return `${names[0]} e mais ${names.length - 1} a escrever...`;
  }, [members, typingUsers]);

  const connectionLabel = useMemo(() => {
    if (isOffline) return "Offline";
    if (wsError) return "Indisponível";
    if (wsStatus !== "open") return "A reconectar";
    return "";
  }, [isOffline, wsError, wsStatus]);

  const isMessageReadByAll = useCallback(
    (message: Message) => {
      if (!message.sender?.id) return false;
      if (message.sender.id !== user?.id) return false;
      if (!members.length) return false;
      const messageTime = new Date(message.createdAt).getTime();
      return members
        .filter((member) => member.userId !== user?.id)
        .every((member) => {
          if (member.lastReadAt) {
            const readTime = new Date(member.lastReadAt).getTime();
            if (!Number.isFinite(readTime) || !Number.isFinite(messageTime)) return false;
            if (readTime > messageTime) return true;
            if (readTime < messageTime) return false;
          }
          if (!member.lastReadMessageId) return false;
          return member.lastReadMessageId >= message.id;
        });
    },
    [members, user?.id],
  );

  const commands = useMemo(() => ["/me", "/todo", "/reuniao", "/risco", "/status"], []);
  const showCommandPalette = messageBody.trim().startsWith("/");
  const filteredCommands = commands
    .filter((cmd) => cmd.startsWith(messageBody.trim()))
    .slice(0, MAX_COMMANDS);

  const conversationMembersCount = members.length || activeConversation?.members?.length || 0;
  const headerTitle = useMemo(() => {
    if (!activeConversation) return "Conversa";
    const title = buildConversationTitle(activeConversation, user?.id ?? null);
    return activeConversation.type === "CHANNEL" && activeConversation.contextType === "ORG_CHANNEL"
      ? `# ${title}`
      : title;
  }, [activeConversation, user?.id]);
  const headerAvatarUrl = useMemo(() => {
    if (!activeConversation) return null;
    const directMember = members.find((member) => member.userId !== user?.id) ?? members[0] ?? null;
    return directMember?.profile.avatarUrl ?? null;
  }, [activeConversation, members, user?.id]);
  const actionPill =
    "rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-white/70 transition hover:-translate-y-[1px] hover:border-white/20 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20";
  const subtlePill =
    "rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[9px] tracking-wide text-white/55";
  return (
    <div className={cn(DASHBOARD_CARD, "flex h-full min-h-0 flex-col overflow-hidden")}>
      <div className="flex min-h-0 flex-1">
        <div className="mx-auto flex min-h-0 w-full max-w-[1320px] flex-1 px-4 py-4">
          <div className="grid min-h-0 w-full flex-1 grid-cols-[320px_minmax(0,1fr)] overflow-hidden rounded-3xl border border-white/10 bg-black/10 shadow-[0_18px_50px_rgba(0,0,0,0.35)]">
          <section
            ref={leftPaneRef}
            tabIndex={-1}
            className="flex min-h-0 min-w-0 flex-col gap-2.5 border-r border-white/10 bg-[var(--orya-surface-1)]/85 p-2.5 outline-none focus:ring-2 focus:ring-[#6BFFFF]/50"
            aria-label="Lista de conversas"
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                const nextIndex = Math.min(orderedConversations.length - 1, activeConversationIndex + 1);
                const next = orderedConversations[nextIndex];
                if (next) setActiveConversationId(next.id);
              }
              if (event.key === "ArrowUp") {
                event.preventDefault();
                const nextIndex = Math.max(0, activeConversationIndex - 1);
                const next = orderedConversations[nextIndex];
                if (next) setActiveConversationId(next.id);
              }
              if (event.key === "Enter" && activeConversation) {
                event.preventDefault();
                setActiveConversationId(activeConversation.id);
              }
            }}
          >
        <header className="space-y-1.5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[12px] font-semibold text-white">Conversas</p>
            </div>
            <button
              type="button"
              className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/70 transition hover:border-white/20 hover:bg-white/10"
              onClick={() => setNewConversationOpen(true)}
              aria-label="Nova conversa"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                <path
                  d="M12 5v14M5 12h14"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
          <div className="relative">
            <input
              value={conversationSearch}
              onChange={(event) => setConversationSearch(event.target.value)}
              placeholder="Pesquisar"
              className="w-full rounded-full border border-white/10 bg-black/25 px-3 py-1.5 text-[12px] text-white outline-none transition focus:border-white/40 focus:ring-2 focus:ring-white/10"
            />
          </div>
        </header>

        {contactRequestsLoading ? (
          <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-[11px] text-white/60">
            A carregar pedidos...
          </div>
        ) : contactRequestsError ? (
          <div className="rounded-xl border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-100">
            {contactRequestsError}
          </div>
        ) : contactRequests.length > 0 ? (
          <div className="rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-[11px] text-white/70">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[11px] font-semibold text-white/85">Pedidos de contacto</p>
              <button
                type="button"
                className={cn(CTA_NEUTRAL, "h-6 px-2 text-[10px]")}
                onClick={() => loadContactRequests()}
              >
                Atualizar
              </button>
            </div>
            <div className="space-y-2">
              {contactRequests.map((request) => {
                const requesterName =
                  request.requester.fullName?.trim() ||
                  (request.requester.username ? `@${request.requester.username}` : "Cliente");
                const subtitle =
                  request.contextType === "SERVICE"
                    ? request.service?.title
                      ? `Serviço · ${request.service.title}`
                      : "Serviço"
                    : "Pedido geral";
                return (
                  <div
                    key={request.id}
                    className="rounded-lg border border-white/10 bg-black/20 px-2.5 py-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-[11px] font-semibold text-white/90">{requesterName}</p>
                        <p className="truncate text-[10px] text-white/50">{subtitle}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className={cn(CTA_PRIMARY, "h-7 px-2 text-[10px]")}
                          onClick={() => handleApproveContactRequest(request.id)}
                        >
                          Aprovar
                        </button>
                        <button
                          type="button"
                          className={cn(CTA_GHOST, "h-7 px-2 text-[10px]")}
                          onClick={() => handleRejectContactRequest(request.id)}
                        >
                          Rejeitar
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        {conversationsLoading ? (
          <div className="space-y-2">
            {[...Array(4)].map((_, idx) => (
              <div key={idx} className="h-14 rounded-xl border border-white/10 bg-black/20 animate-pulse" />
            ))}
          </div>
        ) : conversationsError ? (
          <div className="rounded-xl border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-[12px] text-rose-100">
            {conversationsError}
          </div>
        ) : conversationFiltered.length === 0 ? (
          <div className="rounded-xl border border-white/12 bg-black/20 px-3 py-4 text-center text-[12px] text-white/60">
            <p>Ainda não tens conversas.</p>
            <button
              type="button"
              className={cn(CTA_NEUTRAL, "mt-3 text-[11px]")}
              onClick={() => setNewConversationOpen(true)}
            >
              Nova conversa
            </button>
          </div>
        ) : (
          <div
            ref={conversationListRef}
            className="relative min-h-0 flex-1 overflow-y-auto pr-1 orya-scrollbar-hide"
          >
            <div
              className="relative"
              style={{ height: `${conversationsVirtualizer.getTotalSize()}px` }}
            >
              {conversationsVirtualizer.getVirtualItems().map((virtualRow) => {
                const row = conversationListItems[virtualRow.index];
                if (!row) return null;
                const conversation = row.conversation;
                const isActive = conversation.id === activeConversation?.id;
                const unread = conversation.unreadCount > 0;
                const title = buildConversationTitle(conversation, user?.id ?? null);
                const displayTitle =
                  conversation.type === "CHANNEL" && conversation.contextType === "ORG_CHANNEL"
                    ? `# ${title}`
                    : title;
                const lastTime = conversation.lastMessageAt ? formatMessageTime(conversation.lastMessageAt) : "";
                const lastPreview =
                  conversation.lastMessage?.body ??
                  (conversation.lastMessage ? "Anexo" : "Sem mensagens");
                const primaryMember =
                  conversation.type === "DIRECT"
                    ? conversation.members.find((member) => member.userId !== user?.id) ??
                      conversation.members[0] ??
                      null
                    : conversation.members[0] ?? null;
                const avatarName =
                  primaryMember?.fullName ||
                  (primaryMember?.username ? `@${primaryMember.username}` : title);
                const avatarUrl = primaryMember?.avatarUrl ?? null;
                const muted = conversation.mutedUntil
                  ? new Date(conversation.mutedUntil) > new Date()
                  : false;
                const isCustomerConversation =
                  conversation.contextType && conversation.contextType !== "ORG_CHANNEL";
                return (
                  <div
                    key={conversation.id}
                    ref={conversationsVirtualizer.measureElement}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setActiveConversationId(conversation.id)}
                      className={cn(
                        "group relative w-full border-b border-white/5 px-3 py-2 text-left transition",
                        isActive ? "bg-white/8" : "bg-transparent hover:bg-white/5",
                      )}
                      aria-current={isActive ? "true" : undefined}
                    >
                      {isActive ? <span className="absolute left-0 top-0 h-full w-1 bg-[#6BFFFF]/70" /> : null}
                      <div className="flex items-center gap-3">
                        <Avatar
                          src={avatarUrl}
                          name={avatarName}
                          className="h-9 w-9 border border-white/12 shadow-[0_6px_12px_rgba(0,0,0,0.3)]"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex min-w-0 items-center gap-2">
                              <p className="truncate text-[13px] font-semibold text-white/95">{displayTitle}</p>
                              {isCustomerConversation ? (
                                <span className={subtlePill}>Cliente</span>
                              ) : null}
                            </div>
                            {lastTime ? <span className="text-[10px] text-white/45">{lastTime}</span> : null}
                          </div>
                          <div className="mt-0.5 flex items-center justify-between gap-2">
                            <p className="min-w-0 flex-1 truncate text-[11px] text-white/55">{lastPreview}</p>
                            <div className="flex items-center gap-2">
                              {muted ? <span className="text-[10px] text-white/35">Silenciado</span> : null}
                              {unread ? (
                                <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-emerald-400 px-2 text-[10px] font-semibold text-emerald-950">
                                  {conversation.unreadCount}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      <section
        ref={centerPaneRef}
        tabIndex={-1}
        className="flex min-h-0 min-w-0 flex-col bg-[var(--orya-surface-2)] outline-none focus:ring-2 focus:ring-[#6BFFFF]/50"
        aria-label="Conversacao ativa"
      >
        <header className="flex items-center justify-between border-b border-white/10 px-4 py-2">
          <div className="flex items-center gap-2.5">
            <Avatar
              src={headerAvatarUrl}
              name={headerTitle}
              className="h-8 w-8 border border-white/15"
            />
            <div className="min-w-0">
              <p className="truncate text-[14px] font-semibold text-white">{headerTitle}</p>
              <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-white/55">
                <span>{activeConversation ? `${conversationMembersCount} membros` : "—"}</span>
                <button
                  type="button"
                  className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-white/70 hover:border-white/20 hover:bg-white/5"
                >
                  Ver membros
                </button>
                {activeTypingLabel ? <span className="text-emerald-200">{activeTypingLabel}</span> : null}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {connectionLabel ? (
              <span className="rounded-full border border-white/10 bg-black/30 px-2 py-1 text-[10px] text-white/70">
                {connectionLabel}
              </span>
            ) : null}
            <button
              type="button"
              onClick={() => setShowSearchOverlay(true)}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/70 transition hover:border-white/20 hover:bg-white/10"
              aria-label="Pesquisar"
              disabled={!activeConversation}
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.6" fill="none" />
                <path
                  d="M20 20l-3.5-3.5"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            </button>
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/70 transition hover:border-white/20 hover:bg-white/10"
              aria-label="Mais opções"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                <circle cx="5" cy="12" r="1.6" fill="currentColor" />
                <circle cx="12" cy="12" r="1.6" fill="currentColor" />
                <circle cx="19" cy="12" r="1.6" fill="currentColor" />
              </svg>
            </button>
          </div>
        </header>

        {isOffline ? (
          <div className="mx-4 mt-2 rounded-xl border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-100">
            Offline — a enviar quando voltar
          </div>
        ) : null}
        {messagesError ? (
          <div className="mx-4 mt-2 rounded-2xl border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-[12px] text-rose-100">
            {messagesError}
          </div>
        ) : null}

        <div className="relative min-h-0 flex-1">
          <div
            ref={listRef}
            onScroll={handleScroll}
            role="log"
            aria-live="polite"
            aria-relevant="additions"
            className="h-full min-h-0 overflow-y-auto px-4 py-2.5 orya-scrollbar-hide"
          >
            <div className="w-full">
              {!activeConversation ? (
                <div className="rounded-2xl border border-dashed border-white/15 bg-black/20 px-4 py-4 text-center text-[12px] text-white/60">
                  <p className="text-sm font-semibold text-white/80">Seleciona uma conversa</p>
                  <p className="mt-1 text-[12px] text-white/60">
                    Escolhe um chat à esquerda ou cria uma nova conversa.
                  </p>
                </div>
              ) : messagesLoading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, idx) => (
                    <div key={idx} className="h-10 rounded-2xl border border-white/10 bg-black/20 animate-pulse" />
                  ))}
                </div>
              ) : displayMessages.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/15 bg-black/20 px-4 py-4 text-center text-[12px] text-white/60">
                  <p className="text-sm font-semibold text-white/80">Ainda sem mensagens</p>
                  <p className="mt-1 text-[12px] text-white/60">Diz olá ou partilha um ficheiro para começar.</p>
                </div>
              ) : (
                <div
                  style={{ height: `${Math.max(messagesVirtualizer.getTotalSize(), listHeight)}px` }}
                  className="relative"
                >
                  {messagesVirtualizer.getVirtualItems().map((virtualRow) => {
                    const item = timelineItems[virtualRow.index];
                    if (!item) return null;
                    const bottomOffset = Math.max(listHeight - messagesVirtualizer.getTotalSize(), 0);
                    if (item.type === "date") {
                      return (
                        <div
                          key={item.key}
                          ref={messagesVirtualizer.measureElement}
                          style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            width: "100%",
                            transform: `translateY(${virtualRow.start + bottomOffset}px)`,
                          }}
                          className="flex items-center justify-center py-2"
                        >
                          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-white/60">
                            {item.label}
                          </span>
                        </div>
                      );
                    }

                    const message = item.message;
                    const pending = item.pending;
                    const prevMessage = item.messageIndex > 0 ? displayMessages[item.messageIndex - 1] : null;
                    const sameAuthor = prevMessage?.sender?.id && prevMessage?.sender?.id === message.sender?.id;
                    const sameTime = prevMessage
                      ? new Date(message.createdAt).getTime() - new Date(prevMessage.createdAt).getTime() < 5 * 60 * 1000
                      : false;
                    const grouped = sameAuthor && sameTime;
                    const groupedReactions = groupReactions(message.reactions);
                    const isDeleted = Boolean(message.deletedAt);
                    const isOwn = message.sender?.id === user?.id;
                    const nameLabel =
                      message.sender?.fullName ||
                      (message.sender?.username ? `@${message.sender.username}` : "Utilizador");
                    const showAvatar = !grouped && !isOwn;

                    return (
                      <div
                        key={item.key}
                        ref={messagesVirtualizer.measureElement}
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          width: "100%",
                          transform: `translateY(${virtualRow.start + bottomOffset}px)`,
                        }}
                        className={cn(
                          "group flex w-full gap-2",
                          grouped ? "py-2" : "py-3",
                          isOwn ? "justify-end" : "justify-start",
                        )}
                      >
                        {!isOwn ? (
                          showAvatar ? (
                            <Avatar
                              src={message.sender?.avatarUrl}
                              name={message.sender?.fullName ?? message.sender?.username ?? "U"}
                              className="h-8 w-8 border border-white/15"
                            />
                          ) : (
                            <div className="h-8 w-8" />
                          )
                        ) : null}
                        <div
                          className={cn(
                            "flex max-w-[68%] flex-col sm:max-w-[64%] lg:max-w-[60%]",
                            isOwn ? "items-end text-right" : "items-start",
                          )}
                        >
                          {!grouped ? (
                            <div
                              className={cn(
                                "mb-0.5 flex flex-wrap items-center gap-2 text-[10px] text-white/55",
                                isOwn ? "justify-end" : "justify-start",
                              )}
                            >
                              <span className="font-semibold text-white/85">{isOwn ? "Tu" : nameLabel}</span>
                              <span>{formatMessageTime(message.createdAt)}</span>
                              {message.editedAt ? <span className="text-white/40">(editado)</span> : null}
                              {isOwn && isMessageReadByAll(message) ? <span className="text-white/40">✓✓ Lida</span> : null}
                            </div>
                          ) : null}
                          <div className="relative w-fit max-w-full">
                            <div
                              className={cn(
                                "w-fit max-w-full rounded-2xl border px-3.5 py-2 text-[13px] leading-[1.45] shadow-[0_6px_12px_rgba(0,0,0,0.18)]",
                                isOwn
                                  ? "border-emerald-200/25 bg-emerald-500/16 text-white"
                                  : "border-white/10 bg-white/5 text-white/90",
                                isDeleted ? "opacity-70" : "",
                              )}
                            >
                            {message.replyTo ? (
                              <div className="mt-1 rounded-lg border border-white/10 bg-black/20 px-2 py-1 text-[11px] text-white/60">
                                <span className="block border-l-2 border-white/20 pl-2">
                                  A responder a {message.replyTo.senderId === user?.id ? "ti" : "mensagem"}
                                </span>
                              </div>
                            ) : null}
                            {isDeleted ? (
                              <p className="mt-1 text-[12px] text-white/40">Mensagem removida.</p>
                            ) : message.body ? (
                              <p className="mt-1 whitespace-pre-wrap text-[13px] leading-[1.5] text-white/90">
                                {message.body}
                              </p>
                            ) : null}

                            {!isDeleted && message.attachments?.length ? (
                              <div className="mt-1 grid gap-2 sm:grid-cols-2">
                                {message.attachments.map((att) => (
                                  <div
                                    key={att.id}
                                    className="rounded-xl border border-white/10 bg-black/20 p-2 text-[11px] text-white/70"
                                  >
                                    {att.type === "IMAGE" ? (
                                      <Image
                                        src={att.url}
                                        alt="Anexo"
                                        width={448}
                                        height={112}
                                        sizes="(max-width: 640px) 100vw, 50vw"
                                        className="h-28 w-full rounded-lg object-cover"
                                      />
                                    ) : (
                                      <a
                                        href={att.url}
                                        className="text-white/80 underline"
                                        target="_blank"
                                        rel="noreferrer"
                                      >
                                        {att.metadata?.name ? String(att.metadata.name) : "Abrir ficheiro"}
                                      </a>
                                    )}
                                    <p className="mt-1 text-white/50">{att.mime}</p>
                                  </div>
                                ))}
                              </div>
                            ) : null}

                            {!isDeleted && groupedReactions.length ? (
                              <div
                                className={cn(
                                  "absolute -bottom-2 flex flex-wrap gap-1 rounded-full border border-white/10 bg-black/50 px-2 py-0.5 text-[9px] text-white/80 shadow-[0_10px_20px_rgba(0,0,0,0.35)]",
                                  isOwn ? "right-2" : "left-2",
                                )}
                              >
                                {groupedReactions.map((reaction) => {
                                  const tooltip = reaction.users.join(", ");
                                  return (
                                    <span
                                      key={reaction.emoji}
                                      className="flex items-center gap-1"
                                      title={tooltip}
                                      aria-label={tooltip ? `${reaction.emoji} por ${tooltip}` : reaction.emoji}
                                    >
                                      {reaction.emoji} {reaction.count}
                                    </span>
                                  );
                                })}
                              </div>
                            ) : null}

                            {!isDeleted ? (
                              <div
                                className={cn(
                                  "absolute -top-3 flex items-center gap-1 rounded-full border border-white/10 bg-black/60 px-2 py-1 text-[10px] text-white/70 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100 pointer-events-none group-hover:pointer-events-auto",
                                  isOwn ? "right-0" : "left-0",
                                )}
                              >
                                <button
                                  type="button"
                                  onClick={() => setReactionPickerFor(message.id)}
                                  className={actionPill}
                                  aria-label="Reagir"
                                >
                                  Reagir
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteMessage(message.id)}
                                  className={cn(
                                    actionPill,
                                    "border-rose-300/30 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20",
                                  )}
                                  aria-label="Apagar"
                                >
                                  Apagar
                                </button>
                              </div>
                            ) : null}

                            {reactionPickerFor === message.id ? (
                              <div
                                className={cn(
                                  "absolute z-20 mt-2 flex flex-wrap gap-2 rounded-xl border border-white/10 bg-black/80 p-2",
                                  isOwn ? "right-0 top-full" : "left-0 top-full",
                                )}
                              >
                                {EMOJI_CHOICES.map((emoji) => (
                                  <button
                                    key={emoji}
                                    type="button"
                                    className="rounded-full border border-white/10 px-2 py-1 text-[12px] hover:bg-white/10"
                                    onClick={() => handleToggleReaction(message, emoji)}
                                  >
                                    {emoji}
                                  </button>
                                ))}
                              </div>
                            ) : null}

                            {pending?.status === "FAILED" ? (
                              <p className="mt-2 text-[11px] text-amber-200/80">Falha ao enviar.</p>
                            ) : null}
                          {pending?.status === "PENDING" || pending?.status === "QUEUED" ? (
                            <p className="mt-2 text-[11px] text-white/45">A enviar...</p>
                          ) : null}
                          </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {showUnreadToast && firstUnreadTimelineIndex >= 0 ? (
                    (() => {
                      const marker = messagesVirtualizer
                        .getVirtualItems()
                        .find((row) => row.index === firstUnreadTimelineIndex);
                      if (!marker) return null;
                      const bottomOffset = Math.max(listHeight - messagesVirtualizer.getTotalSize(), 0);
                      const top = marker.start + bottomOffset - 18;
                      return (
                        <div
                          className="pointer-events-none absolute left-4 right-4 flex items-center justify-center"
                          style={{ top: `${Math.max(top, 8)}px` }}
                        >
                          <span className="rounded-full border border-emerald-300/40 bg-emerald-500/15 px-3 py-1 text-[10px] font-semibold text-emerald-100">
                            Mensagens não lidas
                          </span>
                        </div>
                      );
                    })()
                  ) : null}
                </div>
              )}
            </div>
          </div>
          {showUnreadToast ? (
            <div className="absolute left-1/2 top-3 -translate-x-1/2 rounded-full border border-white/10 bg-black/70 px-3 py-1 text-[11px] text-white/80 shadow-[0_12px_30px_rgba(0,0,0,0.35)]">
              Não lidas
            </div>
          ) : null}
          {showNewMessageToast && newMessagesCount > 0 ? (
            <button
              type="button"
              className="absolute bottom-3 right-4 rounded-full border border-emerald-300/40 bg-emerald-500/20 px-3 py-1 text-[11px] font-semibold text-emerald-100 shadow-[0_12px_30px_rgba(0,0,0,0.35)]"
              onClick={() => {
                messagesVirtualizer.scrollToIndex(timelineItems.length - 1, { align: "end" });
                stickToBottomRef.current = true;
                setNewMessagesCount(0);
                setShowNewMessageToast(false);
                scheduleReadReceipt();
              }}
            >
              Novas mensagens ({newMessagesCount})
            </button>
          ) : null}
        </div>

        <div className="shrink-0 border-t border-white/10 bg-[var(--orya-surface-2)] px-4 py-3">
          {showCommandPalette && filteredCommands.length ? (
            <div className="mb-2 rounded-2xl border border-white/10 bg-black/40 p-2 text-[11px] text-white/80">
              {filteredCommands.map((cmd) => (
                <button
                  key={cmd}
                  type="button"
                  onClick={() => setMessageBody(cmd + " ")}
                  className="block w-full rounded-lg px-2 py-1 text-left hover:bg-white/5"
                >
                  {cmd}
                </button>
              ))}
            </div>
          ) : null}
          {attachmentsError ? <p className="mb-2 text-[11px] text-rose-200">{attachmentsError}</p> : null}
          {attachments.length > 0 ? (
            <div className="mb-2 flex flex-wrap gap-2 text-[11px] text-white/70">
              {attachments.map((file, idx) => (
                <span
                  key={`${file.name}-${idx}`}
                  className="flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1"
                >
                  {file.name}
                  <button type="button" onClick={() => removeAttachment(idx)} className="text-white/40">
                    ×
                  </button>
                </span>
              ))}
            </div>
          ) : null}
          <div className="flex items-end gap-2">
            <label className={cn(actionPill, "cursor-pointer")}>
              <input type="file" multiple onChange={handleAttachmentChange} className="sr-only" />
              Anexos
            </label>
            <textarea
              ref={composerRef}
              value={messageBody}
              onChange={(event) => setMessageBody(event.target.value)}
              className="min-h-[44px] w-full flex-1 resize-none rounded-2xl border border-white/10 bg-black/20 px-4 py-2 text-[13px] text-white outline-none transition focus:border-white/40 focus:ring-2 focus:ring-white/10"
              placeholder="Escreve a tua mensagem..."
              disabled={!activeConversation}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  handleSendMessage();
                }
              }}
            />
            <button
              type="button"
              className={cn(CTA_PRIMARY, "text-[12px] hover:scale-[1.02]")}
              onClick={handleSendMessage}
              disabled={!activeConversation || (!messageBody.trim() && attachments.length === 0)}
            >
              Enviar
            </button>
          </div>
          <p className="mt-2 text-[10px] text-white/35">Enter envia • Shift+Enter nova linha</p>
        </div>
      </section>
          </div>
        </div>
      </div>

      {newConversationOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div
            className={cn(
              DASHBOARD_CARD,
              "w-full max-w-lg rounded-3xl border border-white/12 bg-black/80 p-5 text-white shadow-[0_24px_70px_rgba(0,0,0,0.6)]",
            )}
          >
            <header className="flex items-center justify-between">
              <div>
                <p className={DASHBOARD_LABEL}>Nova conversa</p>
                <h3 className="text-lg font-semibold">Criar conversa</h3>
              </div>
              <button
                type="button"
                className={cn(CTA_GHOST, "text-[11px]")}
                onClick={() => setNewConversationOpen(false)}
              >
                Fechar
              </button>
            </header>

            <div className="mt-4 flex gap-2 text-[11px]">
              {(["DIRECT", "GROUP", "CHANNEL"] as const).map((step) => (
                <button
                  key={step}
                  type="button"
                  className={cn(
                    "rounded-full border px-3 py-1",
                    newConversationStep === step
                      ? "border-white/30 bg-white/15 text-white"
                      : "border-white/10 text-white/60",
                  )}
                  onClick={() => setNewConversationStep(step)}
                >
                  {step === "DIRECT" ? "Direta" : step === "GROUP" ? "Grupo" : "Canal"}
                </button>
              ))}
            </div>

            <div className="mt-4 space-y-3">
              {directoryLoading ? (
                <p className="text-[12px] text-white/60">A carregar membros...</p>
              ) : directoryError ? (
                <p className="text-[12px] text-rose-200">{directoryError}</p>
              ) : null}
              {newConversationStep === "DIRECT" ? (
                <label className="text-[12px] text-white/70">
                  Direta
                  <select
                    value={directUserId}
                    onChange={(event) => setDirectUserId(event.target.value)}
                    className="mt-1 w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                  >
                    <option value="">Seleciona um membro</option>
                    {directory
                      .filter((member) => member.userId !== user?.id)
                      .map((member) => {
                        const label =
                          member.fullName?.trim() || (member.username ? `@${member.username}` : "Membro");
                        return (
                          <option key={member.userId} value={member.userId}>
                            {label}
                          </option>
                        );
                      })}
                  </select>
                </label>
              ) : null}

              {newConversationStep === "GROUP" ? (
                <label className="text-[12px] text-white/70">
                  Titulo do grupo
                  <input
                    value={groupTitle}
                    onChange={(event) => setGroupTitle(event.target.value)}
                    className="mt-1 w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                    placeholder="Nome do grupo"
                  />
                </label>
              ) : null}

              {newConversationStep === "CHANNEL" ? (
                <label className="text-[12px] text-white/70">
                  Titulo do canal
                  <input
                    value={channelTitle}
                    onChange={(event) => setChannelTitle(event.target.value)}
                    className="mt-1 w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                    placeholder="Nome do canal"
                  />
                </label>
              ) : null}

              {(newConversationStep === "GROUP" || newConversationStep === "CHANNEL") && (
                <div className="max-h-40 space-y-2 overflow-y-auto rounded-xl border border-white/10 bg-black/30 p-2 text-[11px] text-white/70">
                  {directory
                    .filter((member) => member.userId !== user?.id)
                    .map((member) => {
                      const label =
                        member.fullName?.trim() || (member.username ? `@${member.username}` : "Membro");
                      const checked = selectedMemberIds.includes(member.userId);
                      return (
                        <label key={member.userId} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              setSelectedMemberIds((prev) =>
                                checked
                                  ? prev.filter((id) => id !== member.userId)
                                  : [...prev, member.userId],
                              );
                            }}
                          />
                          <span>{label}</span>
                        </label>
                      );
                    })}
                </div>
              )}
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className={cn(CTA_GHOST, "text-[12px]")} onClick={() => setNewConversationOpen(false)}>
                Cancelar
              </button>
              <button
                type="button"
                className={cn(CTA_PRIMARY, "text-[12px]")}
                onClick={handleCreateConversation}
              >
                Criar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showSwitcher ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div
            className={cn(
              DASHBOARD_CARD,
              "w-full max-w-lg rounded-3xl border border-white/12 bg-black/80 p-5 text-white shadow-[0_24px_70px_rgba(0,0,0,0.6)]",
            )}
          >
            <header className="flex items-center justify-between">
              <div>
                <p className={DASHBOARD_LABEL}>Switcher</p>
                <h3 className="text-lg font-semibold">Trocar conversa</h3>
              </div>
              <button type="button" className={cn(CTA_GHOST, "text-[11px]")} onClick={() => setShowSwitcher(false)}>
                Fechar
              </button>
            </header>
            <div className="mt-4 space-y-2">
              {conversations.map((conversation) => (
                <button
                  key={conversation.id}
                  type="button"
                  onClick={() => {
                    setActiveConversationId(conversation.id);
                    setShowSwitcher(false);
                  }}
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-left text-[12px] text-white/80"
                >
                  {buildConversationTitle(conversation, user?.id ?? null)}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {showSearchOverlay ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div
            className={cn(
              DASHBOARD_CARD,
              "w-full max-w-2xl rounded-3xl border border-white/12 bg-black/80 p-5 text-white shadow-[0_24px_70px_rgba(0,0,0,0.6)]",
            )}
          >
            <header className="flex items-center justify-between">
              <div>
                <p className={DASHBOARD_LABEL}>Pesquisa</p>
                <h3 className="text-lg font-semibold">Pesquisar mensagens</h3>
              </div>
              <button type="button" className={cn(CTA_GHOST, "text-[11px]")} onClick={() => setShowSearchOverlay(false)}>
                Fechar
              </button>
            </header>
            <div className="mt-4 flex gap-2">
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Pesquisar nesta conversa"
                className="flex-1 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    handleSearch();
                  }
                }}
              />
              <button type="button" className={cn(CTA_PRIMARY, "text-[12px]")} onClick={handleSearch}>
                Pesquisar
              </button>
            </div>
            <div className="mt-4 space-y-2">
              {searchLoading ? (
                <p className="text-[12px] text-white/60">A pesquisar...</p>
              ) : searchResults.length === 0 ? (
                <p className="text-[12px] text-white/60">Sem resultados.</p>
              ) : (
                searchResults.map((result) => (
                  <button
                    key={result.messageId}
                    type="button"
                    onClick={() => handleJumpToMessage(result)}
                    className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-left text-[12px] text-white/80"
                  >
                    <p className="text-[10px] text-white/50">{formatMessageTime(result.createdAt)}</p>
                    <p>{renderSnippet(result.snippet)}</p>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
