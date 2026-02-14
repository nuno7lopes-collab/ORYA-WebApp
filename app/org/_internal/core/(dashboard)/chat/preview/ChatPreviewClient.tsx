"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { useChatPreviewData } from "./useChatPreviewData";
import type {
  ChatFilterId,
  ConversationPreview,
  MessageAction,
  MessagePreview,
  MemberReadState,
  OrganizationMemberDirectoryItem,
  ReplyPreview,
  SkeletonRow,
} from "./chat-preview.types";

type ChatFilter = {
  id: ChatFilterId;
  label: string;
  count?: number;
  active?: boolean;
};

const filterDefinitions: { id: ChatFilterId; label: string }[] = [
  { id: "all", label: "Todos" },
  { id: "unread", label: "Nao lidas" },
  { id: "mentions", label: "Mentions" },
  { id: "groups", label: "Grupos" },
];

const skeletonRows: SkeletonRow[] = [
  { id: "skel-1", align: "left", widthClass: "w-[52%]" },
  { id: "skel-2", align: "left", widthClass: "w-[38%]" },
  { id: "skel-3", align: "right", widthClass: "w-[44%]" },
  { id: "skel-4", align: "left", widthClass: "w-[60%]" },
  { id: "skel-5", align: "right", widthClass: "w-[36%]" },
  { id: "skel-6", align: "left", widthClass: "w-[46%]" },
];

const showReconnectBanner = true;
const showNewMessagesDivider = true;
const showNewMessagesPill = true;
const showTypingIndicator = true;
const showSkeletons = false;
const showDateDivider = true;
const showPinnedBanner = true;
const sidebarState: "default" | "empty" | "empty-search" = "default";
const conversationState: "default" | "empty" | "no-messages" = "default";
const sidebarToggleId = "chat-sidebar-toggle";

const reactionOptions = ["👍", "❤️", "🎉", "😄", "👀", "✅"];
const emojiOptions = ["🙂", "🙌", "✅", "🎉", "👍", "❤️", "🔥", "🤝", "👏", "💡"];
const headerMemberLimit = 3;

function formatDayLabel(value?: string) {
  if (!value) return "Hoje";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Hoje";
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const diffDays = Math.round((startOfToday - startOfDate) / (24 * 60 * 60 * 1000));
  if (diffDays === 0) return "Hoje";
  if (diffDays === 1) return "Ontem";
  return new Intl.DateTimeFormat("pt-PT", { day: "2-digit", month: "short" }).format(date);
}

