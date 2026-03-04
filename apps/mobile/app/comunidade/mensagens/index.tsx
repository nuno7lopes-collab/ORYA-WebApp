import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { useEffect, useMemo, useState } from "react";
import { safePush } from "../../../lib/navigation";
import { LiquidBackground } from "../../../components/liquid/LiquidBackground";
import { TopAppHeader } from "../../../components/navigation/TopAppHeader";
import { useTopHeaderPadding } from "../../../components/navigation/useTopHeaderPadding";
import { useTopBarScroll } from "../../../components/navigation/useTopBarScroll";
import { Ionicons } from "../../../components/icons/Ionicons";
import { tokens, useTranslation } from "@orya/shared";
import { useRouter } from "expo-router";
import { useAuth } from "../../../lib/auth";
import {
  useMessagesInbox,
  useMessageRequests,
  useMessageCommunityInvites,
} from "../../../features/messages/hooks";
import { createMessageRequest } from "../../../features/messages/api";
import { GlassCard } from "../../../components/liquid/GlassCard";
import { GlassSkeleton } from "../../../components/glass/GlassSkeleton";
import { useTabBarPadding } from "../../../components/navigation/useTabBarPadding";
import { SafeFlashList } from "../../../components/lists/SafeFlashList";
import { formatDate } from "../../../lib/formatters";
import { useIsFocused } from "@react-navigation/native";
import { AvatarCircle } from "../../../components/avatar/AvatarCircle";
import type { InboxItem } from "../../../features/messages/types";
import { useNetworkSuggestions } from "../../../features/network/hooks";
import { searchOrganizations, searchUsers } from "../../../features/search/api";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getUserFacingError } from "../../../lib/errors";
import type { SearchOrganization, SearchUser } from "../../../features/search/types";
import { useFocusFrameMonitor } from "../../../components/perf/useFocusFrameMonitor";

const formatInboxTimestamp = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const sameDay =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();
  if (sameDay) {
    return formatDate(date, { hour: "2-digit", minute: "2-digit" });
  }
  return formatDate(date, { day: "2-digit", month: "short" });
};

const resolveConversationContextLabel = (item: InboxItem) => {
  if (item.kind === "EVENT") return "Evento";
  if (item.contextType === "ORG_COMMUNITY") return "Comunidade";
  if (item.contextType === "ORG_CHANNEL") return "Canal";
  if (item.contextType === "USER_GROUP") return "Grupo";
  if (item.contextType === "ORG_CONTACT") return "Organização";
  return "Conversa";
};

type ComposerTab = "users" | "orgs";

