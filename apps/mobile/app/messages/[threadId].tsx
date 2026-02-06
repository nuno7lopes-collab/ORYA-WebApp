import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "../../components/icons/Ionicons";
import { tokens } from "@orya/shared";
import { GlassCard } from "../../components/liquid/GlassCard";
import { GlassSkeleton } from "../../components/glass/GlassSkeleton";
import { Image } from "expo-image";
import { safeBack } from "../../lib/navigation";
import { useAuth } from "../../lib/auth";
import { fetchChatMessages, sendChatMessage } from "../../features/chat/api";
import { useEventChatThread } from "../../features/chat/hooks";
import { ChatMessage } from "../../features/chat/types";
import { getUserFacingError } from "../../lib/errors";

const POLL_INTERVAL_MS = 6000;

const formatTime = (value?: string | null) => {
  if (!value) return "";
  try {
    return new Intl.DateTimeFormat("pt-PT", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
  } catch {
    return "";
  }
};

const resolveStatusLabel = (status?: string | null) => {
  if (status === "OPEN") return "Chat aberto";
  if (status === "ANNOUNCEMENTS") return "Anúncios";
  if (status === "READ_ONLY") return "Só leitura";
  return "Fechado";
};

const resolveChatError = (err: unknown, fallback: string) => {
  const message = err instanceof Error ? err.message : String(err ?? "");
  if (message.includes("READ_ONLY")) return "Este chat está em modo leitura.";
  if (message.includes("FORBIDDEN")) return "Chat disponível apenas para participantes.";
  if (message.includes("UNAUTHENTICATED")) return "Inicia sessão para aceder ao chat.";
  return getUserFacingError(err, fallback);
};

export default function ChatThreadScreen() {
  const params = useLocalSearchParams<{
    threadId?: string | string[];
    eventId?: string | string[];
    title?: string | string[];
    coverImageUrl?: string | string[];
    startsAt?: string | string[];
    endsAt?: string | string[];
  }>();
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const topPadding = useTopHeaderPadding(16);
  const { session } = useAuth();
  const accessToken = session?.access_token ?? null;
  const userId = session?.user?.id ?? null;
  const scrollRef = useRef<ScrollView | null>(null);

  const threadId = useMemo(
    () => (Array.isArray(params.threadId) ? params.threadId[0] : params.threadId) ?? "",
    [params.threadId],
  );
  const eventIdRaw = Array.isArray(params.eventId) ? params.eventId[0] : params.eventId;
  const eventId = eventIdRaw ? Number(eventIdRaw) : null;

  const threadQuery = useEventChatThread(eventId, Boolean(eventId && accessToken), accessToken);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [latestCursor, setLatestCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [autoScroll, setAutoScroll] = useState(true);

  const eventTitle = useMemo(() => {
    const raw = Array.isArray(params.title) ? params.title[0] : params.title;
    return raw ?? threadQuery.data?.event.title ?? "Chat do evento";
  }, [params.title, threadQuery.data?.event.title]);
  const coverImageUrl = useMemo(() => {
    const raw = Array.isArray(params.coverImageUrl) ? params.coverImageUrl[0] : params.coverImageUrl;
    return raw ?? threadQuery.data?.event.coverImageUrl ?? null;
  }, [params.coverImageUrl, threadQuery.data?.event.coverImageUrl]);

  const statusLabel = resolveStatusLabel(threadQuery.data?.thread.status);
  const canPost = Boolean(threadQuery.data?.canPost);

  const loadInitial = useCallback(async () => {
    if (!threadId || !accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetchChatMessages(threadId, { limit: 40 }, accessToken);
      setMessages(response.items ?? []);
      setCursor(response.nextCursor ?? null);
      setLatestCursor(response.latestCursor ?? null);
    } catch (err) {
      setError(resolveChatError(err, "Não foi possível carregar o chat."));
    } finally {
      setLoading(false);
    }
  }, [accessToken, threadId]);

  useEffect(() => {
    if (!threadId || !accessToken) return;
    loadInitial();
  }, [accessToken, loadInitial, threadId]);

  const loadMore = useCallback(async () => {
    if (!threadId || !accessToken || !cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const response = await fetchChatMessages(threadId, { limit: 40, cursor }, accessToken);
      if (response.items?.length) {
        setMessages((prev) => [...response.items, ...prev]);
      }
      setCursor(response.nextCursor ?? null);
    } catch (err) {
      setError(resolveChatError(err, "Não foi possível carregar mais mensagens."));
    } finally {
      setLoadingMore(false);
    }
  }, [accessToken, cursor, loadingMore, threadId]);

  useEffect(() => {
    if (!threadId || !accessToken) return;
    const interval = setInterval(async () => {
      try {
        const response = await fetchChatMessages(
          threadId,
          latestCursor ? { after: latestCursor } : { limit: 12 },
          accessToken,
        );
        if (response.items?.length) {
          setMessages((prev) => {
            const existing = new Set(prev.map((item) => item.id));
            const fresh = response.items.filter((item) => !existing.has(item.id));
            return fresh.length > 0 ? [...prev, ...fresh] : prev;
          });
        }
        if (response.latestCursor) {
          setLatestCursor(response.latestCursor);
        }
      } catch {
        // silent polling failure
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [accessToken, latestCursor, threadId]);

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
      const message = await sendChatMessage(threadId, body, accessToken);
      setMessages((prev) => [...prev, message]);
      setInput("");
      setAutoScroll(true);
    } catch (err) {
      setError(resolveChatError(err, "Não foi possível enviar a mensagem."));
    } finally {
      setSending(false);
    }
  }, [accessToken, input, sending, threadId]);

  const handleScroll = useCallback((event: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const distanceToBottom = contentSize.height - layoutMeasurement.height - contentOffset.y;
    setAutoScroll(distanceToBottom < 60);
  }, []);

  if (!session?.user?.id) {
    return (
      <LiquidBackground>
        <TopAppHeader />
        <View style={{ flex: 1, paddingTop: topPadding, paddingHorizontal: 20, paddingBottom: insets.bottom + 24 }}>
          <Pressable
            onPress={() => safeBack(router, navigation)}
            className="flex-row items-center gap-2"
            style={{ minHeight: tokens.layout.touchTarget }}
          >
            <Ionicons name="chevron-back" size={20} color="rgba(255,255,255,0.9)" />
            <Text style={{ color: "rgba(255,255,255,0.9)", fontSize: 14, fontWeight: "600" }}>Voltar</Text>
          </Pressable>
          <GlassCard intensity={55} className="mt-5">
            <Text className="text-white text-sm font-semibold mb-2">Inicia sessão</Text>
            <Text className="text-white/65 text-sm">Entra para aceder ao chat do evento.</Text>
            <Pressable
              onPress={() => router.push("/auth")}
              className="mt-4 rounded-2xl bg-white/90 px-4 py-3"
              style={{ minHeight: tokens.layout.touchTarget }}
            >
              <Text className="text-center text-sm font-semibold" style={{ color: "#0b101a" }}>
                Entrar
              </Text>
            </Pressable>
          </GlassCard>
        </View>
      </LiquidBackground>
    );
  }

  return (
    <LiquidBackground>
      <TopAppHeader />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 40 : 0}
      >
        <View style={{ flex: 1, paddingTop: topPadding, paddingHorizontal: 20, paddingBottom: insets.bottom + 12 }}>
          <Pressable
            onPress={() => safeBack(router, navigation)}
            className="flex-row items-center gap-2"
            style={{ minHeight: tokens.layout.touchTarget }}
          >
            <Ionicons name="chevron-back" size={20} color="rgba(255,255,255,0.9)" />
            <Text style={{ color: "rgba(255,255,255,0.9)", fontSize: 14, fontWeight: "600" }}>Voltar</Text>
          </Pressable>

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
              {threadQuery.data?.event.slug ? (
                <Pressable
                  onPress={() =>
                    router.push({ pathname: "/event/[slug]", params: { slug: threadQuery.data?.event.slug ?? "" } })
                  }
                  className="rounded-full border border-white/15 px-3 py-1"
                >
                  <Text className="text-white/70 text-[11px]">Ver evento</Text>
                </Pressable>
              ) : null}
            </View>
          </GlassCard>

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
              >
                <Text className="text-white text-sm font-semibold text-center">Tentar novamente</Text>
              </Pressable>
            </GlassCard>
          ) : (
            <ScrollView
              ref={scrollRef}
              onScroll={handleScroll}
              scrollEventThrottle={16}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingTop: 16, paddingBottom: 12, gap: 12 }}
            >
              {cursor ? (
                <Pressable
                  onPress={loadMore}
                  disabled={loadingMore}
                  className="self-center rounded-full border border-white/15 px-4 py-2"
                >
                  <Text className="text-white/70 text-xs">
                    {loadingMore ? "A carregar..." : "Carregar mensagens antigas"}
                  </Text>
                </Pressable>
              ) : null}
              {messages.length === 0 ? (
                <Text className="text-white/60 text-sm text-center">
                  Ainda não há mensagens. Diz olá ao grupo.
                </Text>
              ) : null}
              {messages.map((message) => {
                const isMine = message.sender?.id === userId;
                const isAnnouncement = message.kind === "ANNOUNCEMENT";
                if (isAnnouncement) {
                  return (
                    <View key={message.id} className="items-center">
                      <GlassCard intensity={55} padding={12}>
                        <Text className="text-white text-xs font-semibold">Anúncio</Text>
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
                      <View
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 14,
                          overflow: "hidden",
                          backgroundColor: "rgba(255,255,255,0.08)",
                          marginRight: 8,
                        }}
                      >
                        {message.sender?.avatarUrl ? (
                          <Image source={{ uri: message.sender.avatarUrl }} style={{ width: "100%", height: "100%" }} />
                        ) : (
                          <View className="flex-1 items-center justify-center">
                            <Ionicons name="person" size={14} color="rgba(255,255,255,0.6)" />
                          </View>
                        )}
                      </View>
                    ) : null}
                    <View
                      style={{
                        maxWidth: "78%",
                        backgroundColor: isMine ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.08)",
                        borderRadius: 16,
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                      }}
                    >
                      {!isMine && message.sender?.fullName ? (
                        <Text className="text-white/70 text-[11px] mb-1">{message.sender.fullName}</Text>
                      ) : null}
                      <Text className="text-white text-sm">{message.body}</Text>
                      <Text className="text-white/45 text-[10px] mt-1 text-right">
                        {formatTime(message.createdAt)}
                      </Text>
                    </View>
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
          {threadQuery.isError && !threadQuery.data ? (
            <Text className="text-white/60 text-xs text-center">
              Chat disponível apenas para participantes.
            </Text>
          ) : canPost ? (
            <View className="flex-row items-end gap-2">
              <TextInput
                value={input}
                onChangeText={setInput}
                placeholder="Escreve uma mensagem"
                placeholderTextColor="rgba(255,255,255,0.4)"
                className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white"
                multiline
                style={{ minHeight: tokens.layout.touchTarget }}
              />
              <Pressable
                onPress={handleSend}
                disabled={sending || !input.trim()}
                className="rounded-2xl bg-white/90 px-4 py-3"
                style={{ minHeight: tokens.layout.touchTarget }}
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
              {statusLabel === "Só leitura" || statusLabel === "Fechado"
                ? "Este chat está em modo leitura."
                : "Apenas organizadores podem publicar anúncios."}
            </Text>
          )}
        </View>
      </KeyboardAvoidingView>
    </LiquidBackground>
  );
}
