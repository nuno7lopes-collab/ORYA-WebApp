import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useNavigation } from "@react-navigation/native";
import { LiquidBackground } from "../../../components/liquid/LiquidBackground";
import { TopAppHeader } from "../../../components/navigation/TopAppHeader";
import { useTopHeaderPadding } from "../../../components/navigation/useTopHeaderPadding";
import { useTopBarScroll } from "../../../components/navigation/useTopBarScroll";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "../../../components/icons/Ionicons";
import { tokens, useTranslation } from "@orya/shared";
import { GlassCard } from "../../../components/liquid/GlassCard";
import { GlassSkeleton } from "../../../components/glass/GlassSkeleton";
import { Image } from "expo-image";
import { AvatarCircle } from "../../../components/avatar/AvatarCircle";
import { safeBack, safePush } from "../../../lib/navigation";
import { useAuth } from "../../../lib/auth";
import {
  fetchConversationMessages,
  sendConversationMessage,
  markConversationRead,
  muteConversation,
  undoConversationMessage,
  reactToMessage,
  unreactToMessage,
} from "../../../features/messages/api";
import type { ConversationMessage, ConversationMember, ConversationMessagesResponse } from "../../../features/messages/types";
import { getUserFacingError } from "../../../lib/errors";
import { getMobileEnv } from "../../../lib/env";
import { formatTime } from "../../../lib/formatters";
import { ApiError } from "../../../lib/api";

const WS_PING_INTERVAL_MS = 25000;
const WS_HANDSHAKE_TIMEOUT_MS = 10000;
const UNDO_WINDOW_MS = 2 * 60 * 1000;
const WS_PROTOCOL_BASE = "orya-chat.v1";
const WS_APP_VERSION = process.env.EXPO_PUBLIC_APP_VERSION?.trim() || "1.0.0";

type UnifiedMessage = {
  id: string;
  body: string | null;
  createdAt: string;
  deletedAt?: string | null;
  kind?: "USER" | "ANNOUNCEMENT" | "SYSTEM";
  reactions?: Array<{
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
  }>;
  pins?: unknown[];
  sender: {
    id: string;
    fullName: string | null;
    username: string | null;
    avatarUrl: string | null;
  } | null;
};

const resolveChatError = (err: unknown, fallback: string, t: (key: string) => string) => {
  if (err instanceof ApiError) {
    if (err.status === 426) return "Atualiza a app para continuar.";
    if (err.status === 429) return "Muitas tentativas. Tenta novamente em instantes.";
    if (err.status === 410) return t("messages:thread.errors.readOnly");
    if (err.code === "CHAT_BLOCKED") return t("messages:thread.errors.blocked");
    if (err.code === "BANNED") return t("messages:thread.errors.banned");
    if (err.status === 403) return t("messages:thread.errors.participantsOnly");
  }
  const message = err instanceof Error ? err.message : String(err ?? "");
  if (message.includes("CHAT_BLOCKED")) return t("messages:thread.errors.blocked");
  if (message.includes("BANNED")) return t("messages:thread.errors.banned");
  if (message.includes("READ_ONLY")) return t("messages:thread.errors.readOnly");
  if (message.includes("FORBIDDEN")) return t("messages:thread.errors.participantsOnly");
  if (message.includes("UNAUTHENTICATED")) return t("messages:thread.errors.signInRequired");
  return getUserFacingError(err, fallback);
};

const resolveReadOnlyReasonMessage = (
  reason: string | null | undefined,
  t: (key: string) => string,
) => {
  const normalized = reason?.trim().toUpperCase() ?? "";
  if (normalized === "BOOKING_INACTIVE") return t("messages:thread.readOnly.bookingInactive");
  if (normalized === "COMMUNITY_TEAM_ONLY") return "Só a equipa da organização pode escrever nesta comunidade.";
  if (normalized === "COMMUNITY_WRITE_MUTED") return "A tua escrita está desativada nesta comunidade.";
  if (normalized === "FOLLOW_REQUIRED") return "Precisas de seguir a organização para escrever.";
  return t("messages:thread.readOnly.adminsOnly");
};

const resolveThreadContextLabel = (contextType: string | null | undefined, t: (key: string) => string) => {
  if (contextType === "BOOKING") return t("messages:thread.context.booking");
  if (contextType === "SERVICE") return t("messages:thread.context.service");
  if (contextType === "ORG_CONTACT") return t("messages:thread.context.org");
  if (contextType === "USER_GROUP") return t("messages:thread.context.group");
  if (contextType === "ORG_COMMUNITY") return "Comunidade";
  if (contextType === "ORG_CHANNEL") return "Canal interno";
  return t("messages:thread.context.message");
};

const resolveCommunityAccessLabel = (mode: string | null | undefined) => {
  const normalized = mode?.trim().toUpperCase() ?? "";
  if (normalized === "PUBLIC") return "pública";
  if (normalized === "FOLLOWERS") return "seguidores";
  if (normalized === "APPROVAL") return "aprovação";
  if (normalized === "INVITE") return "convite";
  return "comunidade";
};

