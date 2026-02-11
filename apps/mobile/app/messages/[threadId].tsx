import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useNavigation } from "@react-navigation/native";
import { LiquidBackground } from "../../components/liquid/LiquidBackground";
import { TopAppHeader } from "../../components/navigation/TopAppHeader";
import { useTopHeaderPadding } from "../../components/navigation/useTopHeaderPadding";
import { useTopBarScroll } from "../../components/navigation/useTopBarScroll";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "../../components/icons/Ionicons";
import { tokens, useTranslation } from "@orya/shared";
import { GlassCard } from "../../components/liquid/GlassCard";
import { GlassSkeleton } from "../../components/glass/GlassSkeleton";
import { Image } from "expo-image";
import { AvatarCircle } from "../../components/avatar/AvatarCircle";
import { safeBack } from "../../lib/navigation";
import { useAuth } from "../../lib/auth";
import {
  fetchConversationMessages,
  sendConversationMessage,
  markConversationRead,
  muteConversation,
  undoConversationMessage,
} from "../../features/messages/api";
import type { ConversationMessage, ConversationMember, ConversationMessagesResponse } from "../../features/messages/types";
import { getUserFacingError } from "../../lib/errors";
import { getMobileEnv } from "../../lib/env";
import { formatTime } from "../../lib/formatters";

const WS_PING_INTERVAL_MS = 25000;
const UNDO_WINDOW_MS = 2 * 60 * 1000;
const WS_PROTOCOL_BASE = "orya-chat.v1";
const WS_AUTH_PROTOCOL_PREFIX = "orya-chat.auth.";

type UnifiedMessage = {
  id: string;
  body: string | null;
  createdAt: string;
  deletedAt?: string | null;
  kind?: "USER" | "ANNOUNCEMENT" | "SYSTEM";
  sender: {
    id: string;
    fullName: string | null;
    username: string | null;
    avatarUrl: string | null;
  } | null;
};

const resolveChatError = (err: unknown, fallback: string, t: (key: string) => string) => {
  const message = err instanceof Error ? err.message : String(err ?? "");
  if (message.includes("READ_ONLY")) return t("messages:thread.errors.readOnly");
  if (message.includes("FORBIDDEN")) return t("messages:thread.errors.participantsOnly");
  if (message.includes("UNAUTHENTICATED")) return t("messages:thread.errors.signInRequired");
  return getUserFacingError(err, fallback);
};