export default function MessagesTabScreen() {
  const { t } = useTranslation();
  const topPadding = useTopHeaderPadding(24);
  const tabBarPadding = useTabBarPadding();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const isCompactWidth = screenWidth < 360;
  const horizontalGutter = isCompactWidth ? 14 : 20;
  const topBar = useTopBarScroll({ hideOnScroll: false });
  useFocusFrameMonitor("screen_messages");
  const router = useRouter();
  const openAuth = () => {
    safePush(router, { pathname: "/auth", params: { next: "/comunidade/mensagens" } });
  };
  const { session } = useAuth();
  const isFocused = useIsFocused();
  const accessToken = session?.access_token ?? null;
  const inboxQuery = useMessagesInbox(Boolean(session?.user?.id) && isFocused, accessToken);
  const requestsQuery = useMessageRequests(
    Boolean(session?.user?.id) && isFocused,
    accessToken,
    session?.user?.id,
  );
  const communityInvitesQuery = useMessageCommunityInvites(
    Boolean(session?.user?.id) && isFocused,
    accessToken,
    session?.user?.id,
  );
  const items = inboxQuery.data?.items ?? [];
  const requestItems = requestsQuery.data?.items ?? [];
  const communityInviteItems = communityInvitesQuery.data?.items ?? [];
  const pendingRequests = useMemo(
    () => requestItems.filter((item) => item.status === "PENDING"),
    [requestItems],
  );
  const pendingCommunityInvites = useMemo(
    () => communityInviteItems.filter((item) => item.status === "PENDING"),
    [communityInviteItems],
  );
  const requestsCount = pendingRequests.length + pendingCommunityInvites.length;
  const sortedItems = useMemo(
    () =>
      [...items].sort((a, b) => {
        const aUnread = (a.unreadCount ?? 0) > 0 ? 1 : 0;
        const bUnread = (b.unreadCount ?? 0) > 0 ? 1 : 0;
        if (aUnread !== bUnread) return bUnread - aUnread;
        const aTime = new Date(a.lastMessageAt ?? a.lastMessage?.createdAt ?? 0).getTime();
        const bTime = new Date(b.lastMessageAt ?? b.lastMessage?.createdAt ?? 0).getTime();
        return bTime - aTime;
      }),
    [items],
  );
  const unreadTotal = useMemo(
    () => sortedItems.reduce((sum, item) => sum + Math.max(0, item.unreadCount ?? 0), 0),
    [sortedItems],
  );
  const [now, setNow] = useState(0);
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerTab, setComposerTab] = useState<ComposerTab>("users");
  const [composerQuery, setComposerQuery] = useState("");
  const [pendingComposerKey, setPendingComposerKey] = useState<string | null>(null);
  const normalizedComposerQuery = composerQuery.trim();
  const hasComposerQuery = normalizedComposerQuery.length >= 2;

  useEffect(() => {
    setNow(Date.now());
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!composerOpen) {
      setComposerQuery("");
      setComposerTab("users");
      setPendingComposerKey(null);
    }
  }, [composerOpen]);

  const suggestionsQuery = useNetworkSuggestions(composerOpen && Boolean(session?.user?.id));
  const userSearchQuery = useQuery({
    queryKey: ["messages", "composer", "users", normalizedComposerQuery, accessToken ?? "anon"],
    queryFn: () => searchUsers(normalizedComposerQuery),
    enabled: composerOpen && composerTab === "users" && hasComposerQuery && Boolean(session?.user?.id),
    staleTime: 45_000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
  const orgSearchQuery = useQuery({
    queryKey: ["messages", "composer", "orgs", normalizedComposerQuery, accessToken ?? "anon"],
    queryFn: () => searchOrganizations(normalizedComposerQuery),
    enabled: composerOpen && composerTab === "orgs" && hasComposerQuery && Boolean(session?.user?.id),
    staleTime: 45_000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const suggestedUsers = useMemo<SearchUser[]>(
    () =>
      (suggestionsQuery.data ?? [])
        .filter((item) => item.id !== session?.user?.id)
        .map((item) => ({
          id: item.id,
          username: item.username,
          fullName: item.fullName,
          avatarUrl: item.avatarUrl,
        })),
    [session?.user?.id, suggestionsQuery.data],
  );
  const composerUsers = useMemo(
    () =>
      (hasComposerQuery ? userSearchQuery.data ?? [] : suggestedUsers).filter(
        (user) => user.id !== session?.user?.id,
      ),
    [hasComposerQuery, session?.user?.id, suggestedUsers, userSearchQuery.data],
  );
  const composerOrgs = hasComposerQuery ? orgSearchQuery.data ?? [] : [];
  const usersLoading = hasComposerQuery ? userSearchQuery.isLoading : suggestionsQuery.isLoading;
  const usersError = hasComposerQuery ? userSearchQuery.isError : suggestionsQuery.isError;

  const closeComposer = () => setComposerOpen(false);

  const handleStartUserMessage = async (user: SearchUser) => {
    if (!user.id) return;
    if (!accessToken || !session?.user?.id) {
      closeComposer();
      openAuth();
      return;
    }
    const key = `user:${user.id}`;
    if (pendingComposerKey) return;
    setPendingComposerKey(key);
    try {
      const response = await createMessageRequest({ targetUserId: user.id }, accessToken);
      closeComposer();
      await Promise.all([inboxQuery.refetch(), requestsQuery.refetch()]);
      if (response.conversationId) {
        safePush(router, {
          pathname: "/comunidade/mensagens/[threadId]",
          params: { threadId: response.conversationId, source: "conversation" },
        });
      } else {
        Alert.alert(
          t("messages:composer.requestSentTitle"),
          t("messages:composer.requestSentBody"),
        );
      }
    } catch (err) {
      Alert.alert(
        t("messages:composer.errorTitle"),
        getUserFacingError(err, t("messages:composer.errorBody")),
      );
    } finally {
      setPendingComposerKey(null);
    }
  };

  const handleStartOrgMessage = async (organization: SearchOrganization) => {
    if (!organization.id) return;
    if (!accessToken || !session?.user?.id) {
      closeComposer();
      openAuth();
      return;
    }
    const key = `org:${organization.id}`;
    if (pendingComposerKey) return;
    setPendingComposerKey(key);
    try {
      const response = await createMessageRequest({ targetOrganizationId: organization.id }, accessToken);
      closeComposer();
      await Promise.all([inboxQuery.refetch(), requestsQuery.refetch()]);
      if (response.conversationId) {
        safePush(router, {
          pathname: "/comunidade/mensagens/[threadId]",
          params: { threadId: response.conversationId, source: "conversation" },
        });
      } else {
        Alert.alert(
          t("messages:composer.requestSentTitle"),
          t("messages:composer.requestSentBody"),
        );
      }
    } catch (err) {
      Alert.alert(
        t("messages:composer.errorTitle"),
        getUserFacingError(err, t("messages:composer.errorBody")),
      );
    } finally {
      setPendingComposerKey(null);
    }
  };

  const resolveStatusLabel = (status?: string | null) => {
    if (status === "OPEN") return t("messages:status.open");
    if (status === "ANNOUNCEMENTS") return t("messages:status.announcements");
    if (status === "READ_ONLY") return t("messages:status.readOnly");
    return t("messages:status.closed");
  };

  const openThread = (item: InboxItem) => {
    const isEvent = item.kind === "EVENT";
    if (isEvent && item.conversationId && item.event) {
      safePush(router, {
        pathname: "/comunidade/mensagens/[threadId]",
        params: {
          threadId: item.conversationId,
          eventId: String(item.event.id),
          title: item.title,
          coverImageUrl: item.imageUrl ?? "",
          startsAt: item.event.startsAt ?? "",
          endsAt: item.event.endsAt ?? "",
          slug: item.event.slug ?? "",
          source: "event",
        },
      });
      return;
    }
    if (item.conversationId) {
      safePush(router, {
        pathname: "/comunidade/mensagens/[threadId]",
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
    <LiquidBackground>
      <TopAppHeader
        scrollState={topBar}
        variant="title"
        title={t("messages:title")}
        titleAlign="center"
        rightSlotMode="append"
        rightSlot={
          session?.user?.id ? (
            <Pressable
              onPress={() => setComposerOpen(true)}
              accessibilityRole="button"
              accessibilityLabel={t("messages:composer.open")}
              className="h-10 w-10 items-center justify-center rounded-full border border-white/12 bg-white/8"
              style={{ minHeight: tokens.layout.touchTarget, minWidth: tokens.layout.touchTarget }}
            >
              <Ionicons name="create-outline" size={18} color="rgba(255,255,255,0.94)" />
            </Pressable>
          ) : null
        }
        showNotifications={false}
        showMessages={false}
      />
      <SafeFlashList
        contentContainerStyle={{
          paddingTop: topPadding,
          paddingBottom: tabBarPadding,
          paddingHorizontal: horizontalGutter,
        }}
        onScroll={topBar.onScroll}
        onScrollEndDrag={topBar.onScrollEndDrag}
        onMomentumScrollEnd={topBar.onMomentumScrollEnd}
        scrollEventThrottle={16}
        data={sortedItems}
        keyExtractor={(item) => item.id}
        onRefresh={() => {
          if (session?.user?.id) {
            inboxQuery.refetch();
            requestsQuery.refetch();
            communityInvitesQuery.refetch();
          }
        }}
        refreshing={Boolean(session?.user?.id) && inboxQuery.isFetching}
        ListHeaderComponent={
          <View className="pb-4 gap-3">
            <Text className="text-white/90 text-sm">{t("messages:subtitle")}</Text>
            {session?.user?.id ? (
              <GlassCard intensity={46} padding={10}>
                <Pressable
                  onPress={() => safePush(router, "/comunidade/mensagens/pedidos")}
                  className="rounded-2xl px-2 py-2"
                  style={{ minHeight: tokens.layout.touchTarget }}
                  accessibilityRole="button"
                  accessibilityLabel={t("messages:requests")}
                >
                  <View className="flex-row items-center gap-3">
                    <View className="h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/14">
                      <Ionicons name="mail-unread-outline" size={18} color="rgba(255,255,255,0.9)" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text className="text-white text-sm font-semibold">{t("messages:requests")}</Text>
                      <Text className="text-white/90 text-xs">
                        {requestsCount > 0
                          ? t("messages:requestsWithCount", { count: requestsCount })
                          : t("messages:requestsHint")}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.58)" />
                  </View>
                </Pressable>

                <View
                  style={{
                    height: 1,
                    backgroundColor: "rgba(255,255,255,0.08)",
                    marginTop: 8,
                    marginBottom: 8,
                  }}
                />

                <View className="rounded-2xl px-2 py-2">
                  <View className="flex-row items-center gap-3">
                    <View className="h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/14">
                      <Ionicons
                        name={unreadTotal > 0 ? "chatbubble-ellipses" : "chatbubble-ellipses-outline"}
                        size={18}
                        color={unreadTotal > 0 ? "rgba(125,211,252,0.95)" : "rgba(255,255,255,0.75)"}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text className="text-white text-sm font-semibold">{t("messages:title")}</Text>
                      <Text className="text-white/90 text-xs">
                        {unreadTotal > 0
                          ? t("messages:inboxStatus.newMessages", { count: unreadTotal })
                          : t("messages:inboxStatus.noNewMessages")}
                      </Text>
                    </View>
                    {unreadTotal > 0 ? (
                      <View className="min-w-[24px] rounded-full bg-sky-300 px-2 py-0.5">
                        <Text className="text-center text-[11px] font-bold text-slate-900">
                          {unreadTotal > 99 ? "99+" : unreadTotal}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              </GlassCard>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          !session?.user?.id ? (
            <GlassCard intensity={55}>
              <Text className="text-white text-sm font-semibold mb-2">
                {t("messages:signin.title")}
              </Text>
              <Text className="text-white/82 text-sm">{t("messages:signin.body")}</Text>
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
            <GlassCard intensity={50} padding={16}>
              <View className="flex-row items-center gap-2">
                <Ionicons name="mail-outline" size={16} color="rgba(255,255,255,0.78)" />
                <Text className="text-white text-sm font-semibold">{t("messages:empty.noConversations")}</Text>
              </View>
              <Text className="mt-2 text-white/80 text-sm">{t("messages:empty.newMessagesHint")}</Text>
            </GlassCard>
          )
        }
        renderItem={({ item }) => {
          const isEvent = item.kind === "EVENT";
          const lastMessage = item.lastMessage;
          const unreadCount = Math.max(0, item.unreadCount ?? 0);
          const isMuted =
            Boolean(item.mutedUntil) && new Date(item.mutedUntil ?? "").getTime() > now;
          const timestamp = formatInboxTimestamp(item.lastMessageAt ?? item.lastMessage?.createdAt ?? null);
          const contextLabel = resolveConversationContextLabel(item);
          const contextStyle =
            item.contextType === "ORG_COMMUNITY"
              ? {
                  borderColor: "rgba(125,211,252,0.4)",
                  backgroundColor: "rgba(56,189,248,0.16)",
                  color: "rgba(224,242,254,0.95)",
                }
              : {
                  borderColor: "rgba(255,255,255,0.24)",
                  backgroundColor: "rgba(255,255,255,0.1)",
                  color: "rgba(255,255,255,0.9)",
                };
          return (
            <Pressable
              onPress={() => openThread(item)}
              className="mb-3"
              accessibilityRole="button"
              accessibilityLabel={`${t("common:actions.open")} ${item.title}`}
            >
              <GlassCard intensity={58} padding={12}>
                <View className="flex-row items-center gap-3">
                  <AvatarCircle
                    size={54}
                    uri={item.imageUrl ?? null}
                    iconName={isEvent ? "calendar-outline" : "person-outline"}
                    iconColor="rgba(255,255,255,0.68)"
                    borderColor="rgba(255,255,255,0.12)"
                    backgroundColor="rgba(255,255,255,0.08)"
                  />

                  <View style={{ flex: 1, gap: 4 }}>
                    <View className="flex-row items-center gap-2">
                      <Text
                        className={unreadCount > 0 ? "text-white text-sm font-semibold" : "text-white/90 text-sm font-semibold"}
                        numberOfLines={1}
                        style={{ flex: 1 }}
                      >
                        {item.title}
                      </Text>
                      {timestamp ? (
                        <Text className="text-white/85 text-[11px]">{timestamp}</Text>
                      ) : null}
                    </View>

                    <View className="flex-row items-center gap-2">
                      <View
                        style={{
                          borderWidth: 1,
                          borderRadius: 999,
                          paddingHorizontal: 8,
                          paddingVertical: 2,
                          borderColor: contextStyle.borderColor,
                          backgroundColor: contextStyle.backgroundColor,
                        }}
                      >
                        <Text
                          className="text-[10px] font-semibold uppercase tracking-[0.08em]"
                          style={{ color: contextStyle.color }}
                        >
                          {contextLabel}
                        </Text>
                      </View>
                    </View>

                    {isEvent && (item.event?.startsAt || item.subtitle) ? (
                      <Text className="text-white/88 text-xs" numberOfLines={1}>
                        {item.event?.startsAt
                          ? formatDate(item.event.startsAt, { day: "2-digit", month: "short" })
                          : null}
                        {item.event?.startsAt && item.subtitle ? " · " : null}
                        {item.subtitle ?? null}
                      </Text>
                    ) : item.subtitle ? (
                      <Text className="text-white/88 text-xs" numberOfLines={1}>
                        {item.subtitle}
                      </Text>
                    ) : null}

                    <Text
                      className={unreadCount > 0 ? "text-white text-xs font-medium" : "text-white/90 text-xs"}
                      numberOfLines={1}
                    >
                      {lastMessage?.body ?? t("messages:lastMessageEmpty")}
                    </Text>
                  </View>

                  <View className="items-end justify-center gap-2">
                    {unreadCount > 0 ? (
                      <View className="min-w-[24px] rounded-full bg-sky-300 px-2 py-0.5">
                        <Text className="text-center text-[11px] font-bold text-slate-900">
                          {unreadCount > 99 ? "99+" : unreadCount}
                        </Text>
                      </View>
                    ) : isEvent ? (
                      <Text className="text-[10px] uppercase tracking-[0.14em] text-white/85">
                        {resolveStatusLabel(item.status)}
                      </Text>
                    ) : null}

                    {isMuted ? (
                      <Text className="text-[10px] uppercase tracking-[0.14em] text-white/85">
                        {t("messages:thread.muted")}
                      </Text>
                    ) : null}
                  </View>
                </View>

                {isEvent ? (
                  <View className="mt-2 flex-row items-center gap-2">
                    <Ionicons name="sparkles-outline" size={12} color="rgba(125,211,252,0.85)" />
                    <Text className="text-[10px] uppercase tracking-[0.14em] text-sky-100/85">
                      {t("messages:status.open")}
                    </Text>
                  </View>
                ) : null}
              </GlassCard>
            </Pressable>
          );
        }}
        estimatedItemSize={98}
        removeClippedSubviews
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        updateCellsBatchingPeriod={16}
        windowSize={5}
      />

      <Modal
        visible={composerOpen}
        transparent
        animationType="fade"
        onRequestClose={closeComposer}
      >
        <Pressable
          onPress={closeComposer}
          style={{
            flex: 1,
            backgroundColor: "rgba(4,8,14,0.72)",
            justifyContent: "flex-end",
          }}
        >
          <Pressable
            onPress={(event) => event.stopPropagation()}
            style={{
              borderTopLeftRadius: 26,
              borderTopRightRadius: 26,
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.12)",
              backgroundColor: "rgba(12,18,30,0.96)",
              paddingHorizontal: isCompactWidth ? 14 : 18,
              paddingTop: 14,
              paddingBottom: Math.max(insets.bottom, 12) + 10,
              maxHeight: isCompactWidth ? "86%" : "78%",
            }}
          >
            <View className="mb-3 items-center">
              <View className="h-1.5 w-12 rounded-full bg-white/18" />
            </View>

            <View className="mb-3 flex-row items-center justify-between">
              <Text className="text-white text-lg font-semibold">{t("messages:composer.title")}</Text>
              <Pressable
                onPress={closeComposer}
                accessibilityRole="button"
                accessibilityLabel={t("common:actions.close")}
                className="h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-white/14"
              >
                <Ionicons name="close" size={16} color="rgba(255,255,255,0.9)" />
              </Pressable>
            </View>

            <View className="mb-3 flex-row rounded-2xl border border-white/12 bg-white/6 p-1">
              <Pressable
                onPress={() => setComposerTab("users")}
                className={composerTab === "users" ? "flex-1 rounded-xl bg-white/92 px-3 py-2.5" : "flex-1 rounded-xl px-3 py-2.5"}
                accessibilityRole="button"
                accessibilityState={{ selected: composerTab === "users" }}
                accessibilityLabel={t("messages:composer.tabs.users")}
              >
                <Text className={composerTab === "users" ? "text-center text-xs font-semibold text-slate-900" : "text-center text-xs font-semibold text-white/92"}>
                  {t("messages:composer.tabs.users")}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setComposerTab("orgs")}
                className={composerTab === "orgs" ? "flex-1 rounded-xl bg-white/92 px-3 py-2.5" : "flex-1 rounded-xl px-3 py-2.5"}
                accessibilityRole="button"
                accessibilityState={{ selected: composerTab === "orgs" }}
                accessibilityLabel={t("messages:composer.tabs.orgs")}
              >
                <Text className={composerTab === "orgs" ? "text-center text-xs font-semibold text-slate-900" : "text-center text-xs font-semibold text-white/92"}>
                  {t("messages:composer.tabs.orgs")}
                </Text>
              </Pressable>
            </View>

            <View className="mb-3 rounded-2xl border border-white/20 bg-white/14 px-3">
              <TextInput
                value={composerQuery}
                onChangeText={setComposerQuery}
                placeholder={
                  composerTab === "users"
                    ? t("messages:composer.searchUsersPlaceholder")
                    : t("messages:composer.searchOrgsPlaceholder")
                }
                placeholderTextColor="rgba(255,255,255,0.62)"
                autoCapitalize="none"
                autoCorrect={false}
                className="h-11 text-white"
                accessibilityLabel={t("messages:composer.searchInput")}
                returnKeyType="search"
              />
            </View>

            {composerTab === "users" && !hasComposerQuery ? (
              <Text className="mb-2 text-white/75 text-xs">
                {t("messages:composer.suggestionsTitle")}
              </Text>
            ) : null}

            <ScrollView
              style={{ flexGrow: 0 }}
              contentContainerStyle={{ paddingBottom: 6, gap: 8 }}
              keyboardShouldPersistTaps="handled"
            >
              {pendingComposerKey ? (
                <View className="mb-1 flex-row items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3 py-2">
                  <ActivityIndicator size="small" color="rgba(255,255,255,0.9)" />
                  <Text className="text-[11px] text-white/92">{t("common:actions.loading")}</Text>
                </View>
              ) : null}
              {composerTab === "users" ? (
                usersLoading ? (
                  <View className="py-4">
                    <ActivityIndicator color="rgba(255,255,255,0.8)" />
                  </View>
                ) : usersError ? (
                  <GlassCard intensity={55} padding={14}>
                    <Text className="text-red-300 text-sm mb-2">{t("messages:composer.loadError")}</Text>
                    <Pressable
                      onPress={() => {
                        if (hasComposerQuery) userSearchQuery.refetch();
                        else suggestionsQuery.refetch();
                      }}
                      className="rounded-2xl bg-white/12 px-4 py-2.5"
                      accessibilityRole="button"
                      accessibilityLabel={t("common:actions.retry")}
                    >
                      <Text className="text-white text-center text-sm font-semibold">
                        {t("common:actions.retry")}
                      </Text>
                    </Pressable>
                  </GlassCard>
                ) : composerUsers.length === 0 ? (
                  <GlassCard intensity={55} padding={14}>
                    <Text className="text-white/88 text-sm">{t("messages:composer.emptyUsers")}</Text>
                  </GlassCard>
                ) : (
                  composerUsers.map((user) => {
                    const itemKey = `user:${user.id}`;
                    const itemBusy = pendingComposerKey === itemKey;
                    const displayName = user.fullName?.trim() || (user.username ? `@${user.username}` : t("messages:requestsScreen.userFallback"));
                    const subtitle = user.username ? `@${user.username}` : t("messages:composer.userNoHandle");
                    return (
                      <GlassCard key={itemKey} intensity={58} padding={12}>
                        <View className={isCompactWidth ? "gap-3" : "flex-row items-center gap-3"}>
                          <View className="flex-row items-center gap-3" style={{ flex: 1 }}>
                            <AvatarCircle
                              size={44}
                              uri={user.avatarUrl ?? null}
                              iconName="person-outline"
                              iconColor="rgba(255,255,255,0.7)"
                              borderColor="rgba(255,255,255,0.12)"
                              backgroundColor="rgba(255,255,255,0.08)"
                            />
                            <View style={{ flex: 1 }}>
                              <Text className="text-white text-sm font-semibold" numberOfLines={1}>
                                {displayName}
                              </Text>
                              <Text className="text-white/78 text-xs" numberOfLines={1}>
                                {subtitle}
                              </Text>
                            </View>
                          </View>
                          <Pressable
                            onPress={() => handleStartUserMessage(user)}
                            disabled={Boolean(pendingComposerKey)}
                            className="rounded-xl bg-white/90 px-3 py-2"
                            style={{
                              minHeight: tokens.layout.touchTarget,
                              justifyContent: "center",
                              alignSelf: isCompactWidth ? "stretch" : "center",
                            }}
                            accessibilityRole="button"
                            accessibilityLabel={t("messages:composer.startMessage")}
                          >
                            <Text className="text-center text-xs font-semibold text-slate-900">
                              {itemBusy ? t("common:actions.sending") : t("messages:composer.startMessage")}
                            </Text>
                          </Pressable>
                        </View>
                      </GlassCard>
                    );
                  })
                )
              ) : orgSearchQuery.isLoading ? (
                <View className="py-4">
                  <ActivityIndicator color="rgba(255,255,255,0.8)" />
                </View>
              ) : orgSearchQuery.isError ? (
                <GlassCard intensity={55} padding={14}>
                  <Text className="text-red-300 text-sm mb-2">{t("messages:composer.loadError")}</Text>
                  <Pressable
                    onPress={() => orgSearchQuery.refetch()}
                    className="rounded-2xl bg-white/12 px-4 py-2.5"
                    accessibilityRole="button"
                    accessibilityLabel={t("common:actions.retry")}
                  >
                    <Text className="text-white text-center text-sm font-semibold">
                      {t("common:actions.retry")}
                    </Text>
                  </Pressable>
                </GlassCard>
              ) : !hasComposerQuery ? (
                <GlassCard intensity={55} padding={14}>
                  <Text className="text-white/88 text-sm">{t("messages:composer.searchOrgsHint")}</Text>
                </GlassCard>
              ) : composerOrgs.length === 0 ? (
                <GlassCard intensity={55} padding={14}>
                  <Text className="text-white/88 text-sm">{t("messages:composer.emptyOrgs")}</Text>
                </GlassCard>
              ) : (
                composerOrgs.map((org) => {
                  const itemKey = `org:${org.id}`;
                  const itemBusy = pendingComposerKey === itemKey;
                  const displayName = org.publicName || org.businessName || org.username || t("messages:composer.orgFallback");
                  const subtitle = org.username ? `@${org.username}` : t("messages:composer.orgNoHandle");
                  return (
                    <GlassCard key={itemKey} intensity={58} padding={12}>
                      <View className={isCompactWidth ? "gap-3" : "flex-row items-center gap-3"}>
                        <View className="flex-row items-center gap-3" style={{ flex: 1 }}>
                          <AvatarCircle
                            size={44}
                            uri={org.brandingAvatarUrl ?? null}
                            iconName="business-outline"
                            iconColor="rgba(255,255,255,0.7)"
                            borderColor="rgba(255,255,255,0.12)"
                            backgroundColor="rgba(255,255,255,0.08)"
                          />
                          <View style={{ flex: 1 }}>
                            <Text className="text-white text-sm font-semibold" numberOfLines={1}>
                              {displayName}
                            </Text>
                            <Text className="text-white/78 text-xs" numberOfLines={1}>
                              {subtitle}
                            </Text>
                          </View>
                        </View>
                        <Pressable
                          onPress={() => handleStartOrgMessage(org)}
                          disabled={Boolean(pendingComposerKey)}
                          className="rounded-xl bg-white/90 px-3 py-2"
                          style={{
                            minHeight: tokens.layout.touchTarget,
                            justifyContent: "center",
                            alignSelf: isCompactWidth ? "stretch" : "center",
                          }}
                          accessibilityRole="button"
                          accessibilityLabel={t("messages:composer.startMessage")}
                        >
                          <Text className="text-center text-xs font-semibold text-slate-900">
                            {itemBusy ? t("common:actions.sending") : t("messages:composer.startMessage")}
                          </Text>
                        </Pressable>
                      </View>
                    </GlassCard>
                  );
                })
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </LiquidBackground>
  );
}