const resolveCommunityTalkLabel = (talkPolicy: string | null | undefined) => {
  const normalized = talkPolicy?.trim().toUpperCase() ?? "";
  if (normalized === "TEAM_ONLY") return "fala da equipa";
  return "todos falam";
};

const toUnified = (message: ConversationMessage): UnifiedMessage => {
  return {
    id: message.id,
    body: message.body ?? null,
    createdAt: message.createdAt,
    deletedAt: message.deletedAt ?? null,
    reactions: message.reactions ?? [],
    sender: message.sender,
  };
};

const buildWsBaseUrl = () => {
  const envUrl =
    process.env.EXPO_PUBLIC_CHAT_WS_URL?.trim() ||
    process.env.NEXT_PUBLIC_CHAT_WS_URL?.trim();
  if (envUrl) return envUrl;
  const base = getMobileEnv().apiBaseUrl;
  try {
    const parsed = new URL(base);
    const protocol = parsed.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${parsed.hostname}:4001`;
  } catch {
    return "";
  }
};

export default function ChatThreadScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{
    threadId?: string | string[];
    eventId?: string | string[];
    slug?: string | string[];
    title?: string | string[];
    coverImageUrl?: string | string[];
    startsAt?: string | string[];
    endsAt?: string | string[];
    source?: string | string[];
  }>();
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const topPadding = useTopHeaderPadding(16);
  const topBar = useTopBarScroll({ hideOnScroll: false });
  const { width: screenWidth } = useWindowDimensions();
  const isCompactWidth = screenWidth < 360;
  const horizontalGutter = isCompactWidth ? 14 : 20;
  const messageBubbleMaxWidth = isCompactWidth ? "86%" : "78%";
  const { session } = useAuth();
  const accessToken = session?.access_token ?? null;
  const userId = session?.user?.id ?? null;
  const scrollRef = useRef<ScrollView | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const wsReconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wsPingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const threadId = useMemo(
    () => (Array.isArray(params.threadId) ? params.threadId[0] : params.threadId) ?? "",
    [params.threadId],
  );
  const eventIdRaw = Array.isArray(params.eventId) ? params.eventId[0] : params.eventId;
  const eventId = eventIdRaw ? Number(eventIdRaw) : null;
  const eventSlug = useMemo(
    () => (Array.isArray(params.slug) ? params.slug[0] : params.slug) ?? null,
    [params.slug],
  );
  const source = Array.isArray(params.source) ? params.source[0] : params.source;
  const isEvent = source === "event" || Boolean(eventId);

  const nextRoute = useMemo(
    () => (threadId ? `/comunidade/mensagens/${threadId}` : "/comunidade/mensagens"),
    [threadId],
  );
  const openAuth = useCallback(() => {
    safePush(router, { pathname: "/auth", params: { next: nextRoute } });
  }, [nextRoute, router]);
  const openSenderProfile = useCallback(
    (username?: string | null) => {
      if (!username) return;
      safePush(router, { pathname: "/[username]", params: { username } });
    },
    [router],
  );

  const [messages, setMessages] = useState<UnifiedMessage[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [autoScroll, setAutoScroll] = useState(true);
  const [conversation, setConversation] = useState<ConversationMessagesResponse["conversation"] | null>(null);
  const [members, setMembers] = useState<ConversationMember[]>([]);
  const [conversationCanPost, setConversationCanPost] = useState(true);
  const [conversationReadOnlyReason, setConversationReadOnlyReason] = useState<string | null>(null);
  const [followGraceEndsAt, setFollowGraceEndsAt] = useState<string | null>(null);
  const [mutedUntil, setMutedUntil] = useState<string | null>(null);
  const [pendingReactionKey, setPendingReactionKey] = useState<string | null>(null);
  const [wsStatus, setWsStatus] = useState<"connecting" | "online" | "offline">("offline");
  const [wsRetryNonce, setWsRetryNonce] = useState(0);

  const eventTitle = useMemo(() => {
    const raw = Array.isArray(params.title) ? params.title[0] : params.title;
    return raw ?? t("messages:thread.eventTitleFallback");
  }, [params.title, t]);

  const conversationTitle = useMemo(() => {
    const raw = Array.isArray(params.title) ? params.title[0] : params.title;
    if (raw) return raw;
    if (!conversation) return t("messages:thread.conversationTitleFallback");
    if (conversation.title) return conversation.title;
    const other = members.find((member) => member.userId !== userId);
    return (
      other?.fullName?.trim() ||
      (other?.username ? `@${other.username}` : t("messages:thread.conversationTitleFallback"))
    );
  }, [conversation, members, params.title, t, userId]);

  const coverImageUrl = useMemo(() => {
    const raw = Array.isArray(params.coverImageUrl) ? params.coverImageUrl[0] : params.coverImageUrl;
    return raw ?? null;
  }, [params.coverImageUrl]);

  const canPost = Boolean(conversationCanPost);
  const statusLabel = canPost ? t("messages:status.open") : t("messages:status.readOnly");
  const followGraceMessage = useMemo(() => {
    if (!followGraceEndsAt) return null;
    const graceDate = new Date(followGraceEndsAt);
    if (Number.isNaN(graceDate.getTime())) return null;
    if (graceDate.getTime() <= Date.now()) return null;
    return `Se deixares de seguir, a permanência termina em ${formatTime(followGraceEndsAt)}.`;
  }, [followGraceEndsAt]);

  const loadInitial = useCallback(async () => {
    if (!threadId || !accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetchConversationMessages(threadId, { limit: 40 }, accessToken);
      setConversation(response.conversation ?? null);
      setMembers(response.members ?? []);
      setConversationCanPost(Boolean(response.canPost));
      setConversationReadOnlyReason(response.readOnlyReason ?? null);
      setFollowGraceEndsAt(response.followGraceEndsAt ?? null);
      setMessages(response.items?.map(toUnified) ?? []);
      setCursor(response.nextCursor ?? null);
      const lastMessage = response.items?.[response.items.length - 1];
      if (lastMessage?.id) {
        void markConversationRead(threadId, lastMessage.id, accessToken).catch(() => null);
      }
    } catch (err) {
      setError(resolveChatError(err, t("messages:thread.errors.load"), t));
    } finally {
      setLoading(false);
    }
  }, [accessToken, threadId, t]);

  useEffect(() => {
    if (!threadId || !accessToken) return;
    loadInitial();
  }, [accessToken, loadInitial, threadId]);

  const loadMore = useCallback(async () => {
    if (!threadId || !accessToken || !cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const response = await fetchConversationMessages(threadId, { limit: 40, cursor }, accessToken);
      if (response.items?.length) {
        setMessages((prev) => [...response.items.map(toUnified), ...prev]);
      }
      setCursor(response.nextCursor ?? null);
    } catch (err) {
      setError(resolveChatError(err, t("messages:thread.errors.loadMore"), t));
    } finally {
      setLoadingMore(false);
    }
  }, [accessToken, cursor, loadingMore, threadId, t]);

  const retryRealtime = useCallback(() => {
    setError(null);
    setWsStatus("connecting");
    setWsRetryNonce((current) => current + 1);
    void loadInitial();
  }, [loadInitial]);

  useEffect(() => {
    if (!accessToken || !threadId) return;
    const wsBase = buildWsBaseUrl();
    if (!wsBase) return;
    setWsStatus("connecting");
    let shouldReconnect = true;

    const stopWsPing = () => {
      if (wsPingRef.current) clearInterval(wsPingRef.current);
      wsPingRef.current = null;
    };

    const connect = () => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return;
      setWsStatus("connecting");
      const wsUrl = new URL(wsBase);
      const ws = new WebSocket(wsUrl.toString(), [WS_PROTOCOL_BASE]);
      wsRef.current = ws;
      let handshakeReady = false;
      const handshakeTimeout = setTimeout(() => {
        if (handshakeReady) return;
        setWsStatus("offline");
        try {
          ws.close(4000, "HANDSHAKE_TIMEOUT");
        } catch {
          // ignore
        }
      }, WS_HANDSHAKE_TIMEOUT_MS);

      ws.onopen = () => {
        ws.send(
          JSON.stringify({
            auth: `Bearer ${accessToken}`,
            app_version: WS_APP_VERSION,
            context: {
              type: "dm",
              id: threadId,
            },
            client_platform: "mobile",
            runtime_platform: Platform.OS,
          }),
        );
      };

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (!payload || typeof payload !== "object") return;
          if (payload.type === "handshake:ok") {
            handshakeReady = true;
            clearTimeout(handshakeTimeout);
            setWsStatus("online");
            ws.send(JSON.stringify({ type: "conversation:sync" }));
            stopWsPing();
            wsPingRef.current = setInterval(() => {
              try {
                ws.send(JSON.stringify({ type: "ping" }));
              } catch {
                // ignore
              }
            }, WS_PING_INTERVAL_MS);
            return;
          }
          if (payload.type === "handshake:error") {
            clearTimeout(handshakeTimeout);
            setWsStatus("offline");
            const code = typeof payload.errorCode === "string" ? payload.errorCode.trim().toUpperCase() : "";
            const detail = typeof payload.reason === "string" ? payload.reason.trim().toUpperCase() : "";
            if (code === "RATE_LIMITED") {
              setError("Muitas tentativas de ligação ao chat. Tenta novamente em 1 minuto.");
            } else if (code === "UPGRADE_REQUIRED") {
              setError(
                detail === "APP_VERSION_INVALID"
                  ? "Versão da app inválida. Atualiza para continuar."
                  : "Esta versão da app já não é suportada para chat.",
              );
            } else if (code === "UNAUTHORIZED") {
              setError(t("messages:thread.errors.signInRequired"));
            } else if (code === "FORBIDDEN") {
              setError(t("messages:thread.errors.participantsOnly"));
            }
            return;
          }
          if (!handshakeReady) return;
          if (payload.type === "message:new" && payload.conversationId === threadId) {
            const incoming = payload.message as UnifiedMessage;
            setMessages((prev) => {
              if (prev.some((item) => item.id === incoming.id)) return prev;
              return [...prev, incoming];
            });
            if (incoming.id) {
              markConversationRead(threadId, incoming.id, accessToken).catch(() => null);
            }
          }
          if (payload.type === "message:update" && payload.conversationId === threadId) {
            const updated = payload.message as Partial<UnifiedMessage> & { id?: string };
            if (!updated?.id) return;
            setMessages((prev) =>
              prev.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)),
            );
          }
          if (payload.type === "message:delete" && payload.conversationId === threadId) {
            const deletedAt = payload.deletedAt as string | undefined;
            setMessages((prev) =>
              prev.map((item) =>
                item.id === payload.messageId
                  ? { ...item, deletedAt: deletedAt ?? new Date().toISOString(), body: null }
                  : item,
                ),
            );
          }
          if (payload.type === "reaction:update" && payload.conversationId === threadId) {
            const messageId = typeof payload.messageId === "string" ? payload.messageId : null;
            if (!messageId) return;
            const reactions = Array.isArray(payload.reactions) ? payload.reactions : [];
            setMessages((prev) =>
              prev.map((item) => (item.id === messageId ? { ...item, reactions } : item)),
            );
          }
          if (payload.type === "pin:update" && payload.conversationId === threadId) {
            const messageId = typeof payload.messageId === "string" ? payload.messageId : null;
            if (!messageId) return;
            const pins = Array.isArray(payload.pins) ? payload.pins : [];
            setMessages((prev) =>
              prev.map((item) => (item.id === messageId ? { ...item, pins } : item)),
            );
          }
          if (payload.type === "message:read" && payload.conversationId === threadId) {
            const lastReadMessageId =
              typeof payload.lastReadMessageId === "string" ? payload.lastReadMessageId : null;
            if (lastReadMessageId) {
              markConversationRead(threadId, lastReadMessageId, accessToken).catch(() => null);
            }
          }
        } catch {
          // ignore
        }
      };

      ws.onerror = () => {
        clearTimeout(handshakeTimeout);
        setWsStatus("offline");
      };

      ws.onclose = (event) => {
        clearTimeout(handshakeTimeout);
        stopWsPing();
        wsRef.current = null;
        setWsStatus("offline");
        if (!shouldReconnect) {
          return;
        }
        if (wsReconnectRef.current) clearTimeout(wsReconnectRef.current);
        const reason = typeof event.reason === "string" ? event.reason.trim().toUpperCase() : "";
        const reconnectDelayMs =
          reason === "RATE_LIMITED"
            ? 60000
            : reason === "HANDSHAKE_TIMEOUT"
              ? 4000
              : 2000;
        if (reason === "RATE_LIMITED") {
          setError("Muitas tentativas de ligação ao chat. Tenta novamente em 1 minuto.");
        } else if (reason === "UPGRADE_REQUIRED") {
          setError("Atualiza a app para continuar a usar o chat.");
        } else if (reason === "UNAUTHORIZED") {
          setError(t("messages:thread.errors.signInRequired"));
        } else if (reason === "HANDSHAKE_TIMEOUT") {
          setError("A ligação ao chat demorou demasiado. Vamos tentar novamente.");
        }
        wsReconnectRef.current = setTimeout(connect, reconnectDelayMs);
      };
    };

    connect();
    return () => {
      shouldReconnect = false;
      stopWsPing();
      if (wsReconnectRef.current) clearTimeout(wsReconnectRef.current);
      wsRef.current?.close(1000, "SCREEN_UNMOUNT");
      wsRef.current = null;
    };
  }, [accessToken, threadId, t, wsRetryNonce]);

  useEffect(() => {
    if (!autoScroll) return;
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages, autoScroll]);

  const handleSend = useCallback(async () => {
    if (!threadId || !accessToken || sending) return;
    const body = input.trim();
    if (!body) return;
    setSending(true);
    try {
      const response = await sendConversationMessage(threadId, body, undefined, accessToken);
      const sentItem = toUnified(response.item);
      setMessages((prev) => {
        if (prev.some((item) => item.id === sentItem.id)) return prev;
        return [...prev, sentItem];
      });
      setInput("");
      setAutoScroll(true);
    } catch (err) {
      setError(resolveChatError(err, t("messages:thread.errors.send"), t));
    } finally {
      setSending(false);
    }
  }, [accessToken, input, sending, threadId, t]);

  const handleToggleReaction = useCallback(
    async (message: UnifiedMessage, emoji = "👍") => {
      if (!accessToken || !userId || message.deletedAt) return;
      const actionKey = `${message.id}:${emoji}`;
      if (pendingReactionKey === actionKey) return;

      const existingReaction = (message.reactions ?? []).find(
        (reaction) => reaction.userId === userId && reaction.emoji === emoji,
      );

      setPendingReactionKey(actionKey);
      setMessages((prev) =>
        prev.map((item) => {
          if (item.id !== message.id) return item;
          const current = item.reactions ?? [];
          const withoutMine = current.filter((reaction) => reaction.userId !== userId);
          const next = existingReaction
            ? withoutMine
            : [
                ...withoutMine,
                {
                  messageId: item.id,
                  userId,
                  emoji,
                  createdAt: new Date().toISOString(),
                  user: null,
                },
              ];
          return { ...item, reactions: next };
        }),
      );

      try {
        if (existingReaction) {
          await unreactToMessage(message.id, emoji, accessToken);
        } else {
          await reactToMessage(message.id, emoji, accessToken);
        }
      } catch (err) {
        setError(resolveChatError(err, t("messages:thread.errors.send"), t));
        await loadInitial();
      } finally {
        setPendingReactionKey((current) => (current === actionKey ? null : current));
      }
    },
    [accessToken, loadInitial, pendingReactionKey, t, userId],
  );

  const handleUndo = useCallback(
    async (messageId: string, createdAt: string) => {
      const elapsed = Date.now() - new Date(createdAt).getTime();
      if (elapsed > UNDO_WINDOW_MS) {
        Alert.alert(t("messages:thread.undoPromptTitle"), t("messages:thread.errors.undoExpired"));
        return;
      }
      try {
        await undoConversationMessage(threadId, messageId, accessToken);
        setMessages((prev) =>
          prev.map((item) =>
            item.id === messageId
              ? { ...item, deletedAt: new Date().toISOString(), body: null }
              : item,
          ),
        );
      } catch (err) {
        Alert.alert(
          t("messages:thread.undoPromptTitle"),
          getUserFacingError(err, t("messages:thread.errors.undoFailed")),
        );
      }
    },
    [accessToken, t, threadId],
  );

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      topBar.onScroll(event);
      const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
      const distanceToBottom = contentSize.height - layoutMeasurement.height - contentOffset.y;
      setAutoScroll(distanceToBottom < 60);
    },
    [topBar],
  );

  const openMuteMenu = useCallback(() => {
    const now = Date.now();
    const presets = [
      { label: t("messages:thread.mute.options.1h"), value: now + 60 * 60 * 1000 },
      { label: t("messages:thread.mute.options.8h"), value: now + 8 * 60 * 60 * 1000 },
      { label: t("messages:thread.mute.options.1w"), value: now + 7 * 24 * 60 * 60 * 1000 },
      { label: t("messages:thread.mute.options.forever"), value: now + 365 * 24 * 60 * 60 * 1000 },
    ];
    const buttons = presets.map((preset) => ({
      text: preset.label,
      onPress: async () => {
        const until = new Date(preset.value).toISOString();
        try {
          const res = await muteConversation(threadId, until, accessToken);
          setMutedUntil(res.mutedUntil ?? until);
        } catch (err) {
          Alert.alert(
            t("settings:sections.notifications.title"),
            getUserFacingError(err, t("messages:thread.errors.muteFailed")),
          );
        }
      },
    }));

    if (mutedUntil) {
      buttons.unshift({
        text: t("messages:thread.mute.remove"),
        onPress: async () => {
          try {
            const res = await muteConversation(threadId, null, accessToken);
            setMutedUntil(res.mutedUntil ?? null);
          } catch (err) {
            Alert.alert(
              t("settings:sections.notifications.title"),
              getUserFacingError(err, t("messages:thread.errors.muteUpdateFailed")),
            );
          }
        },
      });
    }

    Alert.alert(t("messages:thread.mute.title"), t("messages:thread.mute.chooseDuration"), [
      ...buttons,
      { text: t("common:actions.cancel"), style: "cancel" },
    ]);
  }, [accessToken, mutedUntil, t, threadId]);

  if (!session?.user?.id) {
    return (
      <LiquidBackground>
        <TopAppHeader scrollState={topBar} variant="title" title={isEvent ? eventTitle : conversationTitle} />
        <View
          style={{
            flex: 1,
            paddingTop: topPadding,
            paddingHorizontal: horizontalGutter,
            paddingBottom: insets.bottom + 24,
          }}
        >
          <GlassCard intensity={55} className="mt-5">
            <Text className="text-white text-sm font-semibold mb-2">
              {t("messages:thread.signinTitle")}
            </Text>
            <Text className="text-white/82 text-sm">{t("messages:thread.signinBody")}</Text>
            <Pressable
              onPress={openAuth}
              className="mt-4 rounded-2xl bg-white/90 px-4 py-3"
              style={{ minHeight: tokens.layout.touchTarget }}
              accessibilityRole="button"
              accessibilityLabel={t("common:actions.signIn")}
            >
              <Text className="text-center text-sm font-semibold" style={{ color: "#0b101a" }}>
                {t("common:actions.signIn")}
              </Text>
            </Pressable>
          </GlassCard>
        </View>
      </LiquidBackground>
    );
  }

  const backButton = (
    <Pressable
      onPress={() => safeBack(router, navigation, "/comunidade/mensagens")}
      accessibilityRole="button"
      accessibilityLabel={t("common:actions.back")}
      style={({ pressed }) => [
        {
          width: tokens.layout.touchTarget,
          height: tokens.layout.touchTarget,
          alignItems: "center",
          justifyContent: "center",
          minHeight: tokens.layout.touchTarget,
        },
        pressed ? { opacity: 0.8 } : null,
      ]}
    >
      <Ionicons name="chevron-back" size={20} color="rgba(255,255,255,0.9)" />
    </Pressable>
  );

  const muteButton = (
    <Pressable
      onPress={openMuteMenu}
      accessibilityRole="button"
      accessibilityLabel={t("messages:thread.mute.title")}
      style={({ pressed }) => [
        {
          width: tokens.layout.touchTarget,
          height: tokens.layout.touchTarget,
          alignItems: "center",
          justifyContent: "center",
          minHeight: tokens.layout.touchTarget,
        },
        pressed ? { opacity: 0.8 } : null,
      ]}
    >
      <Ionicons name="notifications-off-outline" size={18} color="rgba(255,255,255,0.9)" />
    </Pressable>
  );

  return (
    <LiquidBackground>
      <TopAppHeader
        scrollState={topBar}
        variant="title"
        title={isEvent ? eventTitle : conversationTitle}
        leftSlot={backButton}
        rightSlot={muteButton}
        showMessages={false}
        showNotifications
      />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 40 : 0}
      >
        <View
          style={{
            flex: 1,
            paddingTop: topPadding,
            paddingHorizontal: horizontalGutter,
            paddingBottom: insets.bottom + 12,
          }}
        >
          {isEvent ? (
            <GlassCard intensity={60} className="mt-4">
              <View className={isCompactWidth ? "gap-3" : "flex-row items-center gap-3"}>
                <View className="flex-row items-center gap-3" style={{ flex: 1 }}>
                  <View
                    style={{
                      width: 46,
                      height: 46,
                      borderRadius: 14,
                      overflow: "hidden",
                      backgroundColor: "rgba(255,255,255,0.08)",
                    }}
                  >
                    {coverImageUrl ? (
                      <Image source={{ uri: coverImageUrl }} style={{ width: "100%", height: "100%" }} />
                    ) : (
                      <View className="flex-1 items-center justify-center">
                        <Ionicons name="calendar-outline" size={18} color="rgba(255,255,255,0.6)" />
                      </View>
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text className="text-white text-sm font-semibold" numberOfLines={1}>
                      {eventTitle}
                    </Text>
                    <Text className="text-white/82 text-xs mt-1">{statusLabel}</Text>
                  </View>
                </View>
                {eventSlug ? (
                  <Pressable
                    onPress={() =>
                      safePush(router, {
                        pathname: "/event/[slug]",
                        params: { slug: eventSlug, source: "messages" },
                      })
                    }
                    className="rounded-full border border-white/15 px-3 py-1"
                    style={{ alignSelf: isCompactWidth ? "flex-start" : "center" }}
                    accessibilityRole="button"
                    accessibilityLabel={t("messages:thread.viewEvent")}
                  >
                    <Text className="text-white/88 text-[11px]">{t("messages:thread.viewEvent")}</Text>
                  </Pressable>
                ) : null}
              </View>
            </GlassCard>
          ) : (
            <GlassCard intensity={60} className="mt-4">
              <View className={isCompactWidth ? "gap-3" : "flex-row items-center gap-3"}>
                <View className="flex-row items-center gap-3" style={{ flex: 1 }}>
                  <View
                    style={{
                      width: 46,
                      height: 46,
                      borderRadius: 14,
                      overflow: "hidden",
                      backgroundColor: "rgba(255,255,255,0.08)",
                    }}
                  >
                    {coverImageUrl ? (
                      <Image source={{ uri: coverImageUrl }} style={{ width: "100%", height: "100%" }} />
                    ) : (
                      <View className="flex-1 items-center justify-center">
                        <Ionicons name="chatbubble-ellipses-outline" size={18} color="rgba(255,255,255,0.6)" />
                      </View>
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text className="text-white text-sm font-semibold" numberOfLines={1}>
                      {conversationTitle}
                    </Text>
                    <Text className="text-white/85 text-xs mt-1">
                      {resolveThreadContextLabel(conversation?.contextType, t)}
                    </Text>
                    {conversation?.contextType === "ORG_COMMUNITY" && conversation.community ? (
                      <Text className="text-sky-100 text-[11px] mt-1">
                        {resolveCommunityAccessLabel(conversation.community.accessMode)} ·{" "}
                        {resolveCommunityTalkLabel(conversation.community.talkPolicy)}
                      </Text>
                    ) : null}
                  </View>
                </View>
              </View>
            </GlassCard>
          )}

          {!loading && wsStatus !== "online" ? (
            <GlassCard intensity={44} className="mt-3">
              <View className="flex-row items-center justify-between gap-2">
                <Text className="text-white/92 text-xs" style={{ flex: 1 }}>
                  {wsStatus === "connecting"
                    ? "A ligar ao chat em tempo real..."
                    : "Ligação em modo degradado. A atualização pode demorar alguns segundos."}
                </Text>
                {wsStatus === "connecting" ? (
                  <ActivityIndicator size="small" color="rgba(255,255,255,0.9)" />
                ) : null}
                {wsStatus === "offline" ? (
                  <Pressable
                    onPress={retryRealtime}
                    className="rounded-full border border-white/24 bg-white/10 px-3 py-1.5"
                    style={{ minHeight: tokens.layout.touchTarget, justifyContent: "center" }}
                    accessibilityRole="button"
                    accessibilityLabel={t("common:actions.retry")}
                  >
                    <Text className="text-white text-[11px] font-semibold">{t("common:actions.retry")}</Text>
                  </Pressable>
                ) : null}
              </View>
            </GlassCard>
          ) : null}

          {!canPost ? (
            <GlassCard intensity={48} className="mt-4">
              <Text className="text-white text-sm font-semibold mb-1">
                {t("messages:thread.readOnly.title")}
              </Text>
              <Text className="text-white/82 text-sm">
                {resolveReadOnlyReasonMessage(conversationReadOnlyReason, t)}
              </Text>
            </GlassCard>
          ) : null}

          {followGraceMessage ? (
            <GlassCard intensity={44} className="mt-3">
              <Text className="text-white/88 text-xs">{followGraceMessage}</Text>
            </GlassCard>
          ) : null}

          {loading ? (
            <View className="mt-5 gap-3">
              <GlassSkeleton height={120} />
              <GlassSkeleton height={140} />
            </View>
          ) : error ? (
            <GlassCard intensity={52} className="mt-5">
              <Text className="text-red-300 text-sm mb-2">{error}</Text>
              <Pressable
                onPress={retryRealtime}
                className="rounded-2xl bg-white/10 px-4 py-3"
                style={{ minHeight: tokens.layout.touchTarget }}
                accessibilityRole="button"
                accessibilityLabel={t("common:actions.retry")}
              >
                <Text className="text-white text-sm font-semibold text-center">
                  {t("common:actions.retry")}
                </Text>
              </Pressable>
            </GlassCard>
          ) : (
            <ScrollView
              ref={scrollRef}
              onScroll={handleScroll}
              onScrollEndDrag={topBar.onScrollEndDrag}
              onMomentumScrollEnd={topBar.onMomentumScrollEnd}
              scrollEventThrottle={16}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingTop: 16, paddingBottom: 12, gap: 12 }}
            >
              {cursor ? (
                <Pressable
                  onPress={loadMore}
                  disabled={loadingMore}
                  className="self-center rounded-full border border-white/15 px-4 py-2"
                  accessibilityRole="button"
                  accessibilityLabel={t("messages:thread.loadOlder")}
                  accessibilityState={{ disabled: loadingMore }}
                >
                  <Text className="text-white/85 text-xs">
                    {loadingMore ? t("common:actions.loading") : t("messages:thread.loadOlder")}
                  </Text>
                </Pressable>
              ) : null}
              {messages.length === 0 ? (
                <Text className="text-white/90 text-sm text-center">
                  {t("messages:thread.empty")}
                </Text>
              ) : null}
              {messages.map((message) => {
                const isMine = message.sender?.id === userId;
                const isAnnouncement = message.kind === "ANNOUNCEMENT";
                const isDeleted = Boolean(message.deletedAt);
                const reactions = message.reactions ?? [];
                const myThumbReaction = reactions.some(
                  (reaction) => reaction.userId === userId && reaction.emoji === "👍",
                );
                const thumbCount = reactions.filter((reaction) => reaction.emoji === "👍").length;
                const reactionBusy = pendingReactionKey === `${message.id}:👍`;
                if (isAnnouncement) {
                  return (
                    <View key={message.id} className="items-center">
                      <GlassCard intensity={55} padding={12}>
                        <Text className="text-white text-xs font-semibold">
                          {t("messages:thread.announcement")}
                        </Text>
                        <Text className="text-white/88 text-sm mt-1">{message.body}</Text>
                        <Text className="text-white/88 text-[11px] mt-2">{formatTime(message.createdAt)}</Text>
                      </GlassCard>
                    </View>
                  );
                }
                return (
                  <View
                    key={message.id}
                    style={{
                      flexDirection: "row",
                      justifyContent: isMine ? "flex-end" : "flex-start",
                    }}
                  >
                    {!isMine ? (
                      <Pressable
                        onPress={() => openSenderProfile(message.sender?.username)}
                        disabled={!message.sender?.username}
                        style={{ marginRight: 8 }}
                        accessibilityRole="button"
                        accessibilityLabel={t("messages:thread.openProfile")}
                        accessibilityState={{ disabled: !message.sender?.username }}
                      >
                        <AvatarCircle
                          size={28}
                          uri={message.sender?.avatarUrl ?? null}
                          iconName="person"
                          iconColor="rgba(255,255,255,0.6)"
                        />
                      </Pressable>
                    ) : null}
                    <Pressable
                      onLongPress={() => {
                        if (!isMine) return;
                        Alert.alert(t("messages:thread.undoPromptTitle"), t("messages:thread.undoPromptBody"), [
                          { text: t("common:actions.cancel"), style: "cancel" },
                          {
                            text: t("messages:thread.undoAction"),
                            style: "destructive",
                            onPress: () => handleUndo(message.id, message.createdAt),
                          },
                        ]);
                      }}
                      disabled={!isMine}
                    >
                      <View
                        style={{
                          maxWidth: messageBubbleMaxWidth,
                          backgroundColor: isMine ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.08)",
                          borderRadius: 16,
                          paddingHorizontal: 12,
                          paddingVertical: 8,
                          opacity: isDeleted ? 0.65 : 1,
                        }}
                      >
                        {!isMine && message.sender?.fullName ? (
                          <Pressable
                            onPress={() => openSenderProfile(message.sender?.username)}
                            disabled={!message.sender?.username}
                            style={{ alignSelf: "flex-start" }}
                            accessibilityRole="button"
                            accessibilityLabel={t("messages:thread.openProfile")}
                            accessibilityState={{ disabled: !message.sender?.username }}
                          >
                            <Text className="text-white/88 text-[11px] mb-1">{message.sender.fullName}</Text>
                          </Pressable>
                        ) : null}
                        <Text className="text-white text-sm">
                          {isDeleted ? t("messages:thread.messageDeleted") : message.body}
                        </Text>
                        <Text className="text-white/88 text-[10px] mt-1 text-right">
                          {formatTime(message.createdAt)}
                        </Text>
                        {thumbCount > 0 ? (
                          <Text className="mt-1 text-right text-[10px] text-white/90">
                            👍 {thumbCount}
                          </Text>
                        ) : null}
                        {!canPost && !isDeleted ? (
                          <View className="mt-2 items-end">
                            <Pressable
                              onPress={() => handleToggleReaction(message, "👍")}
                              disabled={reactionBusy}
                              className="rounded-full border border-white/28 bg-white/14 px-2.5 py-1"
                              accessibilityRole="button"
                              accessibilityLabel="Reagir com gosto"
                              accessibilityState={{ disabled: reactionBusy }}
                            >
                              {reactionBusy ? (
                                <ActivityIndicator size="small" color="rgba(255,255,255,0.9)" />
                              ) : (
                                <Text className={`text-[11px] ${myThumbReaction ? "text-white" : "text-white/88"}`}>
                                  👍
                                </Text>
                              )}
                            </Pressable>
                          </View>
                        ) : null}
                      </View>
                    </Pressable>
                  </View>
                );
              })}
            </ScrollView>
          )}
        </View>

        <View
          style={{
            paddingHorizontal: horizontalGutter,
            paddingBottom: insets.bottom + 12,
            paddingTop: 8,
          }}
        >
          {canPost ? (
            <View className="flex-row items-end gap-2">
              <TextInput
                value={input}
                onChangeText={setInput}
                placeholder={t("messages:thread.inputPlaceholder")}
                placeholderTextColor="rgba(255,255,255,0.72)"
                className="flex-1 rounded-2xl border border-white/28 bg-white/14 px-4 py-3 text-white"
                multiline
                style={{ minHeight: tokens.layout.touchTarget }}
                accessibilityLabel={t("messages:thread.send")}
              />
              <Pressable
                onPress={handleSend}
                disabled={sending || !input.trim()}
                className="rounded-2xl bg-white/90 px-4 py-3"
                style={{ minHeight: tokens.layout.touchTarget }}
                accessibilityRole="button"
                accessibilityLabel={t("messages:thread.send")}
                accessibilityState={{ disabled: sending || !input.trim() }}
              >
                {sending ? (
                  <ActivityIndicator color="#0b101a" />
                ) : (
                  <Ionicons name="send" size={18} color="#0b101a" />
                )}
              </Pressable>
            </View>
          ) : (
            <Text className="text-white/90 text-xs text-center">
              {conversationReadOnlyReason
                ? resolveReadOnlyReasonMessage(conversationReadOnlyReason, t)
                : t("messages:thread.readOnly.announcementsOnly")}
            </Text>
          )}
        </View>
      </KeyboardAvoidingView>
    </LiquidBackground>
  );
}