const toUnified = (message: ConversationMessage): UnifiedMessage => {
  return {
    id: message.id,
    body: message.body ?? null,
    createdAt: message.createdAt,
    deletedAt: message.deletedAt ?? null,
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

  const nextRoute = useMemo(() => (threadId ? `/messages/${threadId}` : "/messages"), [threadId]);
  const openAuth = useCallback(() => {
    router.push({ pathname: "/auth", params: { next: nextRoute } });
  }, [nextRoute, router]);
  const openSenderProfile = useCallback(
    (username?: string | null) => {
      if (!username) return;
      router.push({ pathname: "/[username]", params: { username } });
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
  const [mutedUntil, setMutedUntil] = useState<string | null>(null);

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
      setMessages(response.items?.map(toUnified) ?? []);
      setCursor(response.nextCursor ?? null);
      const lastMessage = response.items?.[response.items.length - 1];
      if (lastMessage?.id) {
        await markConversationRead(threadId, lastMessage.id, accessToken).catch(() => null);
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

  useEffect(() => {
    if (!accessToken || !threadId) return;
    const wsBase = buildWsBaseUrl();
    if (!wsBase) return;
    const stopWsPing = () => {
      if (wsPingRef.current) clearInterval(wsPingRef.current);
      wsPingRef.current = null;
    };

    const connect = () => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return;
      const wsUrl = new URL(wsBase);
      wsUrl.searchParams.set("scope", "b2c");
      const ws = new WebSocket(wsUrl.toString(), [
        WS_PROTOCOL_BASE,
        `${WS_AUTH_PROTOCOL_PREFIX}${accessToken}`,
      ]);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: "conversation:sync" }));
        stopWsPing();
        wsPingRef.current = setInterval(() => {
          try {
            ws.send(JSON.stringify({ type: "ping" }));
          } catch {
            // ignore
          }
        }, WS_PING_INTERVAL_MS);
      };

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (!payload || typeof payload !== "object") return;
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
        } catch {
          // ignore
        }
      };

      ws.onclose = () => {
        stopWsPing();
        wsRef.current = null;
        if (wsReconnectRef.current) clearTimeout(wsReconnectRef.current);
        wsReconnectRef.current = setTimeout(connect, 2000);
      };
    };

    connect();
    return () => {
      stopWsPing();
      if (wsReconnectRef.current) clearTimeout(wsReconnectRef.current);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [accessToken, threadId]);

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
      setMessages((prev) => [...prev, toUnified(response.item)]);
      setInput("");
      setAutoScroll(true);
    } catch (err) {
      setError(resolveChatError(err, t("messages:thread.errors.send"), t));
    } finally {
      setSending(false);
    }
  }, [accessToken, input, sending, threadId, t]);

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
    (event: any) => {
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
        <View style={{ flex: 1, paddingTop: topPadding, paddingHorizontal: 20, paddingBottom: insets.bottom + 24 }}>
          <GlassCard intensity={55} className="mt-5">
            <Text className="text-white text-sm font-semibold mb-2">
              {t("messages:thread.signinTitle")}
            </Text>
            <Text className="text-white/65 text-sm">{t("messages:thread.signinBody")}</Text>
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
      onPress={() => safeBack(router, navigation, "/messages")}
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
        <View style={{ flex: 1, paddingTop: topPadding, paddingHorizontal: 20, paddingBottom: insets.bottom + 12 }}>
          {isEvent ? (
            <GlassCard intensity={60} className="mt-4">
              <View className="flex-row items-center gap-3">
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
                  <Text className="text-white/60 text-xs mt-1">{statusLabel}</Text>
                </View>
                {eventSlug ? (
                  <Pressable
                    onPress={() =>
                      router.push({
                        pathname: "/event/[slug]",
                        params: { slug: eventSlug, source: "messages" },
                      })
                    }
                    className="rounded-full border border-white/15 px-3 py-1"
                    accessibilityRole="button"
                    accessibilityLabel={t("messages:thread.viewEvent")}
                  >
                    <Text className="text-white/70 text-[11px]">{t("messages:thread.viewEvent")}</Text>
                  </Pressable>
                ) : null}
              </View>
            </GlassCard>
          ) : (
            <GlassCard intensity={60} className="mt-4">
              <View className="flex-row items-center gap-3">
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
                  <Text className="text-white/60 text-xs mt-1">
                    {conversation?.contextType === "BOOKING"
                      ? t("messages:thread.context.booking")
                      : conversation?.contextType === "SERVICE"
                        ? t("messages:thread.context.service")
                        : conversation?.contextType === "ORG_CONTACT"
                          ? t("messages:thread.context.org")
                          : conversation?.contextType === "USER_GROUP"
                            ? t("messages:thread.context.group")
                            : t("messages:thread.context.message")}
                  </Text>
                </View>
              </View>
            </GlassCard>
          )}

          {!canPost ? (
            <GlassCard intensity={48} className="mt-4">
              <Text className="text-white text-sm font-semibold mb-1">
                {t("messages:thread.readOnly.title")}
              </Text>
              <Text className="text-white/65 text-sm">
                {conversationReadOnlyReason === "BOOKING_INACTIVE"
                  ? t("messages:thread.readOnly.bookingInactive")
                  : t("messages:thread.readOnly.adminsOnly")}
              </Text>
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
                onPress={loadInitial}
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
                  <Text className="text-white/70 text-xs">
                    {loadingMore ? t("common:actions.loading") : t("messages:thread.loadOlder")}
                  </Text>
                </Pressable>
              ) : null}
              {messages.length === 0 ? (
                <Text className="text-white/60 text-sm text-center">
                  {t("messages:thread.empty")}
                </Text>
              ) : null}
              {messages.map((message) => {
                const isMine = message.sender?.id === userId;
                const isAnnouncement = message.kind === "ANNOUNCEMENT";
                const isDeleted = Boolean(message.deletedAt);
                if (isAnnouncement) {
                  return (
                    <View key={message.id} className="items-center">
                      <GlassCard intensity={55} padding={12}>
                        <Text className="text-white text-xs font-semibold">
                          {t("messages:thread.announcement")}
                        </Text>
                        <Text className="text-white/75 text-sm mt-1">{message.body}</Text>
                        <Text className="text-white/50 text-[11px] mt-2">{formatTime(message.createdAt)}</Text>
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
                          maxWidth: "78%",
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
                            <Text className="text-white/70 text-[11px] mb-1">{message.sender.fullName}</Text>
                          </Pressable>
                        ) : null}
                        <Text className="text-white text-sm">
                          {isDeleted ? t("messages:thread.messageDeleted") : message.body}
                        </Text>
                        <Text className="text-white/45 text-[10px] mt-1 text-right">
                          {formatTime(message.createdAt)}
                        </Text>
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
            paddingHorizontal: 20,
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
                placeholderTextColor="rgba(255,255,255,0.4)"
                className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white"
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
            <Text className="text-white/60 text-xs text-center">
              {conversationReadOnlyReason
                ? t("messages:thread.readOnly.footer")
                : t("messages:thread.readOnly.announcementsOnly")}
            </Text>
          )}
        </View>
      </KeyboardAvoidingView>
    </LiquidBackground>
  );
}