function getInitials(label: string) {
  const normalized = label.trim().replace(/^@+/, "");
  const parts = normalized.split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function renderMessageText(text: string, mentionTokens: string[]) {
  const tokens = Array.from(new Set(mentionTokens.map((token) => token.trim()).filter(Boolean))).sort(
    (a, b) => b.length - a.length,
  );
  if (tokens.length === 0) return text;
  const pattern = new RegExp(`(^|\\s)(${tokens.map(escapeRegex).join("|")})(?=\\s|$)`, "gi");
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    const prefix = match[1] ?? "";
    const mention = match[2] ?? "";
    const mentionStart = match.index + prefix.length;
    if (mentionStart > lastIndex) {
      parts.push(text.slice(lastIndex, mentionStart));
    }
    parts.push(
      <span
        key={`${mentionStart}-${mention}`}
        className="rounded-md bg-amber-200/15 px-1 text-amber-100/90"
      >
        {text.slice(mentionStart, mentionStart + mention.length)}
      </span>,
    );
    lastIndex = mentionStart + mention.length;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts;
}

function resolveMemberLabel(member: MemberReadState) {
  return member.profile.fullName?.trim() || (member.profile.username ? `@${member.profile.username}` : "Utilizador");
}

function resolveDirectoryLabel(member: OrganizationMemberDirectoryItem) {
  return member.fullName?.trim() || (member.username ? `@${member.username}` : "Utilizador");
}

function isMemberOnline(member: MemberReadState) {
  if (!member.profile.lastSeenAt) return false;
  const time = new Date(member.profile.lastSeenAt).getTime();
  if (!Number.isFinite(time)) return false;
  return Date.now() - time <= 5 * 60 * 1000;
}

function MessageStatus({ status }: { status: MessagePreview["status"] }) {
  if (!status) return null;
  if (status === "sending") {
    return <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white/40 motion-reduce:animate-none" />;
  }
  if (status === "failed") {
    return (
      <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full border border-rose-200/40 text-[9px] font-semibold text-rose-200">
        !
      </span>
    );
  }

  const isRead = status === "read";
  const isDouble = status === "delivered" || status === "read";
  const tone = isRead ? "text-emerald-200" : "text-white/50";
  const sizeClass = "h-3.5 w-3.5";

  if (isDouble) {
    return (
      <svg
        viewBox="0 0 16 12"
        className={`${sizeClass} ${tone}`}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M1 6.5L4.5 10L10 4.5" />
        <path d="M6 6.5L9.5 10L15 4.5" />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 16 12"
      className={`${sizeClass} ${tone}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M1 6.5L4.5 10L14.5 1.5" />
    </svg>
  );
}

function ChatSidebar({
  className = "",
  showCloseButton = false,
  toggleId,
  conversations,
  activeConversationId,
  onSelectConversation,
  onCreateConversation,
  loading = false,
  errorMessage,
  onRetry,
}: {
  className?: string;
  showCloseButton?: boolean;
  toggleId?: string;
  conversations: ConversationPreview[];
  activeConversationId: string | null;
  onSelectConversation: (conversationId: string) => void;
  onCreateConversation?: () => void;
  loading?: boolean;
  errorMessage?: string | null;
  onRetry?: () => void;
}) {
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<ChatFilterId>("all");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleShortcut = (event: globalThis.KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  const normalizedQuery = query.trim().toLowerCase();

  const filterCounts = useMemo(
    () => ({
      unread: conversations.filter((item) => item.unread > 0).length,
      mentions: conversations.filter((item) => item.hasMention).length,
      groups: conversations.filter((item) => item.isGroup).length,
    }),
    [conversations],
  );

  const filteredConversations = useMemo(() => {
    let items = conversations;
    if (activeFilter === "unread") {
      items = items.filter((item) => item.unread > 0);
    } else if (activeFilter === "mentions") {
      items = items.filter((item) => item.hasMention);
    } else if (activeFilter === "groups") {
      items = items.filter((item) => item.isGroup);
    }

    if (!normalizedQuery) return items;

    return items.filter((item) => {
      const haystack = `${item.name} ${item.snippet}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [activeFilter, normalizedQuery, conversations]);

  const filters: ChatFilter[] = useMemo(
    () =>
      filterDefinitions.map((filter) => ({
        ...filter,
        count:
          filter.id === "unread"
            ? filterCounts.unread
            : filter.id === "mentions"
              ? filterCounts.mentions
              : filter.id === "groups"
                ? filterCounts.groups
                : undefined,
        active: filter.id === activeFilter,
      })),
    [activeFilter, filterCounts],
  );

  const pinned = filteredConversations.filter((item) => item.isPinned);
  const recent = filteredConversations.filter((item) => !item.isPinned);
  const sections: { label: string; items: ConversationPreview[] }[] = [];
  if (pinned.length > 0) sections.push({ label: "Fixadas", items: pinned });
  if (recent.length > 0) sections.push({ label: "Recentes", items: recent });

  const resolvedSidebarState =
    sidebarState === "default"
      ? conversations.length === 0
        ? "empty"
        : filteredConversations.length === 0
          ? "empty-search"
          : "default"
      : sidebarState;

  const handleConversationSelect = (conversationId: string) => {
    onSelectConversation(conversationId);
    if (!toggleId) return;
    const toggle = document.getElementById(toggleId) as HTMLInputElement | null;
    if (toggle) {
      toggle.checked = false;
    }
  };

  const handleCreateClick = () => {
    onCreateConversation?.();
    if (!toggleId) return;
    const toggle = document.getElementById(toggleId) as HTMLInputElement | null;
    if (toggle) {
      toggle.checked = false;
    }
  };

  return (
    <aside
      className={cn(
        "flex h-full min-h-0 flex-col rounded-3xl border border-white/10 bg-white/5 shadow-[0_24px_60px_rgba(0,0,0,0.45)] backdrop-blur-2xl",
        className,
      )}
      aria-label="Lista de conversas"
    >
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-white/50">Chat interno</p>
          <h1 className="text-lg font-semibold text-white">Conversas</h1>
        </div>
        {showCloseButton && toggleId ? (
          <label
            htmlFor={toggleId}
            aria-label="Fechar lista"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/12 bg-white/10 text-base text-white/70 transition hover:bg-white/15"
          >
            x
          </label>
        ) : null}
      </div>

      <div className="px-4 pb-3 pt-4">
        <div className="flex items-center gap-2">
          <input
            type="search"
            placeholder="Pesquisar conversas"
            aria-label="Pesquisar conversas"
            ref={searchRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="h-10 w-full rounded-full border border-white/12 bg-white/10 px-4 text-sm text-white/80 placeholder:text-white/45 focus:outline-none focus:ring-1 focus:ring-white/25"
          />
          <button
            type="button"
            aria-label="Nova conversa"
            onClick={handleCreateClick}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/12 bg-white/10 text-base text-white/80 transition hover:bg-white/15 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/40"
          >
            +
          </button>
        </div>
        <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-1 orya-scrollbar-hide">
          {filters.map((filter) => (
            <button
              key={filter.id}
              type="button"
              aria-pressed={filter.active ? "true" : "false"}
              onClick={() => setActiveFilter(filter.id)}
              className={cn(
                "flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold transition focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/40",
                filter.active
                  ? "border-white/20 bg-white/15 text-white/85"
                  : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10",
              )}
            >
              <span>{filter.label}</span>
              {filter.count ? (
                <span className="rounded-full border border-white/10 bg-white/10 px-1.5 text-[10px] text-white/70">
                  {filter.count}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      {errorMessage ? (
        <div className="mx-4 mb-2 rounded-2xl border border-rose-200/30 bg-rose-200/10 px-3 py-2 text-[11px] text-rose-100">
          <p>{errorMessage}</p>
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="mt-2 rounded-full border border-rose-200/40 px-3 py-1 text-[10px] font-semibold text-rose-100 transition hover:bg-rose-200/10"
            >
              Tentar novamente
            </button>
          ) : null}
        </div>
      ) : null}
      {loading && conversations.length === 0 ? (
        <div className="mx-4 flex flex-col gap-2">
          <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-[11px] text-white/50">
            A carregar conversas...
          </div>
          {[1, 2, 3, 4].map((row) => (
            <div
              key={`sidebar-skeleton-${row}`}
              className="flex h-16 items-center gap-3 rounded-2xl border border-white/8 bg-white/4 px-3"
              aria-hidden="true"
            >
              <div className="h-9 w-9 rounded-full border border-white/8 bg-white/6 animate-pulse" />
              <div className="flex flex-1 flex-col gap-2">
                <div className="h-3 w-2/3 rounded-full bg-white/6 animate-pulse" />
                <div className="h-2.5 w-1/2 rounded-full bg-white/5 animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-2 pb-3">
        {resolvedSidebarState === "empty" ? (
          <div className="flex min-h-[240px] flex-1 flex-col items-center justify-center gap-3 px-4 text-center">
            <p className="text-sm font-semibold text-white/80">Sem conversas</p>
            <p className="text-[12px] text-white/50">
              Inicia uma conversa para organizar a equipa.
            </p>
            <button
              type="button"
              onClick={handleCreateClick}
              className="rounded-full border border-white/12 bg-white/10 px-4 py-2 text-[12px] font-semibold text-white/80 transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/40"
            >
              Criar conversa
            </button>
          </div>
        ) : resolvedSidebarState === "empty-search" ? (
          <div className="flex min-h-[240px] flex-1 flex-col items-center justify-center gap-3 px-4 text-center">
            <p className="text-sm font-semibold text-white/80">Sem resultados</p>
            <p className="text-[12px] text-white/50">
              Ajusta os filtros ou a pesquisa.
            </p>
            <button
              type="button"
              onClick={handleCreateClick}
              className="rounded-full border border-white/12 bg-white/10 px-4 py-2 text-[12px] font-semibold text-white/80 transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/40"
            >
              Nova conversa
            </button>
          </div>
        ) : (
          sections.map((section) => (
            <div key={section.label} className="pt-2">
              <p className="px-3 pb-1 text-[10px] uppercase tracking-[0.2em] text-white/35">
                {section.label}
              </p>
              <div className="flex flex-col gap-1">
                {section.items.map((item, itemIndex) => {
                  const unreadLabel = item.unread > 99 ? "99+" : String(item.unread);
                  const mutedUntil = item.mutedUntil ? new Date(item.mutedUntil) : null;
                  const isMuted =
                    item.notifLevel === "OFF" || (mutedUntil ? mutedUntil.getTime() > Date.now() : false);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      aria-current={item.id === activeConversationId ? "true" : undefined}
                      onClick={() => handleConversationSelect(item.id)}
                      style={{ animationDelay: `${itemIndex * 30}ms` }}
                      className={cn(
                        "flex h-16 w-full items-center gap-3 rounded-2xl border px-3 text-left transition animate-fade-slide motion-reduce:animate-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/30",
                        item.id === activeConversationId
                          ? "border-white/25 bg-white/12 shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
                          : "border-transparent hover:border-white/10 hover:bg-white/8",
                      )}
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/10 text-[12px] font-semibold text-white/80">
                        {getInitials(item.name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-sm font-semibold text-white">{item.name}</p>
                          <div className="flex shrink-0 items-center gap-2 text-[11px] text-white/50">
                            {isMuted ? (
                              <span className="rounded-full border border-amber-200/30 bg-amber-200/15 px-1.5 text-[9px] font-semibold text-amber-100/80">
                                M
                              </span>
                            ) : null}
                            {item.hasMention ? (
                              <span className="rounded-full border border-amber-200/30 bg-amber-200/15 px-1.5 text-[9px] font-semibold text-amber-100/80">
                                @
                              </span>
                            ) : null}
                            <span>{item.time}</span>
                          </div>
                        </div>
                        <p className="truncate text-[12px] text-white/60">{item.snippet}</p>
                      </div>
                      {item.unread > 0 ? (
                        <span className="flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full border border-emerald-200/30 bg-emerald-400/20 px-1 text-[11px] font-semibold text-emerald-100">
                          {unreadLabel}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}

export default function ChatPreviewPage() {
  const {
    conversations,
    viewerId,
    mentionTokens,
    activeConversationId,
    setActiveConversationId,
    messagesByConversation,
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
  } = useChatPreviewData();
  const [draft, setDraft] = useState("");
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [pendingNewCount, setPendingNewCount] = useState(0);
  const [unreadMarkerByConversation, setUnreadMarkerByConversation] = useState<Record<string, number | null>>({});
  const [replyToMessage, setReplyToMessage] = useState<ReplyPreview | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState("");
  const [messageAction, setMessageAction] = useState<MessageAction | null>(null);
  const [isEmojiOpen, setIsEmojiOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [isMembersOpen, setIsMembersOpen] = useState(false);
  const [isHeaderMenuOpen, setIsHeaderMenuOpen] = useState(false);
  const [membersSearch, setMembersSearch] = useState("");
  const [headerActionError, setHeaderActionError] = useState<string | null>(null);
  const [headerActionLoading, setHeaderActionLoading] = useState(false);
  const [blockedUserIds, setBlockedUserIds] = useState<string[]>([]);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [renameTitle, setRenameTitle] = useState("");
  const [renameError, setRenameError] = useState<string | null>(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [isLeaveOpen, setIsLeaveOpen] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const [isLeaving, setIsLeaving] = useState(false);
  const [createMode, setCreateMode] = useState<"direct" | "group">("direct");
  const [orgMembers, setOrgMembers] = useState<OrganizationMemberDirectoryItem[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [membersQuery, setMembersQuery] = useState("");
  const [selectedDirectMember, setSelectedDirectMember] = useState<string | null>(null);
  const [selectedGroupMembers, setSelectedGroupMembers] = useState<string[]>([]);
  const [groupTitle, setGroupTitle] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const messageListRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const messageActionRef = useRef<HTMLDivElement>(null);
  const headerMenuRef = useRef<HTMLDivElement>(null);
  const membersPanelRef = useRef<HTMLDivElement>(null);
  const unreadMarkerRef = useRef<HTMLDivElement>(null);
  const isPrependingHistoryRef = useRef(false);
  const scrollPositionsRef = useRef<Record<string, number>>({});
  const messageCountRef = useRef(0);
  const isAtBottomRef = useRef(isAtBottom);
  const typingTimeoutRef = useRef<number | null>(null);
  const typingActiveRef = useRef(false);
  const prependScrollRef = useRef<{ conversationId: string; height: number; top: number } | null>(
    null,
  );

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "auto") => {
    const list = messageListRef.current;
    if (!list) return;
    list.scrollTo({ top: list.scrollHeight, behavior });
  }, []);

  const resizeComposer = useCallback(() => {
    const element = composerRef.current;
    if (!element) return;
    element.style.height = "auto";
    const nextHeight = Math.min(element.scrollHeight, 140);
    element.style.height = `${nextHeight}px`;
  }, []);

  const updateIsAtBottom = useCallback(() => {
    const list = messageListRef.current;
    if (!list) return;
    const threshold = 36;
    const atBottom = list.scrollHeight - list.scrollTop - list.clientHeight <= threshold;
    setIsAtBottom(atBottom);
    isAtBottomRef.current = atBottom;
    if (atBottom) {
      setPendingNewCount(0);
    }
  }, []);

  useEffect(() => {
    if (conversationState === "empty") {
      if (activeConversationId !== null) {
        setActiveConversationId(null);
      }
      return;
    }

    if (!activeConversationId && conversations.length > 0) {
      setActiveConversationId(conversations[0].id);
    }
  }, [conversationState, activeConversationId, conversations]);

  useEffect(() => {
    isAtBottomRef.current = isAtBottom;
  }, [isAtBottom]);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        window.clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!messageAction) return;
    const handlePointerDown = (event: globalThis.MouseEvent) => {
      const target = event.target as HTMLElement;
      if (messageActionRef.current?.contains(target)) return;
      if (target.closest("[data-message-action-button]")) return;
      setMessageAction(null);
    };
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setMessageAction(null);
      }
    };
    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [messageAction]);

  useEffect(() => {
    if (!isMembersOpen && !isHeaderMenuOpen) return;
    const handlePointerDown = (event: globalThis.MouseEvent) => {
      const target = event.target as HTMLElement;
      if (membersPanelRef.current?.contains(target)) return;
      if (headerMenuRef.current?.contains(target)) return;
      if (target.closest("[data-header-menu-button]")) return;
      if (target.closest("[data-members-button]")) return;
      setIsMembersOpen(false);
      setIsHeaderMenuOpen(false);
    };
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsMembersOpen(false);
        setIsHeaderMenuOpen(false);
      }
    };
    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMembersOpen, isHeaderMenuOpen]);

  const handleOpenCreate = useCallback(() => {
    setIsCreateOpen(true);
    setCreateError(null);
    setMembersError(null);
    setMembersQuery("");
    setSelectedDirectMember(null);
    setSelectedGroupMembers([]);
    setGroupTitle("");
    setIsMembersOpen(false);
    setIsHeaderMenuOpen(false);
  }, []);

  const handleCloseCreate = useCallback(() => {
    setIsCreateOpen(false);
    setCreateError(null);
  }, []);

  useEffect(() => {
    if (!isCreateOpen) return;
    let isActive = true;
    setMembersLoading(true);
    setMembersError(null);
    void loadOrganizationMembers()
      .then((items) => {
        if (!isActive) return;
        setOrgMembers(items);
        if (!items.length) {
          setMembersError("Sem membros disponiveis.");
        }
      })
      .catch(() => {
        if (!isActive) return;
        setMembersError("Nao foi possivel carregar membros.");
      })
      .finally(() => {
        if (isActive) {
          setMembersLoading(false);
        }
      });
    return () => {
      isActive = false;
    };
  }, [isCreateOpen, loadOrganizationMembers]);

  useEffect(() => {
    if (!isCreateOpen) return;
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        handleCloseCreate();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleCloseCreate, isCreateOpen]);

  // Esc handlers for rename/leave modal are registered after handlers are defined.

  const activeConversation = useMemo(
    () => conversations.find((item) => item.id === activeConversationId) ?? null,
    [conversations, activeConversationId],
  );
  const isGroupConversation = Boolean(activeConversation?.isGroup);

  const activeMessages = useMemo(
    () => (activeConversationId ? messagesByConversation[activeConversationId] ?? [] : []),
    [activeConversationId, messagesByConversation],
  );

  const resolvedConversationState =
    conversationState === "default"
      ? activeMessages.length === 0
        ? "no-messages"
        : "default"
      : conversationState;

  const hasActiveConversation = resolvedConversationState !== "empty" && Boolean(activeConversation);
  const hasMessageHistory = resolvedConversationState === "default";
  const unreadMarkerIndex = activeConversationId
    ? unreadMarkerByConversation[activeConversationId] ?? null
    : null;
  const resolvedUnreadMarkerIndex =
    unreadMarkerIndex !== null && unreadMarkerIndex < activeMessages.length
      ? unreadMarkerIndex
      : unreadMarkerIndex === 0 && activeMessages.length === 0
        ? 0
        : null;
  const shouldShowNewMessagesDivider = showNewMessagesDivider && resolvedUnreadMarkerIndex !== null;
  const pinnedMessage = activeConversationId ? pinnedMessageByConversation[activeConversationId] ?? null : null;
  const shouldShowSkeletons =
    showSkeletons || loadingConversationId === activeConversationId || (loadingConversations && !activeConversationId);
  const mentionCandidates = useMemo(() => {
    if (!activeConversationId) return [];
    const members = membersByConversation[activeConversationId] ?? [];
    return members
      .filter((member) => member.userId !== viewerId)
      .map((member) => resolveMemberLabel(member));
  }, [activeConversationId, membersByConversation, viewerId]);
  const mentionSuggestions = useMemo(() => {
    if (!mentionOpen || mentionQuery === null) return [];
    const query = mentionQuery.toLowerCase();
    if (!query) return mentionCandidates.slice(0, 6);
    return mentionCandidates
      .filter((member) => member.toLowerCase().includes(query))
      .slice(0, 6);
  }, [mentionOpen, mentionQuery, mentionCandidates]);
  const hasMoreHistory = !!activeConversationId && Boolean(hasMoreHistoryByConversation[activeConversationId]);
  const activeMembers = useMemo(() => {
    if (!activeConversationId) return [];
    return membersByConversation[activeConversationId] ?? [];
  }, [activeConversationId, membersByConversation]);
  const activeMessagesError = activeConversationId ? messagesErrorByConversation[activeConversationId] ?? null : null;
  const headerMembers = useMemo(() => {
    if (!isGroupConversation) return [];
    const others = activeMembers.filter((member) => member.userId !== viewerId);
    return others.length > 0 ? others : activeMembers;
  }, [activeMembers, isGroupConversation, viewerId]);
  const directMember = useMemo(() => {
    if (!hasActiveConversation || isGroupConversation) return null;
    return activeMembers.find((member) => member.userId !== viewerId) ?? null;
  }, [activeMembers, hasActiveConversation, isGroupConversation, viewerId]);
  const viewerMembership = useMemo(
    () => activeMembers.find((member) => member.userId === viewerId) ?? null,
    [activeMembers, viewerId],
  );
  const isGroupAdmin = Boolean(isGroupConversation && viewerMembership?.role === "ADMIN");
  const directProfileHref = directMember?.profile.username ? `/${directMember.profile.username}` : null;
  const headerMemberSummary = useMemo(() => {
    if (!isGroupConversation || headerMembers.length === 0) return null;
    const names = headerMembers.map((member) => resolveMemberLabel(member));
    const visible = names.slice(0, headerMemberLimit);
    if (visible.length === 0) return null;
    const suffix = names.length > visible.length ? ", ..." : "";
    return `${visible.join(", ")}${suffix}`;
  }, [headerMembers, isGroupConversation]);
  const filteredMembers = useMemo(() => {
    const query = membersSearch.trim().toLowerCase();
    if (!query) return activeMembers;
    return activeMembers.filter((member) => resolveMemberLabel(member).toLowerCase().includes(query));
  }, [activeMembers, membersSearch]);
  const availableMembers = useMemo(() => {
    return orgMembers
      .filter((member) => member.userId !== viewerId)
      .slice()
      .sort((a, b) => resolveDirectoryLabel(a).localeCompare(resolveDirectoryLabel(b)));
  }, [orgMembers, viewerId]);
  const filteredDirectory = useMemo(() => {
    const query = membersQuery.trim().toLowerCase();
    const base = availableMembers;
    if (!query) return base;
    return base.filter((member) => resolveDirectoryLabel(member).toLowerCase().includes(query));
  }, [availableMembers, membersQuery]);
  const mutedUntil = activeConversation?.mutedUntil ? new Date(activeConversation.mutedUntil) : null;
  const notifLevel: "ALL" | "MENTIONS_ONLY" | "OFF" = activeConversation?.notifLevel ?? "ALL";
  const isMuted = notifLevel === "OFF" || (mutedUntil ? mutedUntil.getTime() > Date.now() : false);
  const isBlocked = directMember ? blockedUserIds.includes(directMember.userId) : false;
  const connectionLabel = useMemo(() => {
    if (isOffline) return "Offline";
    if (connectionState === "reconnecting") return "A reconectar";
    return "";
  }, [connectionState, isOffline]);

  const handleSelectConversation = (conversationId: string) => {
    if (activeConversationId && messageListRef.current) {
      scrollPositionsRef.current[activeConversationId] = messageListRef.current.scrollTop;
    }
    setActiveConversationId(conversationId);
    setReplyToMessage(null);
    setEditingMessageId(null);
    setEditingDraft("");
    setMessageAction(null);
    setIsMembersOpen(false);
    setIsHeaderMenuOpen(false);
    setHeaderActionError(null);
    setIsEmojiOpen(false);
    setMentionOpen(false);
    setDraft("");
    clearComposerErrors();
    setMembersSearch("");
    if (composerRef.current) {
      composerRef.current.style.height = "36px";
    }
    setPendingNewCount(0);
    setIsAtBottom(true);
    if (typingActiveRef.current && activeConversationId) {
      sendTyping(activeConversationId, false);
      typingActiveRef.current = false;
    }
    if (typingTimeoutRef.current) {
      window.clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
  };

  const handleLoadMoreHistory = useCallback(() => {
    if (!activeConversationId || loadingHistoryId || !hasMoreHistory) return;
    const list = messageListRef.current;
    if (!list) return;
    prependScrollRef.current = {
      conversationId: activeConversationId,
      height: list.scrollHeight,
      top: list.scrollTop,
    };
    isPrependingHistoryRef.current = true;
    loadMoreHistory(activeConversationId);
  }, [activeConversationId, loadingHistoryId, hasMoreHistory, loadMoreHistory]);

  const handleMessageScroll = useCallback(() => {
    updateIsAtBottom();
    if (messageAction) {
      setMessageAction(null);
    }
    if (!activeConversationId || shouldShowSkeletons) return;
    const list = messageListRef.current;
    if (!list) return;
    scrollPositionsRef.current[activeConversationId] = list.scrollTop;
    if (isAtBottomRef.current) {
      scheduleReadReceipt(activeConversationId);
    }
    if (
      resolvedUnreadMarkerIndex !== null &&
      unreadMarkerRef.current &&
      list.scrollTop + list.clientHeight >= unreadMarkerRef.current.offsetTop
    ) {
      setUnreadMarkerByConversation((prev) => ({
        ...prev,
        [activeConversationId]: null,
      }));
      setPendingNewCount(0);
      scheduleReadReceipt(activeConversationId);
    }
    if (loadingHistoryId || !hasMoreHistory) return;
    if (list.scrollTop <= 32) {
      handleLoadMoreHistory();
    }
  }, [
    updateIsAtBottom,
    messageAction,
    activeConversationId,
    shouldShowSkeletons,
    loadingHistoryId,
    hasMoreHistory,
    handleLoadMoreHistory,
    resolvedUnreadMarkerIndex,
    scheduleReadReceipt,
  ]);

  const conversationTitle = hasActiveConversation
    ? activeConversation?.name ?? "Conversa"
    : "Sem conversa ativa";

  const composerDisabled = !hasActiveConversation;
  const membersButtonLabel = isGroupConversation ? "Ver membros" : "Ver perfil";
  const membersPanelTitle = isGroupConversation ? "Membros" : "Perfil";
  const memberCountLabel = activeConversation?.memberCount ?? activeMembers.length;

  const groupSubtitleBase =
    headerMemberSummary ?? (memberCountLabel > 0 ? `${memberCountLabel} membros` : "Grupo");
  const conversationSubtitle = hasActiveConversation
    ? isGroupConversation
      ? `${groupSubtitleBase}${
          typeof activeConversation?.onlineCount === "number" ? ` - ${activeConversation.onlineCount} online` : ""
        }`
      : activeConversation?.presenceLabel ?? "Conversa direta"
    : "Seleciona uma conversa na lista";

  const canSend = !composerDisabled && draft.trim().length > 0;
  const composerError = attachmentsError || sendError;
  const pendingLabel = pendingNewCount > 99 ? "99+" : String(pendingNewCount);
  const canCreateConversation =
    createMode === "direct"
      ? Boolean(selectedDirectMember)
      : groupTitle.trim().length >= 2 && selectedGroupMembers.length > 0;
  const dateDividerLabel = useMemo(
    () => formatDayLabel(activeMessages[0]?.createdAt),
    [activeMessages],
  );
  const typingLabel = useMemo(() => {
    if (!activeConversationId) return null;
    const typingIds = typingByConversation[activeConversationId] ?? [];
    if (typingIds.length === 0) return null;
    const members = membersByConversation[activeConversationId] ?? [];
    const names = typingIds
      .filter((id) => id !== viewerId)
      .map((id) => members.find((member) => member.userId === id))
      .filter((member): member is MemberReadState => Boolean(member))
      .map((member) => resolveMemberLabel(member));
    return names[0] ?? "Alguem";
  }, [activeConversationId, membersByConversation, typingByConversation, viewerId]);

  useEffect(() => {
    if (!activeConversationId) return;
    messageCountRef.current = activeMessages.length;
    setPendingNewCount(0);
  }, [activeConversationId, activeMessages.length]);

  useEffect(() => {
    if (!activeConversationId || !activeConversation) return;
    const unread = activeConversation.unread ?? 0;
    if (unread <= 0) {
      setUnreadMarkerByConversation((prev) => ({
        ...prev,
        [activeConversationId]: null,
      }));
      return;
    }
    if (activeMessages.length === 0) return;
    setUnreadMarkerByConversation((prev) => {
      if (prev[activeConversationId] != null) return prev;
      return {
        ...prev,
        [activeConversationId]: Math.max(activeMessages.length - unread, 0),
      };
    });
  }, [activeConversation, activeConversationId, activeMessages.length]);

  useEffect(() => {
    if (!activeConversationId || shouldShowSkeletons) return;
    requestAnimationFrame(() => {
      const list = messageListRef.current;
      if (!list) return;
      if (resolvedUnreadMarkerIndex !== null && unreadMarkerRef.current) {
        list.scrollTop = Math.max(unreadMarkerRef.current.offsetTop - 120, 0);
      } else if (scrollPositionsRef.current[activeConversationId] !== undefined) {
        list.scrollTop = scrollPositionsRef.current[activeConversationId] ?? 0;
      } else {
        scrollToBottom("auto");
      }
      updateIsAtBottom();
      if (activeConversationId && isAtBottomRef.current) {
        scheduleReadReceipt(activeConversationId);
      }
    });
  }, [
    activeConversationId,
    shouldShowSkeletons,
    resolvedUnreadMarkerIndex,
    scrollToBottom,
    updateIsAtBottom,
    scheduleReadReceipt,
  ]);

  useEffect(() => {
    if (!hasActiveConversation) return;
    const currentCount = activeMessages.length;
    const previousCount = messageCountRef.current;
    if (isPrependingHistoryRef.current) {
      const delta = currentCount - previousCount;
      if (delta > 0 && activeConversationId) {
        setUnreadMarkerByConversation((prev) => {
          const marker = prev[activeConversationId];
          if (marker == null) return prev;
          return { ...prev, [activeConversationId]: marker + delta };
        });
      }
      messageCountRef.current = currentCount;
      return;
    }
    if (currentCount > previousCount) {
      const newMessages = activeMessages.slice(previousCount);
      const incomingCount = newMessages.filter((message) => !message.isSelf).length;
      if (isAtBottom) {
        scrollToBottom("smooth");
        setPendingNewCount(0);
        if (activeConversationId) {
          setUnreadMarkerByConversation((prev) => ({
            ...prev,
            [activeConversationId]: null,
          }));
        }
        if (activeConversationId) {
          scheduleReadReceipt(activeConversationId);
        }
      } else if (incomingCount > 0 && activeConversationId) {
        setPendingNewCount((prev) => prev + incomingCount);
        setUnreadMarkerByConversation((prev) => {
          if (prev[activeConversationId] != null) return prev;
          return {
            ...prev,
            [activeConversationId]: previousCount,
          };
        });
      }
    }
    messageCountRef.current = currentCount;
  }, [activeMessages, hasActiveConversation, isAtBottom, scrollToBottom, activeConversationId, scheduleReadReceipt]);

  useEffect(() => {
    if (!isPrependingHistoryRef.current) return;
    const entry = prependScrollRef.current;
    if (!entry || entry.conversationId !== activeConversationId) return;
    const list = messageListRef.current;
    if (!list) return;
    const newHeight = list.scrollHeight;
    list.scrollTop = newHeight - entry.height + entry.top;
    isPrependingHistoryRef.current = false;
    prependScrollRef.current = null;
  }, [activeMessages.length, activeConversationId]);

  useEffect(() => {
    if (!activeConversationId || !isAtBottom) return;
    setUnreadMarkerByConversation((prev) => {
      if (prev[activeConversationId] == null) return prev;
      return {
        ...prev,
        [activeConversationId]: null,
      };
    });
    scheduleReadReceipt(activeConversationId);
  }, [activeConversationId, isAtBottom, scheduleReadReceipt]);

  useEffect(() => {
    if (createMode === "direct") {
      setSelectedGroupMembers([]);
      setGroupTitle("");
    } else {
      setSelectedDirectMember(null);
    }
    setCreateError(null);
  }, [createMode]);

  const handleInsertEmoji = (emoji: string) => {
    setDraft((prev) => `${prev}${emoji}`);
    setIsEmojiOpen(false);
    setMentionOpen(false);
    setMentionQuery(null);
    requestAnimationFrame(resizeComposer);
    composerRef.current?.focus();
  };

  const applyMention = (mention: string) => {
    setDraft((prev) => {
      const match = prev.match(/(^|\s)@[^@\s]*$/);
      if (!match || match.index === undefined) return prev;
      const prefix = prev.slice(0, match.index);
      const spacer = match[1] ?? "";
      const normalized = mention.startsWith("@") ? mention.slice(1) : mention;
      return `${prefix}${spacer}@${normalized} `;
    });
    setMentionOpen(false);
    setMentionQuery(null);
    requestAnimationFrame(resizeComposer);
    composerRef.current?.focus();
  };

  const handleReplyToMessage = (message: MessagePreview) => {
    setReplyToMessage({
      id: message.id,
      author: message.author,
      text: message.text || "Mensagem",
    });
    setMessageAction(null);
    composerRef.current?.focus();
  };

  const handleStartEdit = (message: MessagePreview) => {
    if (message.status === "sending" || message.status === "failed") return;
    setEditingMessageId(message.id);
    setEditingDraft(message.text);
    setMessageAction(null);
  };

  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditingDraft("");
  };

  const handleSaveEdit = () => {
    if (!activeConversationId || !editingMessageId) return;
    const trimmed = editingDraft.trim();
    if (!trimmed) return;
    void editMessage(editingMessageId, trimmed);
    setEditingMessageId(null);
    setEditingDraft("");
  };

  const handleToggleReaction = (messageId: string, label: string) => {
    if (!activeConversationId) return;
    void toggleReaction(activeConversationId, messageId, label);
  };

  const handleToggleMessageAction = (
    event: ReactMouseEvent<HTMLButtonElement>,
    messageId: string,
    type: MessageAction["type"],
  ) => {
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    const shouldPlaceBelow = rect.top < 180;
    setMessageAction((prev) => {
      if (prev && prev.messageId === messageId && prev.type === type) {
        return null;
      }
      return {
        messageId,
        type,
        placement: shouldPlaceBelow ? "bottom" : "top",
      };
    });
  };

  const handleOpenMessageMenu = (event: ReactMouseEvent<HTMLDivElement>, messageId: string) => {
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const shouldPlaceBelow = rect.top < 180;
    setMessageAction({
      messageId,
      type: "menu",
      placement: shouldPlaceBelow ? "bottom" : "top",
    });
  };

  const handleCopyMessage = async (message: MessagePreview) => {
    const content = message.text || "Mensagem";
    try {
      await navigator.clipboard.writeText(content);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = content;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    setMessageAction(null);
  };

  const handleDeleteMessage = (message: MessagePreview) => {
    if (!activeConversationId) return;
    if (message.status === "sending" || message.status === "failed") {
      removePendingMessage(activeConversationId, message.id);
      setMessageAction(null);
      return;
    }
    void deleteMessage(message.id);
    setMessageAction(null);
  };

  const handlePinMessage = (message: MessagePreview) => {
    if (!activeConversationId) return;
    if (message.status === "sending" || message.status === "failed") return;
    const isPinned = pinnedMessage?.id === message.id;
    void togglePin(activeConversationId, message.id, isPinned);
    setMessageAction(null);
  };

  const handleJumpToPinned = () => {
    if (!pinnedMessage || !messageListRef.current) return;
    const element = document.getElementById(`chat-message-${pinnedMessage.id}`);
    if (!element) return;
    messageListRef.current.scrollTop = Math.max(element.offsetTop - 120, 0);
  };

  const handleSendMessage = () => {
    if (!activeConversationId || composerDisabled) return;
    const trimmed = draft.trim();
    if (!trimmed) return;
    clearComposerErrors();
    void sendMessage({
      conversationId: activeConversationId,
      body: trimmed,
      attachments: [],
      replyTo: replyToMessage ?? undefined,
    });
    if (typingActiveRef.current) {
      sendTyping(activeConversationId, false);
      typingActiveRef.current = false;
    }
    if (typingTimeoutRef.current) {
      window.clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    setDraft("");
    setReplyToMessage(null);
    setMentionOpen(false);
    setMentionQuery(null);
    setIsEmojiOpen(false);
    resizeComposer();

    setIsAtBottom(true);
    requestAnimationFrame(() => scrollToBottom("smooth"));
  };

  const handleComposerChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const nextValue = event.target.value;
    if (composerError) {
      clearComposerErrors();
    }
    setDraft(nextValue);
    resizeComposer();
    if (!composerDisabled && activeConversationId) {
      if (!typingActiveRef.current) {
        sendTyping(activeConversationId, true);
        typingActiveRef.current = true;
      }
      if (typingTimeoutRef.current) {
        window.clearTimeout(typingTimeoutRef.current);
      }
      typingTimeoutRef.current = window.setTimeout(() => {
        sendTyping(activeConversationId, false);
        typingActiveRef.current = false;
      }, 1400);
    }
    const match = nextValue.match(/(^|\s)@([^@\s]*)$/);
    if (match) {
      setMentionQuery(match[2] ?? "");
      setMentionOpen(true);
    } else {
      setMentionOpen(false);
      setMentionQuery(null);
    }
  };

  const handleComposerKeyDown = (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Escape") {
      setMentionOpen(false);
      setIsEmojiOpen(false);
      if (activeConversationId && typingActiveRef.current) {
        sendTyping(activeConversationId, false);
        typingActiveRef.current = false;
      }
      if (typingTimeoutRef.current) {
        window.clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
      return;
    }
    if (mentionOpen && mentionSuggestions.length > 0 && event.key === "Tab") {
      event.preventDefault();
      applyMention(mentionSuggestions[0]);
      return;
    }
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    handleSendMessage();
  };

  const handleJumpToLatest = () => {
    scrollToBottom("smooth");
    setPendingNewCount(0);
    if (activeConversationId) {
      setUnreadMarkerByConversation((prev) => ({
        ...prev,
        [activeConversationId]: null,
      }));
      scheduleReadReceipt(activeConversationId);
    }
  };

  const handleUpdateNotifications = async (
    level: "ALL" | "MENTIONS_ONLY" | "OFF",
    mutedUntil: string | null,
  ) => {
    if (!activeConversationId) return;
    setHeaderActionError(null);
    setHeaderActionLoading(true);
    try {
      await updateConversationNotifications({ conversationId: activeConversationId, level, mutedUntil });
      setIsHeaderMenuOpen(false);
    } catch {
      setHeaderActionError("Nao foi possivel atualizar notificacoes.");
    } finally {
      setHeaderActionLoading(false);
    }
  };

  const handleToggleBlock = async () => {
    if (!directMember) return;
    setHeaderActionError(null);
    setHeaderActionLoading(true);
    try {
      await toggleBlockUser({ userId: directMember.userId, shouldBlock: !isBlocked });
      setBlockedUserIds((prev) =>
        isBlocked ? prev.filter((id) => id !== directMember.userId) : [...prev, directMember.userId],
      );
      setIsHeaderMenuOpen(false);
    } catch {
      setHeaderActionError(isBlocked ? "Nao foi possivel desbloquear." : "Nao foi possivel bloquear.");
    } finally {
      setHeaderActionLoading(false);
    }
  };

  const handleOpenRename = () => {
    if (!activeConversationId || !activeConversation) return;
    setRenameTitle(activeConversation.name ?? "");
    setRenameError(null);
    setIsRenameOpen(true);
    setIsHeaderMenuOpen(false);
  };

  const handleCloseRename = () => {
    setIsRenameOpen(false);
    setRenameError(null);
    setRenameTitle("");
  };

  const handleConfirmRename = async () => {
    if (!activeConversationId) return;
    const trimmed = renameTitle.trim();
    if (trimmed.length < 2) {
      setRenameError("Define um nome valido.");
      return;
    }
    setIsRenaming(true);
    setRenameError(null);
    try {
      await renameConversation({ conversationId: activeConversationId, title: trimmed });
      handleCloseRename();
    } catch {
      setRenameError("Nao foi possivel atualizar o nome.");
    } finally {
      setIsRenaming(false);
    }
  };

  const handleOpenLeave = () => {
    if (!activeConversationId) return;
    setLeaveError(null);
    setIsLeaveOpen(true);
    setIsHeaderMenuOpen(false);
  };

  const handleCloseLeave = () => {
    setIsLeaveOpen(false);
    setLeaveError(null);
  };

  const handleConfirmLeave = async () => {
    if (!activeConversationId) return;
    setIsLeaving(true);
    setLeaveError(null);
    try {
      await leaveConversation(activeConversationId);
      setIsMembersOpen(false);
      setMessageAction(null);
      setReplyToMessage(null);
      setEditingMessageId(null);
      setEditingDraft("");
      handleCloseLeave();
    } catch {
      setLeaveError("Nao foi possivel sair do grupo.");
    } finally {
      setIsLeaving(false);
    }
  };

  useEffect(() => {
    if (!isRenameOpen && !isLeaveOpen) return;
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (isRenameOpen) {
        handleCloseRename();
        return;
      }
      if (isLeaveOpen) {
        handleCloseLeave();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleCloseLeave, handleCloseRename, isLeaveOpen, isRenameOpen]);

  const handleSelectDirect = (userId: string) => {
    setSelectedDirectMember(userId);
    setCreateError(null);
  };

  const handleToggleGroupMember = (userId: string) => {
    setSelectedGroupMembers((prev) =>
      prev.includes(userId) ? prev.filter((entry) => entry !== userId) : [...prev, userId],
    );
    setCreateError(null);
  };

  const handleCreateConversation = async () => {
    setCreateError(null);
    if (createMode === "direct") {
      if (!selectedDirectMember) {
        setCreateError("Seleciona um membro.");
        return;
      }
      setIsCreating(true);
      try {
        await createConversation({ type: "DIRECT", userId: selectedDirectMember });
        handleCloseCreate();
      } catch {
        setCreateError("Nao foi possivel criar a conversa.");
      } finally {
        setIsCreating(false);
      }
      return;
    }

    const trimmedTitle = groupTitle.trim();
    if (trimmedTitle.length < 2) {
      setCreateError("Define o nome do grupo.");
      return;
    }
    if (selectedGroupMembers.length === 0) {
      setCreateError("Seleciona pelo menos um membro.");
      return;
    }
    setIsCreating(true);
    try {
      await createConversation({
        type: "GROUP",
        title: trimmedTitle,
        memberIds: selectedGroupMembers,
      });
      handleCloseCreate();
    } catch {
      setCreateError("Nao foi possivel criar o grupo.");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="relative h-full min-h-0 w-full text-white">
      <input id={sidebarToggleId} type="checkbox" className="peer hidden" />
      <div className="orya-page-width h-full min-h-0">
        <div className="flex h-full min-h-0 flex-col gap-4 md:flex-row">
          <ChatSidebar
            className="hidden md:flex md:w-[320px] md:shrink-0"
            conversations={conversations}
            activeConversationId={activeConversationId}
            onSelectConversation={handleSelectConversation}
            onCreateConversation={handleOpenCreate}
            loading={loadingConversations}
            errorMessage={conversationsError}
            onRetry={refreshConversations}
          />

          <section className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-3xl border border-white/10 bg-white/5 shadow-[0_24px_60px_rgba(0,0,0,0.45)] backdrop-blur-2xl md:min-w-0">
            <header className="flex h-[60px] items-center justify-between border-b border-white/10 px-4">
              <div className="flex items-center gap-3">
                <label
                  htmlFor={sidebarToggleId}
                  aria-label="Abrir lista de conversas"
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-white/12 bg-white/10 text-base text-white/70 transition hover:bg-white/15 md:hidden focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/40"
                >
                  =
                </label>
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/10 text-[12px] font-semibold text-white/80">
                  {hasActiveConversation ? getInitials(activeConversation?.name ?? "") : "?"}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{conversationTitle}</p>
                  <div className="flex items-center gap-2 text-[11px] text-white/50">
                    <span className="truncate">{conversationSubtitle}</span>
                    {isMuted ? (
                      <span className="rounded-full border border-amber-200/30 bg-amber-200/15 px-2 py-0.5 text-[9px] font-semibold text-amber-100/80">
                        Silenciado
                      </span>
                    ) : null}
                    {connectionLabel ? (
                      <span className="rounded-full border border-white/15 bg-white/10 px-2 py-0.5 text-[9px] font-semibold text-white/70">
                        {connectionLabel}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {hasActiveConversation ? (
                  <>
                    <button
                      type="button"
                      data-members-button
                      aria-label={membersButtonLabel}
                      aria-expanded={isMembersOpen ? "true" : "false"}
                      onClick={() => setIsMembersOpen((prev) => !prev)}
                      className="hidden items-center gap-2 rounded-full border border-white/12 bg-white/8 px-3 py-1 text-[12px] text-white/70 transition hover:bg-white/15 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/40 md:flex"
                    >
                      <svg
                        viewBox="0 0 20 20"
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M6.5 9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
                        <path d="M13.5 10a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
                        <path d="M2.5 16a4 4 0 0 1 8 0" />
                        <path d="M10.5 16a4 4 0 0 1 7 0" />
                      </svg>
                      {membersButtonLabel}
                    </button>
                    <button
                      type="button"
                      data-members-button
                      aria-label={membersButtonLabel}
                      aria-expanded={isMembersOpen ? "true" : "false"}
                      onClick={() => setIsMembersOpen((prev) => !prev)}
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-white/12 bg-white/8 text-base text-white/70 transition hover:bg-white/15 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/40 md:hidden"
                    >
                      i
                    </button>
                    <div className="relative">
                      <button
                        type="button"
                        data-header-menu-button
                        aria-label="Mais acoes"
                        aria-expanded={isHeaderMenuOpen ? "true" : "false"}
                        onClick={() => setIsHeaderMenuOpen((prev) => !prev)}
                        className="flex h-9 w-9 items-center justify-center rounded-full border border-white/12 bg-white/8 text-base text-white/70 transition hover:bg-white/15 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/40"
                      >
                        ...
                      </button>
                      {isHeaderMenuOpen ? (
                        <div
                          ref={headerMenuRef}
                          className="absolute right-0 top-full z-20 mt-2 w-44 overflow-hidden rounded-2xl border border-white/10 bg-[#0d0f19]/95 p-1 text-[12px] text-white/75 shadow-[0_18px_40px_rgba(0,0,0,0.5)]"
                        >
                          {headerActionError ? (
                            <div className="px-3 py-2 text-[11px] text-rose-200">
                              {headerActionError}
                            </div>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => handleUpdateNotifications("ALL", null)}
                            disabled={headerActionLoading || notifLevel === "ALL"}
                            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Notificacoes: todas
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdateNotifications("MENTIONS_ONLY", null)}
                            disabled={headerActionLoading || notifLevel === "MENTIONS_ONLY"}
                            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            So mencoes
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdateNotifications("OFF", null)}
                            disabled={headerActionLoading || notifLevel === "OFF"}
                            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Desligar notificacoes
                          </button>
                          <div className="my-1 h-px bg-white/10" />
                          {isMuted ? (
                            <button
                              type="button"
                              onClick={() => handleUpdateNotifications(notifLevel, null)}
                              disabled={headerActionLoading}
                              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Remover silencio
                            </button>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() =>
                                  handleUpdateNotifications(
                                    notifLevel,
                                    new Date(Date.now() + 60 * 60 * 1000).toISOString(),
                                  )
                                }
                                disabled={headerActionLoading}
                                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                Silenciar 1h
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  handleUpdateNotifications(
                                    notifLevel,
                                    new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
                                  )
                                }
                                disabled={headerActionLoading}
                                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                Silenciar 8h
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  handleUpdateNotifications(
                                    notifLevel,
                                    new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                                  )
                                }
                                disabled={headerActionLoading}
                                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                Silenciar 24h
                              </button>
                            </>
                          )}
                          {isGroupConversation ? <div className="my-1 h-px bg-white/10" /> : null}
                          {isGroupConversation && isGroupAdmin ? (
                            <button
                              type="button"
                              onClick={handleOpenRename}
                              disabled={headerActionLoading}
                              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Editar nome do grupo
                            </button>
                          ) : null}
                          {isGroupConversation ? (
                            <button
                              type="button"
                              onClick={handleOpenLeave}
                              disabled={headerActionLoading}
                              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-rose-200 transition hover:bg-rose-200/10 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Sair do grupo
                            </button>
                          ) : null}
                          {directMember ? <div className="my-1 h-px bg-white/10" /> : null}
                          {directMember ? (
                            <button
                              type="button"
                              onClick={handleToggleBlock}
                              disabled={headerActionLoading}
                              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-rose-200 transition hover:bg-rose-200/10 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {isBlocked ? "Desbloquear contacto" : "Bloquear contacto"}
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </>
                ) : null}
              </div>
            </header>

            {showReconnectBanner && hasActiveConversation && connectionState === "reconnecting" ? (
              <div
                className="flex items-center gap-2 border-b border-white/10 bg-amber-200/10 px-4 py-2 text-[12px] text-amber-100/80"
                role="status"
                aria-live="polite"
              >
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-200/80 motion-reduce:animate-none" />
                A ligar novamente...
              </div>
            ) : null}
            {showPinnedBanner && hasMessageHistory && pinnedMessage ? (
              <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-white/6 px-4 py-2">
                <div className="flex min-w-0 items-center gap-2 text-[12px] text-white/70">
                  <span className="rounded-full border border-white/10 bg-white/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-white/50">
                    Fixada
                  </span>
                  <span className="truncate">{pinnedMessage.text}</span>
                  <span className="hidden text-white/40 md:inline">- {pinnedMessage.author}</span>
                </div>
                <button
                  type="button"
                  aria-label="Ver mensagem fixada"
                  onClick={handleJumpToPinned}
                  className="rounded-full border border-white/12 bg-white/8 px-3 py-1 text-[11px] text-white/70 transition hover:bg-white/15 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/40"
                >
                  Ver
                </button>
              </div>
            ) : null}

            <div className="relative flex min-h-0 flex-1">
              <div
                ref={messageListRef}
                onScroll={handleMessageScroll}
                className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-4 py-4"
              >
                {activeMessagesError ? (
                  <div className="mb-3 rounded-2xl border border-rose-200/30 bg-rose-200/10 px-4 py-2 text-[11px] text-rose-100">
                    <p>{activeMessagesError}</p>
                    {activeConversationId ? (
                      <button
                        type="button"
                        onClick={() => refreshMessages(activeConversationId)}
                        className="mt-2 rounded-full border border-rose-200/40 px-3 py-1 text-[10px] font-semibold text-rose-100 transition hover:bg-rose-200/10"
                      >
                        Tentar novamente
                      </button>
                    ) : null}
                  </div>
                ) : null}
                {shouldShowSkeletons ? (
                  <div className="flex flex-col gap-3">
                    {skeletonRows.map((row) => (
                      <div
                        key={row.id}
                        className={cn("flex", row.align === "right" ? "justify-end" : "justify-start")}
                        aria-hidden="true"
                      >
                        <div
                          className={cn(
                            "flex items-end gap-2",
                            row.align === "right" ? "flex-row-reverse" : "flex-row",
                          )}
                        >
                          {row.align === "left" ? (
                            <div className="h-7 w-7 rounded-full border border-white/8 bg-white/6 animate-pulse" />
                          ) : null}
                          <div
                            className={cn(
                              "h-10 rounded-2xl border border-white/8 bg-white/6 animate-pulse",
                              row.widthClass,
                            )}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : !hasActiveConversation ? (
                  <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
                    <p className="text-sm font-semibold text-white/80">Seleciona uma conversa</p>
                    <p className="text-[12px] text-white/50">
                      Escolhe um chat na lista para ver mensagens.
                    </p>
                  </div>
                ) : resolvedConversationState === "no-messages" ? (
                  <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
                    <p className="text-sm font-semibold text-white/80">Ainda sem mensagens</p>
                    <p className="text-[12px] text-white/50">
                      Diz ola e inicia a conversa com a equipa.
                    </p>
                  </div>
                ) : (
                  <>
                    {loadingHistoryId === activeConversationId ? (
                      <div className="mb-3 flex items-center justify-center gap-2 text-[11px] text-white/45">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white/40 motion-reduce:animate-none" />
                        A carregar mensagens anteriores...
                      </div>
                    ) : hasMessageHistory && !hasMoreHistory ? (
                      <div className="mb-3 flex items-center justify-center text-[11px] text-white/40">
                        Inicio da conversa
                      </div>
                    ) : null}
                    {showDateDivider ? (
                      <div className="mb-3 flex items-center gap-3">
                        <span className="h-px flex-1 bg-white/10" />
                        <span className="rounded-full border border-white/10 bg-white/8 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-white/50">
                          {dateDividerLabel}
                        </span>
                        <span className="h-px flex-1 bg-white/10" />
                      </div>
                    ) : null}
                    {shouldShowNewMessagesDivider && resolvedUnreadMarkerIndex === 0 ? (
                      <div ref={unreadMarkerRef} className="my-3 flex items-center gap-3">
                        <span className="h-px flex-1 bg-white/10" />
                        <span className="rounded-full border border-white/10 bg-white/8 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-white/50">
                          Novas mensagens
                        </span>
                        <span className="h-px flex-1 bg-white/10" />
                      </div>
                    ) : null}
                    {activeMessages.map((message, messageIndex) => {
                      const isSystem = message.kind === "SYSTEM";
                      if (isSystem) {
                        return (
                          <Fragment key={message.id}>
                            <div className="my-3 flex justify-center">
                              <span className="rounded-full border border-white/10 bg-white/8 px-3 py-1 text-[11px] text-white/55">
                                {message.text || "Atualizacao do sistema"}
                              </span>
                            </div>
                            {shouldShowNewMessagesDivider &&
                            resolvedUnreadMarkerIndex !== null &&
                            resolvedUnreadMarkerIndex > 0 &&
                            messageIndex === resolvedUnreadMarkerIndex - 1 ? (
                              <div ref={unreadMarkerRef} className="my-3 flex items-center gap-3">
                                <span className="h-px flex-1 bg-white/10" />
                                <span className="rounded-full border border-white/10 bg-white/8 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-white/50">
                                  Novas mensagens
                                </span>
                                <span className="h-px flex-1 bg-white/10" />
                              </div>
                            ) : null}
                          </Fragment>
                        );
                      }

                      const prev = activeMessages[messageIndex - 1];
                      const isGroupStart = !prev
                        ? true
                        : message.authorId && prev.authorId
                          ? message.authorId !== prev.authorId
                          : prev.author !== message.author;
                      const showAvatar = !message.isSelf && isGroupStart;
                      const rowSpacing = isGroupStart && messageIndex > 0 ? "pt-3" : "";
                      const hasReactions = (message.reactions ?? []).length > 0;
                      const isEditing = editingMessageId === message.id;
                      const isPinned = pinnedMessage?.id === message.id;
                      const isPendingMessage = message.status === "sending" || message.status === "failed";
                      return (
                        <Fragment key={message.id}>
                          <div
                            id={`chat-message-${message.id}`}
                            className={cn(
                              "flex w-full gap-2 animate-fade-slide motion-reduce:animate-none",
                              message.isSelf ? "justify-end" : "justify-start",
                              rowSpacing,
                              hasReactions && "pb-4",
                            )}
                            style={{ animationDelay: `${messageIndex * 40}ms` }}
                          >
                            {!message.isSelf ? (
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center">
                                {showAvatar ? (
                                  <div className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-white/10 text-[10px] font-semibold text-white/70">
                                    {getInitials(message.author)}
                                  </div>
                                ) : (
                                  <div className="h-8 w-8" />
                                )}
                              </div>
                            ) : null}
                            <div
                              className={cn(
                                "flex max-w-[70%] flex-col",
                                message.isSelf ? "items-end" : "items-start",
                              )}
                            >
                              {showAvatar ? (
                                <p className="mb-1 text-[11px] text-white/50">{message.author}</p>
                              ) : null}
                              <div
                                className="relative group"
                                onContextMenu={(event) => handleOpenMessageMenu(event, message.id)}
                              >
                                <div
                                  className={cn(
                                    "min-w-[56px] rounded-2xl border px-3 py-2 text-sm",
                                    message.isSelf
                                      ? "border-emerald-200/20 bg-emerald-400/15 text-white/90"
                                      : "border-white/10 bg-white/10 text-white/85",
                                  )}
                                >
                                  {message.replyTo ? (
                                    <div className="mb-2 rounded-xl border border-white/10 bg-white/5 px-2 py-1">
                                      <p className="text-[10px] font-semibold text-white/70">
                                        {message.replyTo.author}
                                      </p>
                                      <p className="truncate text-[11px] text-white/60">
                                        {message.replyTo.text}
                                      </p>
                                    </div>
                                  ) : null}
                                  {isPinned ? (
                                    <span className="mb-2 inline-flex items-center gap-1 rounded-full border border-amber-200/30 bg-amber-200/15 px-2 py-0.5 text-[10px] font-semibold text-amber-100/80">
                                      Fixada
                                    </span>
                                  ) : null}
                                  {isEditing ? (
                                    <div className="space-y-2">
                                      <textarea
                                        rows={2}
                                        value={editingDraft}
                                        onChange={(event) => setEditingDraft(event.target.value)}
                                        onKeyDown={(event) => {
                                          if (event.key === "Escape") {
                                            event.preventDefault();
                                            handleCancelEdit();
                                          }
                                          if (event.key === "Enter" && !event.shiftKey) {
                                            event.preventDefault();
                                            handleSaveEdit();
                                          }
                                        }}
                                        className="min-h-[60px] w-full resize-none rounded-xl border border-white/10 bg-white/5 px-2 py-2 text-sm text-white/85 focus:outline-none focus:ring-1 focus:ring-white/30"
                                      />
                                      <div className="flex items-center justify-end gap-2 text-[11px] text-white/60">
                                        <button
                                          type="button"
                                          onClick={handleCancelEdit}
                                          className="rounded-full border border-white/10 px-3 py-1 transition hover:bg-white/10"
                                        >
                                          Cancelar
                                        </button>
                                        <button
                                          type="button"
                                          onClick={handleSaveEdit}
                                          className="rounded-full border border-emerald-200/30 bg-emerald-400/20 px-3 py-1 text-white/85 transition hover:bg-emerald-400/30"
                                        >
                                          Guardar
                                        </button>
                                      </div>
                                    </div>
                                  ) : message.text ? (
                                    <p className="whitespace-pre-wrap break-words">
                                      {renderMessageText(message.text, mentionTokens)}
                                    </p>
                                  ) : null}
                                  {message.attachments && message.attachments.length > 0 ? (
                                    <div className="mt-2 space-y-2">
                                      {message.attachments.map((attachment) => {
                                        if (attachment.kind === "file") {
                                          return (
                                            <div
                                              key={attachment.id}
                                              className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/8 px-3 py-2"
                                            >
                                              <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/10 text-white/70">
                                                <svg
                                                  viewBox="0 0 20 20"
                                                  className="h-4 w-4"
                                                  fill="none"
                                                  stroke="currentColor"
                                                  strokeWidth="1.4"
                                                  strokeLinecap="round"
                                                  strokeLinejoin="round"
                                                  aria-hidden="true"
                                                >
                                                  <path d="M6 3h6l4 4v10a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
                                                  <path d="M12 3v4h4" />
                                                </svg>
                                              </div>
                                              <div className="min-w-0">
                                                {attachment.url ? (
                                                  <a
                                                    href={attachment.url}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="truncate text-[12px] font-semibold text-white/85 underline-offset-4 hover:underline"
                                                  >
                                                    {attachment.title}
                                                  </a>
                                                ) : (
                                                  <p className="truncate text-[12px] font-semibold text-white/85">
                                                    {attachment.title}
                                                  </p>
                                                )}
                                                {attachment.meta ? (
                                                  <p className="text-[10px] text-white/50">
                                                    {attachment.meta}
                                                  </p>
                                                ) : null}
                                              </div>
                                            </div>
                                          );
                                        }

                                        if (attachment.kind === "image") {
                                          return (
                                            <div key={attachment.id} className="space-y-2">
                                              {attachment.url ? (
                                                <Image
                                                  src={attachment.url}
                                                  alt={attachment.title}
                                                  width={512}
                                                  height={128}
                                                  sizes="(max-width: 640px) 100vw, 50vw"
                                                  className="h-32 w-full rounded-xl border border-white/10 object-cover"
                                                />
                                              ) : (
                                                <div className="h-32 w-full rounded-xl border border-white/10 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.18),transparent_60%),linear-gradient(160deg,rgba(16,24,40,0.8),rgba(7,10,18,0.95))]" />
                                              )}
                                              <div className="flex items-center justify-between text-[10px] text-white/55">
                                                <span className="truncate">{attachment.title}</span>
                                                {attachment.meta ? <span>{attachment.meta}</span> : null}
                                              </div>
                                            </div>
                                          );
                                        }

                                        if (attachment.kind === "link") {
                                          return (
                                            <div
                                              key={attachment.id}
                                              className="rounded-xl border border-white/10 bg-white/8 px-3 py-2"
                                            >
                                              <p className="text-[12px] font-semibold text-white/85">
                                                {attachment.title}
                                              </p>
                                              {attachment.meta ? (
                                                <p className="text-[10px] text-white/50">
                                                  {attachment.meta}
                                                </p>
                                              ) : null}
                                              {attachment.urlLabel ? (
                                                <p className="mt-1 text-[10px] text-white/60">
                                                  {attachment.urlLabel}
                                                </p>
                                              ) : null}
                                            </div>
                                          );
                                        }

                                        return (
                                          <div key={attachment.id} className="space-y-2">
                                            <div className="h-32 w-full rounded-xl border border-white/10 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.18),transparent_60%),linear-gradient(160deg,rgba(16,24,40,0.8),rgba(7,10,18,0.95))]" />
                                            <div className="flex items-center justify-between text-[10px] text-white/55">
                                              <span className="truncate">{attachment.title}</span>
                                              {attachment.meta ? <span>{attachment.meta}</span> : null}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  ) : null}
                                  {message.status === "sending" &&
                                  message.attachments &&
                                  message.attachments.length > 0 ? (
                                    <div className="mt-2 h-1 w-full rounded-full bg-white/10">
                                      <div className="h-1 w-2/3 animate-pulse rounded-full bg-emerald-200/40 motion-reduce:animate-none" />
                                    </div>
                                  ) : null}
                                  <div
                                    className={cn(
                                      "mt-1 flex items-center gap-1 text-[10px] text-white/50",
                                      message.isSelf ? "justify-end" : "justify-start",
                                    )}
                                  >
                                    <span>{message.time}</span>
                                    {message.edited ? (
                                      <span className="text-[9px] text-white/40">Editado</span>
                                    ) : null}
                                    {message.status === "sending" ? (
                                      <span className="text-[9px] text-white/40">A enviar...</span>
                                    ) : null}
                                    {message.isSelf ? <MessageStatus status={message.status} /> : null}
                                  </div>
                                  {message.status === "failed" ? (
                                    <div
                                      className={cn(
                                        "mt-1 flex items-center gap-2 text-[10px]",
                                        message.isSelf ? "justify-end" : "justify-start",
                                      )}
                                    >
                                      <span className="text-rose-200">Falha ao enviar</span>
                                    </div>
                                  ) : null}
                                </div>

                                {!isEditing && !isPendingMessage ? (
                                  <div className="absolute -top-3 right-2 flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
                                    <button
                                      type="button"
                                      aria-label="Reagir"
                                      data-message-action-button
                                      aria-expanded={
                                        messageAction?.messageId === message.id &&
                                        messageAction.type === "reactions"
                                      }
                                      onClick={(event) =>
                                        handleToggleMessageAction(event, message.id, "reactions")
                                      }
                                      className="flex h-6 w-6 items-center justify-center rounded-full border border-white/10 bg-white/10 text-[11px] text-white/70 transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/40"
                                    >
                                      +
                                    </button>
                                    <button
                                      type="button"
                                      aria-label="Mais acoes"
                                      data-message-action-button
                                      aria-expanded={
                                        messageAction?.messageId === message.id &&
                                        messageAction.type === "menu"
                                      }
                                      onClick={(event) =>
                                        handleToggleMessageAction(event, message.id, "menu")
                                      }
                                      className="flex h-6 w-6 items-center justify-center rounded-full border border-white/10 bg-white/10 text-[11px] text-white/70 transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/40"
                                    >
                                      ...
                                    </button>
                                  </div>
                                ) : null}

                                {messageAction?.messageId === message.id &&
                                messageAction.type === "reactions" ? (
                                  <div
                                    ref={messageActionRef}
                                    role="menu"
                                    className={cn(
                                      "absolute z-20 flex items-center gap-1 rounded-full border border-white/10 bg-[#0d0f19]/95 p-1 shadow-[0_16px_30px_rgba(0,0,0,0.45)]",
                                      messageAction.placement === "top" ? "bottom-full mb-2" : "top-full mt-2",
                                      message.isSelf ? "right-0" : "left-0",
                                    )}
                                  >
                                    {reactionOptions.map((reaction) => (
                                      <button
                                        key={`${message.id}-${reaction}`}
                                        type="button"
                                        onClick={() => {
                                          handleToggleReaction(message.id, reaction);
                                          setMessageAction(null);
                                        }}
                                        className="flex h-7 w-7 items-center justify-center rounded-full text-[13px] transition hover:bg-white/10"
                                      >
                                        {reaction}
                                      </button>
                                    ))}
                                  </div>
                                ) : null}

                                {messageAction?.messageId === message.id && messageAction.type === "menu" ? (
                                  <div
                                    ref={messageActionRef}
                                    role="menu"
                                    className={cn(
                                      "absolute z-20 w-40 overflow-hidden rounded-2xl border border-white/10 bg-[#0d0f19]/95 p-1 text-[12px] text-white/75 shadow-[0_18px_40px_rgba(0,0,0,0.5)]",
                                      messageAction.placement === "top" ? "bottom-full mb-2" : "top-full mt-2",
                                      message.isSelf ? "right-0" : "left-0",
                                    )}
                                  >
                                    <button
                                      type="button"
                                      onClick={() => handleReplyToMessage(message)}
                                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 transition hover:bg-white/10"
                                    >
                                      Responder
                                    </button>
                                    {message.isSelf ? (
                                      message.status !== "sending" && message.status !== "failed" ? (
                                        <button
                                          type="button"
                                          onClick={() => handleStartEdit(message)}
                                          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 transition hover:bg-white/10"
                                        >
                                          Editar
                                        </button>
                                      ) : null
                                    ) : null}
                                    <button
                                      type="button"
                                      onClick={() => handleCopyMessage(message)}
                                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 transition hover:bg-white/10"
                                    >
                                      Copiar texto
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handlePinMessage(message)}
                                      disabled={message.status === "sending" || message.status === "failed"}
                                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                      {isPinned ? "Remover fixacao" : "Fixar"}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteMessage(message)}
                                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-rose-200 transition hover:bg-rose-200/10"
                                    >
                                      Apagar
                                    </button>
                                  </div>
                                ) : null}

                                {hasReactions ? (
                                  <div
                                    className={cn(
                                      "absolute -bottom-3 flex items-center gap-1",
                                      message.isSelf ? "right-2" : "left-2",
                                    )}
                                  >
                                    {message.reactions?.map((reaction) => (
                                      <button
                                        type="button"
                                        key={`${message.id}-${reaction.label}`}
                                        onClick={() => handleToggleReaction(message.id, reaction.label)}
                                        className={cn(
                                          "flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold transition hover:bg-white/10",
                                          reaction.active
                                            ? "border-emerald-200/30 bg-emerald-400/20 text-emerald-100"
                                            : "border-white/10 bg-white/10 text-white/70",
                                        )}
                                      >
                                        <span>{reaction.label}</span>
                                        <span>{reaction.count}</span>
                                      </button>
                                    ))}
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          </div>
                          {shouldShowNewMessagesDivider &&
                          resolvedUnreadMarkerIndex !== null &&
                          resolvedUnreadMarkerIndex > 0 &&
                          messageIndex === resolvedUnreadMarkerIndex - 1 ? (
                            <div ref={unreadMarkerRef} className="my-3 flex items-center gap-3">
                              <span className="h-px flex-1 bg-white/10" />
                              <span className="rounded-full border border-white/10 bg-white/8 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-white/50">
                                Novas mensagens
                              </span>
                              <span className="h-px flex-1 bg-white/10" />
                            </div>
                          ) : null}
                        </Fragment>
                      );
                    })}
                  </>
                )}

                {showTypingIndicator && !shouldShowSkeletons && hasMessageHistory && typingLabel ? (
                  <div className="mt-2 flex items-center gap-2 text-[11px] text-white/50" role="status" aria-live="polite">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-200/70 motion-reduce:animate-none" />
                    {typingLabel} a escrever...
                  </div>
                ) : null}
              </div>

              {showNewMessagesPill &&
              !shouldShowSkeletons &&
              hasMessageHistory &&
              pendingNewCount > 0 ? (
                <button
                  type="button"
                  onClick={handleJumpToLatest}
                  className="absolute bottom-4 right-4 flex items-center gap-2 rounded-full border border-white/10 bg-white/15 px-3 py-1.5 text-[11px] font-semibold text-white/80 shadow-[0_14px_30px_rgba(0,0,0,0.45)] transition hover:bg-white/25 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/40"
                >
                  Novas mensagens ({pendingLabel})
                  <span className="text-[12px]">↓</span>
                </button>
              ) : null}
            </div>

            <div className="border-t border-white/10 px-4 py-3">
              <div
                className="relative flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/8 px-3 py-2 focus-within:ring-1 focus-within:ring-white/30"
              >
                {composerError ? (
                  <div className="rounded-xl border border-rose-200/30 bg-rose-200/10 px-3 py-2 text-[11px] text-rose-100">
                    {composerError}
                  </div>
                ) : null}
                {replyToMessage && hasActiveConversation ? (
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/6 px-3 py-2 text-[11px] text-white/70">
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-[0.2em] text-white/40">
                        A responder a {replyToMessage.author}
                      </p>
                      <p className="truncate text-[12px] text-white/80">{replyToMessage.text}</p>
                    </div>
                    <button
                      type="button"
                      aria-label="Cancelar resposta"
                      onClick={() => setReplyToMessage(null)}
                      className="flex h-6 w-6 items-center justify-center rounded-full border border-white/10 text-[11px] text-white/60 transition hover:bg-white/10"
                    >
                      x
                    </button>
                  </div>
                ) : null}
                <div className="flex items-end gap-2">
                  <button
                    type="button"
                    aria-label="Inserir emoji"
                    onClick={() => {
                      setIsEmojiOpen((prev) => !prev);
                      setMentionOpen(false);
                      setMentionQuery(null);
                    }}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/10 text-[14px] text-white/70 transition hover:bg-white/15 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/40 disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={composerDisabled}
                  >
                    🙂
                  </button>
                  <div className="relative flex-1">
                    <textarea
                      ref={composerRef}
                      rows={1}
                      placeholder="Escreve uma mensagem"
                      aria-label="Escreve uma mensagem"
                      value={draft}
                      onChange={handleComposerChange}
                      onKeyDown={handleComposerKeyDown}
                      onBlur={() => {
                        if (activeConversationId && typingActiveRef.current) {
                          sendTyping(activeConversationId, false);
                          typingActiveRef.current = false;
                        }
                        if (typingTimeoutRef.current) {
                          window.clearTimeout(typingTimeoutRef.current);
                          typingTimeoutRef.current = null;
                        }
                      }}
                      className="min-h-[36px] w-full resize-none bg-transparent text-sm text-white/80 placeholder:text-white/45 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={composerDisabled}
                    />
                    {mentionOpen && mentionSuggestions.length > 0 && hasActiveConversation ? (
                      <div className="absolute bottom-full left-0 mb-2 w-56 rounded-2xl border border-white/10 bg-[#0d0f19]/95 p-2 text-[12px] text-white/80 shadow-[0_16px_40px_rgba(0,0,0,0.45)]">
                        <p className="mb-2 text-[10px] uppercase tracking-[0.2em] text-white/40">
                          Mencionar
                        </p>
                        <div className="flex flex-col gap-1">
                          {mentionSuggestions.map((member) => (
                            <button
                              key={member}
                              type="button"
                              onClick={() => applyMention(member)}
                              className="flex items-center gap-2 rounded-xl px-2 py-1 text-left transition hover:bg-white/10"
                            >
                              <span className="flex h-6 w-6 items-center justify-center rounded-full border border-white/10 bg-white/10 text-[10px] font-semibold text-white/70">
                                {getInitials(member)}
                              </span>
                              <span className="truncate">{member}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    aria-label="Enviar"
                    onClick={handleSendMessage}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-emerald-200/30 bg-emerald-400/20 text-white/90 transition hover:bg-emerald-400/30 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-200/60 disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={!canSend}
                  >
                    &gt;
                  </button>
                </div>
                {isEmojiOpen && hasActiveConversation ? (
                  <div className="flex flex-wrap gap-2 border-t border-white/10 pt-2 text-[18px]">
                    {emojiOptions.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => handleInsertEmoji(emoji)}
                        className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/8 transition hover:bg-white/20"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            {isMembersOpen && hasActiveConversation ? (
              <div className="absolute inset-0 z-30 flex">
                <button
                  type="button"
                  aria-label="Fechar painel"
                  onClick={() => setIsMembersOpen(false)}
                  className="absolute inset-0 bg-black/40"
                />
                <aside
                  ref={membersPanelRef}
                  className="ml-auto flex h-full w-full max-w-[340px] flex-col border-l border-white/10 bg-[#0d0f19]/95 shadow-[0_24px_50px_rgba(0,0,0,0.5)] backdrop-blur-2xl"
                >
                  <div className="flex items-center justify-between border-b border-white/10 px-4 py-4">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.2em] text-white/50">
                        {membersPanelTitle}
                      </p>
                      <p className="text-base font-semibold text-white">{conversationTitle}</p>
                      {isGroupConversation ? (
                        <p className="text-[11px] text-white/50">
                          {memberCountLabel} membros
                          {activeConversation?.onlineCount
                            ? ` - ${activeConversation.onlineCount} online`
                            : ""}
                        </p>
                      ) : (
                        <p className="text-[11px] text-white/50">{conversationSubtitle}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      aria-label="Fechar"
                      onClick={() => setIsMembersOpen(false)}
                      className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/10 text-sm text-white/60 transition hover:bg-white/20"
                    >
                      x
                    </button>
                  </div>

                  {isGroupConversation ? (
                    <>
                      <div className="px-4 pb-3 pt-4">
                        <input
                          type="search"
                          placeholder="Pesquisar membros"
                          aria-label="Pesquisar membros"
                          value={membersSearch}
                          onChange={(event) => setMembersSearch(event.target.value)}
                          className="h-10 w-full rounded-full border border-white/10 bg-white/10 px-4 text-sm text-white/80 placeholder:text-white/45 focus:outline-none focus:ring-1 focus:ring-white/30"
                        />
                      </div>
                      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-4 pb-4">
                        {filteredMembers.length === 0 ? (
                          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-center text-[12px] text-white/55">
                            Sem membros encontrados.
                          </div>
                        ) : (
                          filteredMembers.map((member) => {
                            const label = resolveMemberLabel(member);
                            const isSelf = Boolean(viewerId && member.userId === viewerId);
                            const isOnline = isMemberOnline(member);
                            return (
                              <div
                                key={member.userId}
                                className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/10 text-[11px] font-semibold text-white/70">
                                    {getInitials(label)}
                                  </div>
                                  <div>
                                    <p className="text-sm font-semibold text-white">{label}</p>
                                    <p className="text-[11px] text-white/45">
                                      {isSelf ? "Tu" : isOnline ? "Disponivel" : "Ausente"}
                                    </p>
                                  </div>
                                </div>
                                {isSelf ? (
                                  <span className="rounded-full border border-emerald-200/30 bg-emerald-400/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-100">
                                    Tu
                                  </span>
                                ) : null}
                              </div>
                            );
                          })
                        )}
                      </div>
                      <div className="border-t border-white/10 px-4 py-3">
                        <button
                          type="button"
                          className="w-full rounded-full border border-white/12 bg-white/10 px-4 py-2 text-[12px] font-semibold text-white/80 transition hover:bg-white/20"
                        >
                          Adicionar membro
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-1 flex-col gap-4 px-4 py-5">
                      <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/6 px-4 py-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/10 text-[12px] font-semibold text-white/70">
                          {getInitials(activeConversation?.name ?? "")}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-white">{activeConversation?.name}</p>
                          <p className="text-[11px] text-white/45">{conversationSubtitle}</p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (directProfileHref) {
                              window.open(directProfileHref, "_blank");
                            }
                          }}
                          disabled={!directProfileHref}
                          className="w-full rounded-full border border-white/12 bg-white/10 px-4 py-2 text-[12px] font-semibold text-white/80 transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Ver perfil completo
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleUpdateNotifications(
                              notifLevel === "OFF" ? "OFF" : notifLevel,
                              new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
                            )
                          }
                          disabled={headerActionLoading}
                          className="w-full rounded-full border border-white/12 bg-white/10 px-4 py-2 text-[12px] font-semibold text-white/80 transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Silenciar notificacoes
                        </button>
                        <button
                          type="button"
                          onClick={handleToggleBlock}
                          disabled={!directMember || headerActionLoading}
                          className="w-full rounded-full border border-rose-200/30 bg-rose-200/15 px-4 py-2 text-[12px] font-semibold text-rose-100 transition hover:bg-rose-200/25 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {isBlocked ? "Desbloquear contacto" : "Bloquear contacto"}
                        </button>
                      </div>
                    </div>
                  )}
                </aside>
              </div>
            ) : null}

            {isCreateOpen ? (
              <div className="absolute inset-0 z-40 flex">
                <button
                  type="button"
                  aria-label="Fechar criacao"
                  onClick={handleCloseCreate}
                  className="absolute inset-0 bg-black/40"
                />
                <aside className="ml-auto flex h-full w-full max-w-[420px] flex-col border-l border-white/10 bg-[#0d0f19]/95 shadow-[0_24px_50px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
                  <div className="flex items-center justify-between border-b border-white/10 px-4 py-4">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.2em] text-white/50">
                        Nova conversa
                      </p>
                      <p className="text-base font-semibold text-white">Criar conversa</p>
                    </div>
                    <button
                      type="button"
                      aria-label="Fechar"
                      onClick={handleCloseCreate}
                      className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/10 text-sm text-white/60 transition hover:bg-white/20"
                    >
                      x
                    </button>
                  </div>

                  <div className="px-4 pb-3 pt-4">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        aria-pressed={createMode === "direct" ? "true" : "false"}
                        onClick={() => setCreateMode("direct")}
                        className={cn(
                          "rounded-full border px-3 py-1 text-[11px] font-semibold transition focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/40",
                          createMode === "direct"
                            ? "border-white/20 bg-white/15 text-white/85"
                            : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10",
                        )}
                      >
                        Direto
                      </button>
                      <button
                        type="button"
                        aria-pressed={createMode === "group" ? "true" : "false"}
                        onClick={() => setCreateMode("group")}
                        className={cn(
                          "rounded-full border px-3 py-1 text-[11px] font-semibold transition focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/40",
                          createMode === "group"
                            ? "border-white/20 bg-white/15 text-white/85"
                            : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10",
                        )}
                      >
                        Grupo
                      </button>
                    </div>
                  </div>

                  {createMode === "group" ? (
                    <div className="px-4 pb-3">
                      <label className="text-[11px] uppercase tracking-[0.2em] text-white/40">
                        Nome do grupo
                      </label>
                      <input
                        type="text"
                        value={groupTitle}
                        onChange={(event) => setGroupTitle(event.target.value)}
                        placeholder="Ex: Operacoes"
                        className="mt-2 h-10 w-full rounded-full border border-white/10 bg-white/10 px-4 text-sm text-white/80 placeholder:text-white/45 focus:outline-none focus:ring-1 focus:ring-white/30"
                      />
                    </div>
                  ) : null}

                  <div className="px-4 pb-3">
                    <input
                      type="search"
                      placeholder="Pesquisar pessoas"
                      aria-label="Pesquisar pessoas"
                      value={membersQuery}
                      onChange={(event) => setMembersQuery(event.target.value)}
                      className="h-10 w-full rounded-full border border-white/10 bg-white/10 px-4 text-sm text-white/80 placeholder:text-white/45 focus:outline-none focus:ring-1 focus:ring-white/30"
                    />
                  </div>

                  <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-4 pb-4">
                    {membersLoading ? (
                      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-center text-[12px] text-white/55">
                        A carregar membros...
                      </div>
                    ) : membersError ? (
                      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-center text-[12px] text-white/55">
                        {membersError}
                      </div>
                    ) : filteredDirectory.length === 0 ? (
                      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-center text-[12px] text-white/55">
                        Sem resultados.
                      </div>
                    ) : (
                      filteredDirectory.map((member) => {
                        const label = resolveDirectoryLabel(member);
                        const isSelected =
                          createMode === "direct"
                            ? selectedDirectMember === member.userId
                            : selectedGroupMembers.includes(member.userId);
                        return (
                          <button
                            key={member.userId}
                            type="button"
                            onClick={() =>
                              createMode === "direct"
                                ? handleSelectDirect(member.userId)
                                : handleToggleGroupMember(member.userId)
                            }
                            className={cn(
                              "flex items-center justify-between gap-3 rounded-2xl border px-3 py-2 text-left transition focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/40",
                              isSelected
                                ? "border-emerald-200/40 bg-emerald-400/15 text-white/90"
                                : "border-white/10 bg-white/5 text-white/80 hover:bg-white/10",
                            )}
                          >
                            <div className="flex items-center gap-3">
                              <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/10 text-[11px] font-semibold text-white/70">
                                {getInitials(label)}
                              </span>
                              <div>
                                <p className="text-sm font-semibold">{label}</p>
                                {member.role ? (
                                  <p className="text-[10px] uppercase tracking-[0.2em] text-white/45">
                                    {member.role}
                                  </p>
                                ) : null}
                              </div>
                            </div>
                            <span
                              className={cn(
                                "flex h-6 w-6 items-center justify-center rounded-full border text-[11px]",
                                isSelected
                                  ? "border-emerald-200/40 bg-emerald-400/30 text-emerald-100"
                                  : "border-white/10 bg-white/10 text-white/40",
                              )}
                            >
                              {isSelected ? "✓" : "+"}
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>

                  <div className="border-t border-white/10 px-4 py-3">
                    {createError ? (
                      <p className="mb-2 text-[11px] text-rose-200">{createError}</p>
                    ) : null}
                    <button
                      type="button"
                      onClick={handleCreateConversation}
                      disabled={!canCreateConversation || isCreating}
                      className="w-full rounded-full border border-emerald-200/30 bg-emerald-400/20 px-4 py-2 text-[12px] font-semibold text-white/90 transition hover:bg-emerald-400/30 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {isCreating ? "A criar..." : "Criar conversa"}
                    </button>
                  </div>
                </aside>
              </div>
            ) : null}
            {isRenameOpen ? (
              <div className="absolute inset-0 z-40 flex items-center justify-center">
                <button
                  type="button"
                  aria-label="Fechar edicao"
                  onClick={handleCloseRename}
                  className="absolute inset-0 bg-black/40"
                />
                <div className="relative w-full max-w-[420px] rounded-3xl border border-white/10 bg-[#0d0f19]/95 p-5 shadow-[0_24px_50px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.2em] text-white/50">
                        Editar grupo
                      </p>
                      <p className="text-base font-semibold text-white">Nome do grupo</p>
                    </div>
                    <button
                      type="button"
                      aria-label="Fechar"
                      onClick={handleCloseRename}
                      className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/10 text-sm text-white/60 transition hover:bg-white/20"
                    >
                      x
                    </button>
                  </div>
                  <div className="mt-4">
                    <input
                      type="text"
                      value={renameTitle}
                      onChange={(event) => setRenameTitle(event.target.value)}
                      placeholder="Nome do grupo"
                      className="h-10 w-full rounded-full border border-white/10 bg-white/10 px-4 text-sm text-white/80 placeholder:text-white/45 focus:outline-none focus:ring-1 focus:ring-white/30"
                    />
                    {renameError ? (
                      <p className="mt-2 text-[11px] text-rose-200">{renameError}</p>
                    ) : null}
                  </div>
                  <div className="mt-5 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={handleCloseRename}
                      className="rounded-full border border-white/10 px-4 py-2 text-[12px] text-white/70 transition hover:bg-white/10"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmRename}
                      disabled={isRenaming}
                      className="rounded-full border border-emerald-200/30 bg-emerald-400/20 px-4 py-2 text-[12px] font-semibold text-white/90 transition hover:bg-emerald-400/30 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isRenaming ? "A guardar..." : "Guardar"}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
            {isLeaveOpen ? (
              <div className="absolute inset-0 z-40 flex items-center justify-center">
                <button
                  type="button"
                  aria-label="Fechar confirmacao"
                  onClick={handleCloseLeave}
                  className="absolute inset-0 bg-black/40"
                />
                <div className="relative w-full max-w-[420px] rounded-3xl border border-white/10 bg-[#0d0f19]/95 p-5 shadow-[0_24px_50px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.2em] text-white/50">
                        Sair do grupo
                      </p>
                      <p className="text-base font-semibold text-white">
                        Tens a certeza que queres sair?
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-label="Fechar"
                      onClick={handleCloseLeave}
                      className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/10 text-sm text-white/60 transition hover:bg-white/20"
                    >
                      x
                    </button>
                  </div>
                  <p className="mt-3 text-[12px] text-white/60">
                    Vais deixar de receber mensagens desta conversa.
                  </p>
                  {leaveError ? (
                    <p className="mt-3 text-[11px] text-rose-200">{leaveError}</p>
                  ) : null}
                  <div className="mt-5 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={handleCloseLeave}
                      className="rounded-full border border-white/10 px-4 py-2 text-[12px] text-white/70 transition hover:bg-white/10"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmLeave}
                      disabled={isLeaving}
                      className="rounded-full border border-rose-200/30 bg-rose-200/15 px-4 py-2 text-[12px] font-semibold text-rose-100 transition hover:bg-rose-200/25 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isLeaving ? "A sair..." : "Sair do grupo"}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </section>
        </div>
      </div>
      <div className="fixed inset-0 z-40 bg-black/50 opacity-0 transition pointer-events-none md:hidden peer-checked:opacity-100 peer-checked:pointer-events-auto">
        <label htmlFor={sidebarToggleId} className="block h-full w-full" aria-label="Fechar lista" />
      </div>
      <div className="fixed left-0 top-0 z-50 h-full w-[88vw] max-w-[340px] -translate-x-full transition md:hidden peer-checked:translate-x-0">
        <ChatSidebar
          className="h-full rounded-none rounded-r-3xl"
          showCloseButton
          toggleId={sidebarToggleId}
          conversations={conversations}
          activeConversationId={activeConversationId}
          onSelectConversation={handleSelectConversation}
          onCreateConversation={handleOpenCreate}
          loading={loadingConversations}
          errorMessage={conversationsError}
          onRetry={refreshConversations}
        />
      </div>
    </div>
  );
}
