import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, Text, View, Platform, Linking } from "react-native";
import { LiquidBackground } from "../../components/liquid/LiquidBackground";
import { TopAppHeader } from "../../components/navigation/TopAppHeader";
import { useTopHeaderPadding } from "../../components/navigation/useTopHeaderPadding";
import { useTabBarPadding } from "../../components/navigation/useTabBarPadding";
import { GlassCard } from "../../components/liquid/GlassCard";
import { GlassSkeleton } from "../../components/glass/GlassSkeleton";
import { BlurView } from "expo-blur";
import { tokens } from "@orya/shared";
import { useRouter } from "expo-router";
import { useAuth } from "../../lib/auth";
import { useNotificationsFeed, notificationsKeys } from "../../features/notifications/hooks";
import type { NotificationItem, NotificationsStatus, NotificationsPage } from "../../features/notifications/types";
import { markAllNotificationsRead, markNotificationRead } from "../../features/notifications/api";
import { useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { openNotificationLink } from "../../lib/notifications";
import { getPushPermissionStatus, registerForPushToken, requestPushPermission } from "../../lib/push";
import { api } from "../../lib/api";

const statusOptions: Array<{ key: NotificationsStatus; label: string }> = [
  { key: "all", label: "Todas" },
  { key: "unread", label: "Não lidas" },
];

type ListItem =
  | { kind: "skeleton"; key: string }
  | { kind: "notification"; item: NotificationItem };

export default function NotificationsScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const accessToken = session?.access_token ?? null;
  const topPadding = useTopHeaderPadding(24);
  const bottomPadding = useTabBarPadding();
  const queryClient = useQueryClient();

  const [status, setStatus] = useState<NotificationsStatus>("all");
  const [pushStatus, setPushStatus] = useState<"granted" | "denied" | "undetermined" | "unavailable">("undetermined");
  const [pushBusy, setPushBusy] = useState(false);

  const feed = useNotificationsFeed(status, Boolean(session?.user?.id));

  const items = useMemo(
    () => feed.data?.pages.flatMap((page) => page.items) ?? [],
    [feed.data?.pages],
  );

  const showSkeleton = feed.isLoading && items.length === 0;

  const listData: ListItem[] = useMemo(
    () =>
      showSkeleton
        ? Array.from({ length: 4 }, (_, index) => ({
            kind: "skeleton",
            key: `notification-skeleton-${index}`,
          }))
        : items.map((item) => ({ kind: "notification", item })),
    [items, showSkeleton],
  );

  const refreshPermissionStatus = useCallback(() => {
    getPushPermissionStatus()
      .then((result) => setPushStatus(result.status))
      .catch(() => undefined);
  }, []);

  const handleEnablePush = useCallback(async () => {
    if (!session?.user?.id) {
      router.push("/auth");
      return;
    }
    setPushBusy(true);
    try {
      const result = await requestPushPermission();
      setPushStatus(result.status);
      if (result.granted && accessToken) {
        const token = await registerForPushToken();
        if (token) {
          await api.requestWithAccessToken("/api/me/push-tokens", accessToken, {
            method: "POST",
            body: JSON.stringify({ token, platform: "ios" }),
          });
        }
      }
    } finally {
      setPushBusy(false);
    }
  }, [accessToken, router, session?.user?.id]);

  const handleOpenSettings = useCallback(() => {
    Linking.openSettings().catch(() => undefined);
  }, []);

  const markReadOptimistic = useCallback(
    (notificationId: string) => {
      const updateData = (
        data: InfiniteData<NotificationsPage> | undefined,
        removeFromUnread: boolean,
      ) => {
        if (!data) return data;
        return {
          ...data,
          pages: data.pages.map((page) => ({
            ...page,
            items: page.items
              .filter((item) => !removeFromUnread || item.id !== notificationId)
              .map((item) => (item.id === notificationId ? { ...item, isRead: true } : item)),
          })),
        } as InfiniteData<NotificationsPage>;
      };

      queryClient.setQueriesData(
        { queryKey: notificationsKeys.feed("all") },
        (data) => updateData(data as InfiniteData<NotificationsPage> | undefined, false),
      );
      queryClient.setQueriesData(
        { queryKey: notificationsKeys.feed("unread") },
        (data) => updateData(data as InfiniteData<NotificationsPage> | undefined, true),
      );
    },
    [queryClient],
  );

  const handlePressNotification = useCallback(
    async (item: NotificationItem) => {
      const link =
        (typeof item.ctaUrl === "string" && item.ctaUrl) ||
        (typeof item.payload?.ctaUrl === "string" && item.payload.ctaUrl) ||
        null;
      await openNotificationLink(router, link);

      if (!item.isRead && item.id) {
        markReadOptimistic(item.id);
        markNotificationRead(item.id)
          .then(() => {
            queryClient.invalidateQueries({ queryKey: notificationsKeys.all });
          })
          .catch(() => {
            queryClient.invalidateQueries({ queryKey: notificationsKeys.all });
          });
      }
    },
    [markReadOptimistic, queryClient, router],
  );

  const handleMarkAllRead = useCallback(async () => {
    await markAllNotificationsRead();
    queryClient.invalidateQueries({ queryKey: notificationsKeys.all });
  }, [queryClient]);

  const formatDate = useCallback((value?: string | null) => {
    if (!value) return "";
    try {
      return new Intl.DateTimeFormat("pt-PT", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(value));
    } catch {
      return "";
    }
  }, []);

  const keyExtractor = useCallback((item: ListItem) => (item.kind === "skeleton" ? item.key : item.item.id), []);

  const renderItem = useCallback(
    ({ item }: { item: ListItem }) => {
      if (item.kind === "skeleton") {
        return <GlassSkeleton className="mb-3" height={84} />;
      }
      const notification = item.item;
      const title = notification.title || "Notificação";
      const body = notification.body || "";
      const isUnread = !notification.isRead;
      return (
        <Pressable
          className="mb-3"
          onPress={() => handlePressNotification(notification)}
        >
          <GlassCard intensity={58} padding={14} highlight={isUnread}>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <View style={{ flex: 1, gap: 4 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  {isUnread ? <View style={styles.unreadDot} /> : null}
                  <Text style={styles.title} numberOfLines={1}>
                    {title}
                  </Text>
                </View>
                {body ? (
                  <Text style={styles.body} numberOfLines={2}>
                    {body}
                  </Text>
                ) : null}
                {notification.createdAt ? (
                  <Text style={styles.timestamp}>{formatDate(notification.createdAt)}</Text>
                ) : null}
              </View>
            </View>
          </GlassCard>
        </Pressable>
      );
    },
    [formatDate, handlePressNotification],
  );

  const emptyState = !session?.user?.id ? (
    <GlassCard intensity={55}>
      <Text style={styles.emptyTitle}>Inicia sessão</Text>
      <Text style={styles.emptyText}>Entra na tua conta para veres as notificações.</Text>
      <Pressable
        onPress={() => router.push("/auth")}
        className="mt-4 rounded-2xl bg-white/90 px-4 py-3"
        style={{ minHeight: tokens.layout.touchTarget }}
      >
        <Text style={styles.emptyCta}>Entrar</Text>
      </Pressable>
    </GlassCard>
  ) : feed.isError ? (
    <GlassCard intensity={55}>
      <Text style={styles.errorText}>Não foi possível carregar as notificações.</Text>
      <Pressable
        onPress={() => feed.refetch()}
        className="rounded-2xl bg-white/10 px-4 py-3"
        style={{ minHeight: tokens.layout.touchTarget }}
      >
        <Text style={styles.retryText}>Tentar novamente</Text>
      </Pressable>
    </GlassCard>
  ) : (
    <GlassCard intensity={50}>
      <Text style={styles.emptyText}>Sem notificações para mostrar.</Text>
    </GlassCard>
  );

  useEffect(() => {
    refreshPermissionStatus();
  }, [refreshPermissionStatus]);

  const renderHeader = useMemo(() => (
    <View style={{ paddingBottom: 16 }}>
      <Text style={styles.screenTitle}>Notificações</Text>
      <Text style={styles.screenSubtitle}>Atualizações importantes e alertas personalizados.</Text>
      <View style={styles.segmentRow}>
        {statusOptions.map((option) => {
          const active = option.key === status;
          return (
            <Pressable
              key={option.key}
              onPress={() => setStatus(option.key)}
              style={{ minHeight: tokens.layout.touchTarget }}
              className="overflow-hidden rounded-full border border-white/10"
            >
              <BlurView
                tint="dark"
                intensity={active ? 80 : 35}
                style={{
                  paddingHorizontal: tokens.spacing.lg,
                  justifyContent: "center",
                  minHeight: tokens.layout.touchTarget,
                  backgroundColor: active ? tokens.colors.glassStrong : tokens.colors.surface,
                }}
              >
                <Text style={active ? styles.segmentLabelActive : styles.segmentLabel}>{option.label}</Text>
              </BlurView>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.actionRow}>
        <Pressable
          onPress={handleMarkAllRead}
          disabled={!session?.user?.id || items.length === 0}
          style={({ pressed }) => [styles.markAllButton, pressed && styles.markAllPressed]}
        >
          <Text style={styles.markAllText}>Marcar tudo como lido</Text>
        </Pressable>
        {pushStatus === "granted" ? (
          <View style={styles.pushStatus}>
            <Text style={styles.pushStatusText}>Push ativas</Text>
          </View>
        ) : pushStatus === "denied" ? (
          <Pressable
            onPress={handleOpenSettings}
            style={({ pressed }) => [styles.pushButton, pressed && styles.markAllPressed]}
          >
            <Text style={styles.pushButtonText}>Abrir definições</Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={handleEnablePush}
            disabled={pushBusy}
            style={({ pressed }) => [styles.pushButton, pressed && styles.markAllPressed]}
          >
            {pushBusy ? (
              <ActivityIndicator color="rgba(255,255,255,0.8)" />
            ) : (
              <Text style={styles.pushButtonText}>Ativar push</Text>
            )}
          </Pressable>
        )}
      </View>
    </View>
  ), [handleEnablePush, handleMarkAllRead, handleOpenSettings, items.length, pushBusy, pushStatus, session?.user?.id, status]);

  return (
    <LiquidBackground>
      <TopAppHeader />
      <FlatList
        contentContainerStyle={{
          paddingTop: topPadding,
          paddingBottom: bottomPadding,
          paddingHorizontal: 20,
        }}
        data={listData}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        onRefresh={() => feed.refetch()}
        refreshing={feed.isFetching}
        removeClippedSubviews={Platform.OS === "android"}
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        updateCellsBatchingPeriod={40}
        windowSize={5}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={emptyState}
        onEndReached={() => {
          if (feed.hasNextPage && !feed.isFetchingNextPage) {
            feed.fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.4}
      />
    </LiquidBackground>
  );
}

const styles = {
  screenTitle: {
    color: "white",
    fontSize: 20,
    fontWeight: "700",
  } as const,
  screenSubtitle: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 13,
    marginTop: 4,
  } as const,
  segmentRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  } as const,
  segmentLabel: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 13,
    fontWeight: "600",
  } as const,
  segmentLabelActive: {
    color: "white",
    fontSize: 13,
    fontWeight: "700",
  } as const,
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 16,
    alignItems: "center",
  } as const,
  markAllButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "rgba(255,255,255,0.06)",
  } as const,
  markAllPressed: {
    opacity: 0.8,
  } as const,
  markAllText: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 12,
    fontWeight: "600",
  } as const,
  pushButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.24)",
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "rgba(255,255,255,0.12)",
  } as const,
  pushButtonText: {
    color: "white",
    fontSize: 12,
    fontWeight: "700",
  } as const,
  pushStatus: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "rgba(76, 217, 100, 0.2)",
    borderWidth: 1,
    borderColor: "rgba(76, 217, 100, 0.5)",
  } as const,
  pushStatusText: {
    color: "rgba(210,255,220,0.95)",
    fontSize: 12,
    fontWeight: "700",
  } as const,
  title: {
    color: "white",
    fontSize: 14,
    fontWeight: "700",
  } as const,
  body: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
  } as const,
  timestamp: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 11,
    marginTop: 4,
  } as const,
  unreadDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#4cd964",
  } as const,
  emptyTitle: {
    color: "white",
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 8,
  } as const,
  emptyText: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 13,
  } as const,
  emptyCta: {
    color: "#0b101a",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  } as const,
  errorText: {
    color: "rgba(255,160,160,0.9)",
    fontSize: 13,
    marginBottom: 10,
  } as const,
  retryText: {
    color: "white",
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
  } as const,
};
