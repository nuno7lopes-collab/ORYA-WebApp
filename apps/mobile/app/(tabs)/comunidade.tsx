import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useIsFocused } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { tokens, useTranslation } from "@orya/shared";
import { LiquidBackground } from "../../components/liquid/LiquidBackground";
import { TopAppHeader } from "../../components/navigation/TopAppHeader";
import { useTopHeaderPadding } from "../../components/navigation/useTopHeaderPadding";
import { useTopBarScroll } from "../../components/navigation/useTopBarScroll";
import { useTabBarPadding } from "../../components/navigation/useTabBarPadding";
import { useAuth } from "../../lib/auth";
import { safePush } from "../../lib/navigation";
import { useIpLocation } from "../../features/onboarding/hooks";
import { useSocialFeed } from "../../features/social/hooks";
import { SocialFeedCard } from "../../features/social/SocialFeedCard";
import {
  useMessagesInbox,
  useMessageCommunityInvites,
  useMessageRequests,
} from "../../features/messages/hooks";

const formatTimestamp = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();
  if (isToday) {
    return date.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleDateString("pt-PT", { day: "2-digit", month: "short" });
};

type CommunitySegment = "feed" | "mensagens";

export default function ComunidadeTabScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ secao?: string | string[] }>();
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const topPadding = useTopHeaderPadding(14);
  const topBar = useTopBarScroll({ hideOnScroll: false });
  const tabBarPadding = useTabBarPadding();
  const { session } = useAuth();

  const secaoParamRaw = Array.isArray(params.secao) ? params.secao[0] : params.secao;
  const [segment, setSegment] = useState<CommunitySegment>(
    secaoParamRaw === "mensagens" ? "mensagens" : "feed",
  );

  useEffect(() => {
    const next = secaoParamRaw === "mensagens" ? "mensagens" : "feed";
    setSegment(next);
  }, [secaoParamRaw]);

  const feedEnabled = isFocused && segment === "feed";
  const messagesEnabled = isFocused && segment === "mensagens";

  const socialQuery = useSocialFeed(10, feedEnabled);
  const { data: ipLocation } = useIpLocation(feedEnabled);
  const userLat = ipLocation?.approxLatLon?.lat ?? null;
  const userLon = ipLocation?.approxLatLon?.lon ?? null;

  const accessToken = session?.access_token ?? null;
  const inboxQuery = useMessagesInbox(Boolean(session?.user?.id) && messagesEnabled, accessToken);
  const requestsQuery = useMessageRequests(
    Boolean(session?.user?.id) && messagesEnabled,
    accessToken,
    session?.user?.id,
  );
  const communityInvitesQuery = useMessageCommunityInvites(
    Boolean(session?.user?.id) && messagesEnabled,
    accessToken,
    session?.user?.id,
  );

  const feedItems = useMemo(
    () => socialQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [socialQuery.data?.pages],
  );

  const inboxItems = useMemo(() => {
    const list = inboxQuery.data?.items ?? [];
    return [...list].sort((a, b) => {
      const aUnread = (a.unreadCount ?? 0) > 0 ? 1 : 0;
      const bUnread = (b.unreadCount ?? 0) > 0 ? 1 : 0;
      if (aUnread !== bUnread) return bUnread - aUnread;
      const aTime = new Date(a.lastMessageAt ?? a.lastMessage?.createdAt ?? 0).getTime();
      const bTime = new Date(b.lastMessageAt ?? b.lastMessage?.createdAt ?? 0).getTime();
      return bTime - aTime;
    });
  }, [inboxQuery.data?.items]);

  const pendingRequests = useMemo(
    () => (requestsQuery.data?.items ?? []).filter((item) => item.status === "PENDING").length,
    [requestsQuery.data?.items],
  );
  const pendingCommunityInvites = useMemo(
    () => (communityInvitesQuery.data?.items ?? []).filter((item) => item.status === "PENDING").length,
    [communityInvitesQuery.data?.items],
  );
  const requestsCount = pendingRequests + pendingCommunityInvites;

  const unreadCount = useMemo(
    () => inboxItems.reduce((sum, item) => sum + Math.max(0, item.unreadCount ?? 0), 0),
    [inboxItems],
  );

  return (
    <LiquidBackground>
      <TopAppHeader
        scrollState={topBar}
        variant="title"
        title="Comunidade"
        titleAlign="center"
        showNotifications
        showMessages={false}
      />
      <ScrollView
        contentContainerStyle={{
          paddingTop: topPadding,
          paddingBottom: Math.max(tabBarPadding, insets.bottom + 16),
          paddingHorizontal: 20,
          gap: 12,
        }}
        onScroll={topBar.onScroll}
        onScrollEndDrag={topBar.onScrollEndDrag}
        onMomentumScrollEnd={topBar.onMomentumScrollEnd}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-row gap-2">
          <Pressable
            onPress={() => setSegment("feed")}
            className="flex-1 rounded-2xl px-3 py-2.5"
            style={{
              minHeight: tokens.layout.touchTarget,
              borderWidth: 1,
              borderColor: segment === "feed" ? "rgba(190,235,255,0.58)" : "rgba(255,255,255,0.18)",
              backgroundColor: segment === "feed" ? "rgba(120,210,255,0.2)" : "rgba(255,255,255,0.06)",
            }}
            accessibilityRole="button"
            accessibilityLabel="Feed"
            accessibilityState={{ selected: segment === "feed" }}
          >
            <Text className="text-white text-xs font-semibold text-center">Feed</Text>
          </Pressable>
          <Pressable
            onPress={() => setSegment("mensagens")}
            className="flex-1 rounded-2xl px-3 py-2.5"
            style={{
              minHeight: tokens.layout.touchTarget,
              borderWidth: 1,
              borderColor: segment === "mensagens" ? "rgba(190,235,255,0.58)" : "rgba(255,255,255,0.18)",
              backgroundColor: segment === "mensagens" ? "rgba(120,210,255,0.2)" : "rgba(255,255,255,0.06)",
            }}
            accessibilityRole="button"
            accessibilityLabel="Mensagens"
            accessibilityState={{ selected: segment === "mensagens" }}
          >
            <View className="flex-row items-center justify-center gap-1.5">
              <Text className="text-white text-xs font-semibold">Mensagens</Text>
              {unreadCount > 0 ? (
                <View className="rounded-full border border-cyan-100/45 bg-cyan-200/20 px-1.5 py-0.5">
                  <Text className="text-cyan-50 text-[10px] font-semibold">{unreadCount > 99 ? "99+" : unreadCount}</Text>
                </View>
              ) : null}
            </View>
          </Pressable>
        </View>

        {segment === "feed" ? (
          <View className="gap-3">
            {socialQuery.isLoading ? (
              <View className="py-6">
                <ActivityIndicator color="rgba(255,255,255,0.9)" />
              </View>
            ) : socialQuery.isError ? (
              <View className="rounded-2xl border border-rose-200/30 bg-rose-400/10 px-4 py-3">
                <Text className="text-rose-100 text-sm">Não foi possível carregar o feed.</Text>
                <Pressable
                  onPress={() => socialQuery.refetch()}
                  className="mt-3 self-start rounded-full border border-white/20 bg-white/10 px-3 py-2"
                  style={{ minHeight: tokens.layout.touchTarget }}
                  accessibilityRole="button"
                  accessibilityLabel={t("common:actions.retry")}
                >
                  <Text className="text-white text-xs font-semibold">{t("common:actions.retry")}</Text>
                </Pressable>
              </View>
            ) : feedItems.length === 0 ? (
              <View className="rounded-2xl border border-white/14 bg-white/6 px-4 py-4">
                <Text className="text-white/75 text-sm">Ainda não há atividade da comunidade.</Text>
              </View>
            ) : (
              feedItems.map((item, index) => (
                <SocialFeedCard
                  key={`community-feed-${item.id}`}
                  item={item}
                  index={index}
                  userLat={userLat}
                  userLon={userLon}
                />
              ))
            )}
          </View>
        ) : null}

        {segment === "mensagens" ? (
          <View className="gap-3">
            {!session?.user?.id ? (
              <View className="rounded-2xl border border-white/14 bg-white/6 px-4 py-4">
                <Text className="text-white text-sm font-semibold">Inicia sessão para veres as mensagens.</Text>
                <Pressable
                  onPress={() => safePush(router, { pathname: "/auth", params: { next: "/comunidade?secao=mensagens" } })}
                  className="mt-3 self-start rounded-full bg-white px-3 py-2"
                  style={{ minHeight: tokens.layout.touchTarget }}
                  accessibilityRole="button"
                  accessibilityLabel="Iniciar sessão"
                >
                  <Text className="text-[#0b1014] text-xs font-semibold">Iniciar sessão</Text>
                </Pressable>
              </View>
            ) : inboxQuery.isLoading ? (
              <View className="py-6">
                <ActivityIndicator color="rgba(255,255,255,0.9)" />
              </View>
            ) : inboxItems.length === 0 ? (
              <View className="rounded-2xl border border-white/14 bg-white/6 px-4 py-4">
                <Text className="text-white/75 text-sm">Ainda não tens conversas ativas.</Text>
              </View>
            ) : (
              inboxItems.slice(0, 8).map((item) => (
                <Pressable
                  key={`community-inbox-${item.id}`}
                  onPress={() => {
                    if (!item.conversationId) return;
                    safePush(router, {
                      pathname: "/comunidade/mensagens/[threadId]",
                      params: { threadId: item.conversationId, source: "conversation" },
                    });
                  }}
                  className="rounded-2xl border border-white/12 bg-white/6 px-4 py-3"
                  accessibilityRole="button"
                  accessibilityLabel={item.title ?? t("messages:thread.conversationTitleFallback")}
                >
                  <View className="flex-row items-start justify-between gap-2">
                    <Text className="text-white text-sm font-semibold" numberOfLines={1} style={{ flex: 1 }}>
                      {item.title ?? t("messages:thread.conversationTitleFallback")}
                    </Text>
                    <Text className="text-white/55 text-[11px]">{formatTimestamp(item.lastMessageAt ?? item.lastMessage?.createdAt)}</Text>
                  </View>
                  <Text className="mt-1 text-white/70 text-xs" numberOfLines={1}>
                    {item.lastMessage?.body?.trim() || t("messages:lastMessageEmpty")}
                  </Text>
                  {(item.unreadCount ?? 0) > 0 ? (
                    <View className="mt-2 self-start rounded-full border border-cyan-100/40 bg-cyan-200/20 px-2 py-1">
                      <Text className="text-cyan-50 text-[10px] font-semibold">{item.unreadCount} novas</Text>
                    </View>
                  ) : null}
                </Pressable>
              ))
            )}

            <View className="flex-row gap-2">
              <Pressable
                onPress={() => safePush(router, "/comunidade/mensagens")}
                className="flex-1 rounded-xl border border-white/20 bg-white/10 px-3 py-2"
                style={{ minHeight: tokens.layout.touchTarget }}
                accessibilityRole="button"
                accessibilityLabel="Abrir inbox completo"
              >
                <Text className="text-white text-xs font-semibold text-center">Abrir inbox completo</Text>
              </Pressable>
              <Pressable
                onPress={() => safePush(router, "/comunidade/mensagens/pedidos")}
                className="flex-1 rounded-xl border border-white/20 bg-white/10 px-3 py-2"
                style={{ minHeight: tokens.layout.touchTarget }}
                accessibilityRole="button"
                accessibilityLabel="Ver pedidos"
              >
                <Text className="text-white text-xs font-semibold text-center">
                  Pedidos{requestsCount > 0 ? ` (${requestsCount})` : ""}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </ScrollView>
    </LiquidBackground>
  );
}
