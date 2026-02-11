import { Pressable, Text, View } from "react-native";
import { useEffect, useState } from "react";
import { LiquidBackground } from "../../components/liquid/LiquidBackground";
import { TopAppHeader } from "../../components/navigation/TopAppHeader";
import { useTopHeaderPadding } from "../../components/navigation/useTopHeaderPadding";
import { useTopBarScroll } from "../../components/navigation/useTopBarScroll";
import { Ionicons } from "../../components/icons/Ionicons";
import { tokens, useTranslation } from "@orya/shared";
import { useRouter } from "expo-router";
import { useAuth } from "../../lib/auth";
import { useMessagesInbox, useMessageRequests } from "../../features/messages/hooks";
import { GlassCard } from "../../components/liquid/GlassCard";
import { GlassSkeleton } from "../../components/glass/GlassSkeleton";
import { Image } from "expo-image";
import { useTabBarPadding } from "../../components/navigation/useTabBarPadding";
import { TopTicketsButton } from "../../components/navigation/TopTicketsButton";
import { SafeFlashList } from "../../components/lists/SafeFlashList";
import { formatDate } from "../../lib/formatters";

export default function MessagesTabScreen() {
  const { t } = useTranslation();
  const topPadding = useTopHeaderPadding(24);
  const tabBarPadding = useTabBarPadding();
  const topBar = useTopBarScroll({ hideOnScroll: false });
  const router = useRouter();
  const openAuth = () => {
    router.push({ pathname: "/auth", params: { next: "/messages" } });
  };
  const { session } = useAuth();
  const accessToken = session?.access_token ?? null;
  const inboxQuery = useMessagesInbox(Boolean(session?.user?.id), accessToken);
  const requestsQuery = useMessageRequests(Boolean(session?.user?.id), accessToken);
  const items = inboxQuery.data?.items ?? [];
  const requestsCount = requestsQuery.data?.items?.length ?? 0;
  const [now, setNow] = useState(0);

  useEffect(() => {
    setNow(Date.now());
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  const resolveStatusLabel = (status?: string | null) => {
    if (status === "OPEN") return t("messages:status.open");
    if (status === "ANNOUNCEMENTS") return t("messages:status.announcements");
    if (status === "READ_ONLY") return t("messages:status.readOnly");
    return t("messages:status.closed");
  };

  return (
    <LiquidBackground>
      <TopAppHeader
        scrollState={topBar}
        variant="title"
        title={t("messages:title")}
        titleAlign="center"
        leftSlot={<TopTicketsButton />}
        showNotifications
        showMessages={false}
      />
      <SafeFlashList
        contentContainerStyle={{
          paddingTop: topPadding,
          paddingBottom: tabBarPadding,
          paddingHorizontal: 20,
        }}
        onScroll={topBar.onScroll}
        onScrollEndDrag={topBar.onScrollEndDrag}
        onMomentumScrollEnd={topBar.onMomentumScrollEnd}
        scrollEventThrottle={16}
        data={items}
        keyExtractor={(item) => item.id}
        onRefresh={() => {
          if (session?.user?.id) {
            inboxQuery.refetch();
            requestsQuery.refetch();
          }
        }}
        refreshing={inboxQuery.isFetching}
        ListHeaderComponent={
          <View className="pb-4">
            <Text className="text-white/60 text-sm">{t("messages:subtitle")}</Text>
            {session?.user?.id ? (
              <Pressable
                onPress={() => router.push("/messages/requests")}
                className="mt-3 rounded-2xl border border-white/15 bg-white/5 px-4 py-3"
                style={{ minHeight: tokens.layout.touchTarget }}
                accessibilityRole="button"
                accessibilityLabel={t("messages:requests")}
              >
                <Text className="text-white text-sm font-semibold text-center">
                  {requestsCount > 0
                    ? t("messages:requestsWithCount", { count: requestsCount })
                    : t("messages:requests")}
                </Text>
              </Pressable>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          !session?.user?.id ? (
            <GlassCard intensity={55}>
              <Text className="text-white text-sm font-semibold mb-2">
                {t("messages:signin.title")}
              </Text>
              <Text className="text-white/65 text-sm">{t("messages:signin.body")}</Text>
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
              <Pressable
                onPress={() => router.push("/(tabs)/index")}
                className="mt-3 rounded-2xl border border-white/15 bg-white/5 px-4 py-3"
                style={{ minHeight: tokens.layout.touchTarget }}
                accessibilityRole="button"
                accessibilityLabel={t("messages:signin.ctaExplore")}
              >
                <Text className="text-center text-sm font-semibold text-white">
                  {t("messages:signin.ctaExplore")}
                </Text>
              </Pressable>
            </GlassCard>
          ) : inboxQuery.isLoading ? (
            <View className="gap-3">
              {Array.from({ length: 3 }, (_, idx) => (
                <GlassSkeleton key={`chat-skel-${idx}`} height={86} />
              ))}
            </View>
          ) : inboxQuery.isError ? (
            <GlassCard intensity={55}>
              <Text className="text-red-300 text-sm mb-2">{t("messages:errors.load")}</Text>
              <Pressable
                onPress={() => inboxQuery.refetch()}
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
            <GlassCard intensity={50}>
              <Text className="text-white/70 text-sm">{t("messages:empty.title")}</Text>
              <Pressable
                onPress={() => router.push("/(tabs)/index")}
                className="mt-4 rounded-2xl border border-white/15 bg-white/5 px-4 py-3"
                style={{ minHeight: tokens.layout.touchTarget }}
                accessibilityRole="button"
                accessibilityLabel={t("messages:empty.ctaExplore")}
              >
                <Text className="text-white text-sm font-semibold text-center">
                  {t("messages:empty.ctaExplore")}
                </Text>
              </Pressable>
            </GlassCard>
          )
        }
        renderItem={({ item }) => {
          const isEvent = item.kind === "EVENT";
          const lastMessage = item.lastMessage;
          const isMuted =
            Boolean(item.mutedUntil) && new Date(item.mutedUntil ?? "").getTime() > now;
          const openThread = () => {
            if (isEvent && item.threadId && item.event) {
              router.push({
                pathname: "/messages/[threadId]",
                params: {
                  threadId: item.threadId,
                  eventId: String(item.event.id),
                  title: item.title,
                  coverImageUrl: item.imageUrl ?? "",
                  startsAt: item.event.startsAt ?? "",
                  endsAt: item.event.endsAt ?? "",
                  source: "event",
                },
              });
              return;
            }
            if (item.conversationId) {
              router.push({
                pathname: "/messages/[threadId]",
                params: {
                  threadId: item.conversationId,
                  title: item.title,
                  coverImageUrl: item.imageUrl ?? "",
                  source: "conversation",
                },
              });
            }
          };
          return (
            <Pressable
              onPress={openThread}
              className="mb-3"
              accessibilityRole="button"
              accessibilityLabel={`${t("common:actions.open")} ${item.title}`}
            >
              <GlassCard intensity={58} padding={14}>
                <View className="flex-row gap-3">
                  <View
                    style={{
                      width: 54,
                      height: 54,
                      borderRadius: 16,
                      overflow: "hidden",
                      backgroundColor: "rgba(255,255,255,0.08)",
                    }}
                  >
                    {item.imageUrl ? (
                      <Image source={{ uri: item.imageUrl }} style={{ width: "100%", height: "100%" }} />
                    ) : (
                      <View className="flex-1 items-center justify-center">
                        <Ionicons
                          name={isEvent ? "calendar-outline" : "chatbubble-ellipses-outline"}
                          size={20}
                          color="rgba(255,255,255,0.6)"
                        />
                      </View>
                    )}
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text className="text-white text-sm font-semibold" numberOfLines={1}>
                      {item.title}
                    </Text>
                    {isEvent && (formatDate(item.event?.startsAt) || item.subtitle) ? (
                      <Text className="text-white/60 text-xs">
                        {item.event?.startsAt ? formatDate(item.event.startsAt, { day: "2-digit", month: "short" }) : null}
                        {item.event?.startsAt && item.subtitle ? " · " : null}
                        {item.subtitle ?? null}
                      </Text>
                    ) : item.subtitle ? (
                      <Text className="text-white/60 text-xs">{item.subtitle}</Text>
                    ) : null}
                    <Text className="text-white/65 text-xs" numberOfLines={1}>
                      {lastMessage?.body ?? t("messages:lastMessageEmpty")}
                    </Text>
                  </View>
                  <View className="items-end justify-between">
                    {isEvent ? (
                      <Text className="text-[11px] uppercase tracking-[0.16em] text-white/45">
                        {resolveStatusLabel(item.status)}
                      </Text>
                    ) : (
                      <Text className="text-[11px] uppercase tracking-[0.16em] text-white/45">
                        {item.unreadCount
                          ? t("messages:unreadCount", { count: item.unreadCount })
                          : t("messages:title")}
                      </Text>
                    )}
                    {isMuted ? (
                      <Text className="text-[10px] uppercase tracking-[0.16em] text-white/35">
                        {t("messages:thread.muted")}
                      </Text>
                    ) : null}
                    <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.6)" />
                  </View>
                </View>
              </GlassCard>
            </Pressable>
          );
        }}
        estimatedItemSize={98}
      />
    </LiquidBackground>
  );
}
