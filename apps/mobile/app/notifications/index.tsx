import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { useFocusEffect } from "@react-navigation/native";
import { usePathname, useRouter } from "expo-router";
import { useQueryClient, type InfiniteData } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { tokens } from "@orya/shared";
import { LiquidBackground } from "../../components/liquid/LiquidBackground";
import { TopAppHeader } from "../../components/navigation/TopAppHeader";
import { useTopHeaderPadding } from "../../components/navigation/useTopHeaderPadding";
import { useTabBarPadding } from "../../components/navigation/useTabBarPadding";
import { GlassCard } from "../../components/liquid/GlassCard";
import { GlassSkeleton } from "../../components/glass/GlassSkeleton";
import { Ionicons } from "../../components/icons/Ionicons";
import { AvatarCircle } from "../../components/avatar/AvatarCircle";
import { useAuth } from "../../lib/auth";
import { useNotificationsFeed, notificationsKeys } from "../../features/notifications/hooks";
import type {
  AggregatedNotificationItem,
  NotificationAction,
  NotificationsPage,
} from "../../features/notifications/types";
import {
  markAllNotificationsRead,
  markNotificationRead,
  muteNotificationTarget,
  respondOrganizationInvite,
} from "../../features/notifications/api";
import { acceptFollowRequest, declineFollowRequest, followUser, unfollowUser } from "../../features/network/api";
import { acceptInvite as acceptPairingInvite, declineInvite as declinePairingInvite } from "../../features/tournaments/api";
import { openNotificationLink, resolveNotificationLink } from "../../lib/notifications";

type ListItem =
  | { kind: "skeleton"; key: string }
  | { kind: "section"; key: string; label: string }
  | { kind: "notification"; item: AggregatedNotificationItem };

type BucketKey = "today" | "yesterday" | "week" | "older";

const BUCKET_ORDER: BucketKey[] = ["today", "yesterday", "week", "older"];

const BUCKET_LABELS: Record<BucketKey, string> = {
  today: "Hoje",
  yesterday: "Ontem",
  week: "Esta semana",
  older: "Mais antiga",
};

const CATEGORY_LABELS: Record<AggregatedNotificationItem["category"], string> = {
  network: "Rede",
  events: "Eventos",
  system: "Sistema",
  marketing: "Marketing",
};

const CATEGORY_ICONS: Record<AggregatedNotificationItem["category"], string> = {
  network: "people",
  events: "calendar",
  system: "notifications",
  marketing: "sparkles",
};

const formatRelativeTime = (iso?: string | null): string => {
  if (!iso) return "";
  const timestamp = new Date(iso).getTime();
  if (!Number.isFinite(timestamp)) return "";
  const diffSeconds = Math.floor((Date.now() - timestamp) / 1000);
  if (diffSeconds < 60) return "agora";
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `há ${diffMinutes} min`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `há ${diffHours} h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `há ${diffDays} d`;
  return new Intl.DateTimeFormat("pt-PT", { day: "2-digit", month: "short" }).format(new Date(timestamp));
};

const getBucketKey = (iso?: string | null): BucketKey => {
  if (!iso) return "older";
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "older";
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const diffDays = Math.round((startOfToday - startOfDate) / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return "week";
  return "older";
};

const buildKey = (itemId: string, action: NotificationAction) => `${itemId}:${action.type}`;

const AvatarStack = ({
  actors,
  actorCount,
  onPress,
}: {
  actors: AggregatedNotificationItem["actors"];
  actorCount: number;
  onPress?: () => void;
}) => {
  const size = 42;
  const overlap = 14;
  const ringColor = "rgba(10,14,24,0.95)";
  const visible = actors.slice(0, 3);
  const width = visible.length > 0 ? size + (visible.length - 1) * (size - overlap) : size;

  const Wrapper: React.ElementType = onPress ? Pressable : View;

  return (
    <Wrapper
      onPress={(event: any) => {
        event?.stopPropagation?.();
        onPress?.();
      }}
      style={[styles.avatarStack, { width, height: size }]}
    >
      {visible.length === 0 ? (
        <AvatarCircle size={size} iconName="person" borderColor={ringColor} borderWidth={2} />
      ) : null}
      {visible.map((actor, index) => (
        <AvatarCircle
          key={`${actor.id}-${index}`}
          size={size}
          uri={actor.avatarUrl ?? null}
          borderColor={ringColor}
          borderWidth={2}
          style={{
            marginLeft: index === 0 ? 0 : -overlap,
            zIndex: 10 - index,
          }}
        />
      ))}
    </Wrapper>
  );
};

const NotificationThumbnail = ({ url, category }: { url?: string | null; category: AggregatedNotificationItem["category"] }) => {
  if (url) {
    return (
      <View style={styles.thumbnail}>
        <Image
          source={{ uri: url }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={140}
        />
      </View>
    );
  }

  return (
    <View style={[styles.thumbnail, styles.thumbnailFallback]}>
      <Ionicons name={CATEGORY_ICONS[category] as any} size={18} color="rgba(255,255,255,0.75)" />
    </View>
  );
};

export default function NotificationsScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const topPadding = useTopHeaderPadding(20);
  const bottomPadding = useTabBarPadding();

  const [pendingActionKey, setPendingActionKey] = useState<string | null>(null);
  const [followOverrides, setFollowOverrides] = useState<Record<string, boolean>>({});
  const [notificationStatus, setNotificationStatus] = useState<Record<string, "Aceite" | "Recusado">>({});
  const lastMarkedRef = useRef<number | null>(null);

  const feed = useNotificationsFeed(Boolean(session?.user?.id));

  const items = useMemo(
    () => feed.data?.pages.flatMap((page) => page.items) ?? [],
    [feed.data?.pages],
  );

  const showSkeleton = feed.isLoading && items.length === 0;

  const listData: ListItem[] = useMemo(() => {
    if (showSkeleton) {
      return Array.from({ length: 4 }, (_, index) => ({
        kind: "skeleton",
        key: `notification-skeleton-${index}`,
      }));
    }

    const bucketed: Record<BucketKey, AggregatedNotificationItem[]> = {
      today: [],
      yesterday: [],
      week: [],
      older: [],
    };

    for (const item of items) {
      bucketed[getBucketKey(item.createdAt)].push(item);
    }

    const result: ListItem[] = [];

    for (const bucket of BUCKET_ORDER) {
      const bucketItems = bucketed[bucket];
      if (!bucketItems.length) continue;
      result.push({ kind: "section", key: `section-${bucket}`, label: BUCKET_LABELS[bucket] });
      bucketItems.forEach((item) => result.push({ kind: "notification", item }));
    }

    return result;
  }, [items, showSkeleton]);

  const updateCacheItems = useCallback(
    (
      updater: (item: AggregatedNotificationItem) => AggregatedNotificationItem,
      shouldUpdate?: (item: AggregatedNotificationItem) => boolean,
    ) => {
      const update = (data: InfiniteData<NotificationsPage> | undefined) => {
        if (!data) return data;
        return {
          ...data,
          pages: data.pages.map((page) => ({
            ...page,
            items: page.items.map((item) => (shouldUpdate && !shouldUpdate(item) ? item : updater(item))),
          })),
        } as InfiniteData<NotificationsPage>;
      };

      queryClient.setQueriesData({ queryKey: notificationsKeys.feed() }, (data) =>
        update(data as InfiniteData<NotificationsPage> | undefined),
      );
    },
    [queryClient],
  );

  const filterCacheItems = useCallback(
    (predicate: (item: AggregatedNotificationItem) => boolean) => {
      const update = (data: InfiniteData<NotificationsPage> | undefined) => {
        if (!data) return data;
        return {
          ...data,
          pages: data.pages.map((page) => ({
            ...page,
            items: page.items.filter(predicate),
          })),
        } as InfiniteData<NotificationsPage>;
      };

      queryClient.setQueriesData({ queryKey: notificationsKeys.feed() }, (data) =>
        update(data as InfiniteData<NotificationsPage> | undefined),
      );
    },
    [queryClient],
  );

  const markTabReadOptimistic = useCallback(() => {
    updateCacheItems((item) => ({ ...item, isRead: true }));
  }, [updateCacheItems]);

  const markItemReadOptimistic = useCallback(
    (notificationId: string) => {
      updateCacheItems((item) => (item.id === notificationId ? { ...item, isRead: true } : item));
    },
    [updateCacheItems],
  );

  const setFollowOverride = useCallback((userId: string, isFollowing: boolean) => {
    setFollowOverrides((prev) => ({ ...prev, [userId]: isFollowing }));
  }, []);

  const setNotificationStatusLabel = useCallback(
    (item: AggregatedNotificationItem, statusLabel: "Aceite" | "Recusado") => {
      setNotificationStatus((prev) => ({ ...prev, [item.id]: statusLabel }));
      const statusBody =
        item.type === "FOLLOW_REQUEST"
          ? `Pedido ${statusLabel.toLowerCase()}.`
          : `Convite ${statusLabel.toLowerCase()}.`;
      updateCacheItems(
        (current) =>
          current.id === item.id
            ? {
                ...current,
                body: statusBody,
              }
            : current,
      );
    },
    [updateCacheItems],
  );

  const removeMutedFromCache = useCallback(
    (params: { organizationId?: number | null; eventId?: number | null }) => {
      filterCacheItems((item) => {
        if (params.organizationId && item.organizationId === params.organizationId) return false;
        if (params.eventId && item.eventId === params.eventId) return false;
        return true;
      });
    },
    [filterCacheItems],
  );

  const handleMarkTabRead = useCallback(async () => {
    if (!session?.user?.id) return;
    const now = Date.now();
    if (lastMarkedRef.current && now - lastMarkedRef.current < 5000) {
      return;
    }
    lastMarkedRef.current = now;

    markTabReadOptimistic();
    try {
      await markAllNotificationsRead();
    } catch {
      // ignore
    } finally {
      queryClient.invalidateQueries({ queryKey: notificationsKeys.all });
      queryClient.invalidateQueries({ queryKey: notificationsKeys.unread() });
    }
  }, [markTabReadOptimistic, queryClient, session?.user?.id]);

  const handlePressNotification = useCallback(
    async (item: AggregatedNotificationItem) => {
      if (item.ctaUrl) {
        const resolved = resolveNotificationLink(item.ctaUrl);
        if (resolved.kind === "native") {
          const targetPath = resolved.path.split("?")[0];
          if (targetPath && targetPath !== pathname) {
            router.push(resolved.path);
          }
        } else if (resolved.kind === "web") {
          await openNotificationLink(router, item.ctaUrl);
        }
      }

      if (!item.isRead) {
        markItemReadOptimistic(item.id);
        markNotificationRead(item.id).catch(() => {
          queryClient.invalidateQueries({ queryKey: notificationsKeys.all });
        });
      }
    },
    [markItemReadOptimistic, pathname, queryClient, router],
  );

  const handleMute = useCallback(
    (item: AggregatedNotificationItem) => {
      if (!item.organizationId && !item.eventId) return;

      const options = [] as Array<{ text: string; onPress?: () => void; style?: "destructive" | "cancel" }>;

      if (item.organizationId) {
        options.push({
          text: "Silenciar organização",
          style: "destructive",
          onPress: async () => {
            try {
              await muteNotificationTarget({ organizationId: item.organizationId });
              removeMutedFromCache({ organizationId: item.organizationId });
              queryClient.invalidateQueries({ queryKey: notificationsKeys.all });
              queryClient.invalidateQueries({ queryKey: notificationsKeys.unread() });
              try {
                await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              } catch {
                // ignore
              }
            } catch {
              Alert.alert("Não foi possível", "Tenta novamente.");
            }
          },
        });
      }

      if (item.eventId) {
        options.push({
          text: "Silenciar evento",
          style: "destructive",
          onPress: async () => {
            try {
              await muteNotificationTarget({ eventId: item.eventId });
              removeMutedFromCache({ eventId: item.eventId });
              queryClient.invalidateQueries({ queryKey: notificationsKeys.all });
              queryClient.invalidateQueries({ queryKey: notificationsKeys.unread() });
              try {
                await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              } catch {
                // ignore
              }
            } catch {
              Alert.alert("Não foi possível", "Tenta novamente.");
            }
          },
        });
      }

      options.push({ text: "Cancelar", style: "cancel" });

      Alert.alert("Silenciar notificações", "Não vais receber notificações deste contexto.", options);
    },
    [queryClient, removeMutedFromCache],
  );

  const handleAction = useCallback(
    async (item: AggregatedNotificationItem, action: NotificationAction) => {
      if (action.type === "status" || action.style === "status") {
        return;
      }
      const key = buildKey(item.id, action);
      if (pendingActionKey === key) return;
      setPendingActionKey(key);

      try {
        if (action.type === "accept_follow") {
          const requestId = Number(action.payload?.requestId);
          if (Number.isFinite(requestId)) {
            await acceptFollowRequest(requestId);
            setNotificationStatusLabel(item, "Aceite");
          }
        } else if (action.type === "decline_follow") {
          const requestId = Number(action.payload?.requestId);
          if (Number.isFinite(requestId)) {
            await declineFollowRequest(requestId);
            setNotificationStatusLabel(item, "Recusado");
          }
        } else if (action.type === "follow_back") {
          const userId = typeof action.payload?.userId === "string" ? action.payload.userId : null;
          if (userId) {
            const isFollowing = followOverrides[userId] === true;
            if (isFollowing) {
              await unfollowUser(userId);
              setFollowOverride(userId, false);
            } else {
              await followUser(userId);
              setFollowOverride(userId, true);
            }
          }
        } else if (action.type === "accept_org_invite") {
          const inviteId = typeof action.payload?.inviteId === "string" ? action.payload.inviteId : null;
          if (inviteId) {
            await respondOrganizationInvite(inviteId, "ACCEPT");
            setNotificationStatusLabel(item, "Aceite");
          }
        } else if (action.type === "decline_org_invite") {
          const inviteId = typeof action.payload?.inviteId === "string" ? action.payload.inviteId : null;
          if (inviteId) {
            await respondOrganizationInvite(inviteId, "DECLINE");
            setNotificationStatusLabel(item, "Recusado");
          }
        } else if (action.type === "accept_pairing_invite") {
          const pairingId = Number(action.payload?.pairingId);
          if (Number.isFinite(pairingId)) {
            await acceptPairingInvite(pairingId);
            setNotificationStatusLabel(item, "Aceite");
          }
        } else if (action.type === "decline_pairing_invite") {
          const pairingId = Number(action.payload?.pairingId);
          if (Number.isFinite(pairingId)) {
            await declinePairingInvite(pairingId);
            setNotificationStatusLabel(item, "Recusado");
          }
        } else if (action.type === "open") {
          const url = typeof action.payload?.url === "string" ? action.payload.url : null;
          if (url) {
            const resolved = resolveNotificationLink(url);
            if (resolved.kind === "native") {
              const targetPath = resolved.path.split("?")[0];
              if (targetPath && targetPath !== pathname) {
                router.push(resolved.path);
              }
            } else if (resolved.kind === "web") {
              await openNotificationLink(router, url);
            }
          }
        }

        markItemReadOptimistic(item.id);
        queryClient.invalidateQueries({ queryKey: notificationsKeys.all });
        queryClient.invalidateQueries({ queryKey: notificationsKeys.unread() });
        try {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch {
          // ignore
        }
      } catch (err) {
        Alert.alert("Não foi possível", "Tenta novamente.");
      } finally {
        setPendingActionKey(null);
      }
    },
    [followOverrides, markItemReadOptimistic, pathname, pendingActionKey, queryClient, router, setFollowOverride, setNotificationStatusLabel],
  );

  useFocusEffect(
    useCallback(() => {
      handleMarkTabRead();
    }, [handleMarkTabRead]),
  );

  useEffect(() => {
    handleMarkTabRead();
  }, [handleMarkTabRead]);

  const renderItem = useCallback(
    ({ item }: { item: ListItem }) => {
      if (item.kind === "skeleton") {
        return <GlassSkeleton className="mb-3" height={96} />;
      }
      if (item.kind === "section") {
        return (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>{item.label}</Text>
          </View>
        );
      }

      const notification = item.item;
      const timeLabel = formatRelativeTime(notification.createdAt);
      const categoryLabel = CATEGORY_LABELS[notification.category];
      const metaLabel = [timeLabel, categoryLabel].filter(Boolean).join(" · ");
      const showActions = Boolean(notification.actions && notification.actions.length > 0);
      const primaryActor = notification.actors[0];
      const handleAvatarPress = primaryActor?.username
        ? () => {
            router.push(`/${primaryActor.username}`);
          }
        : undefined;

      return (
        <Pressable
          onPress={() => handlePressNotification(notification)}
          onLongPress={() => handleMute(notification)}
          delayLongPress={240}
          style={styles.cardPressable}
        >
          <GlassCard intensity={60} padding={14} highlight={!notification.isRead}>
            <View style={styles.cardRow}>
              <AvatarStack
                actors={notification.actors}
                actorCount={notification.actorCount}
                onPress={handleAvatarPress}
              />
              <View style={styles.cardContent}>
                <Text style={styles.message} numberOfLines={2}>
                  <Text style={styles.messageActor}>{notification.title}</Text>
                  {notification.body ? <Text style={styles.messageBody}> {notification.body}</Text> : null}
                </Text>
                {showActions ? (
                  <View style={styles.actionsRow}>
                    {notification.actions?.map((action) => {
                      const key = buildKey(notification.id, action);
                      const isPending = pendingActionKey === key;
                      const statusLabel = notificationStatus[notification.id];
                      if (statusLabel) {
                        return (
                          <View key={`${key}-status`} style={[styles.actionButton, styles.actionStatus]}>
                            <Text style={[styles.actionText, styles.actionTextStatus]}>{statusLabel}</Text>
                          </View>
                        );
                      }
                      const isStatus = action.type === "status" || action.style === "status";
                      const followUserId = typeof action.payload?.userId === "string" ? action.payload.userId : null;
                      const isFollowing = followUserId ? followOverrides[followUserId] === true : false;
                      const isFollowAction = action.type === "follow_back" && Boolean(followUserId);
                      const resolvedLabel = isFollowAction ? (isFollowing ? "A seguir" : action.label) : action.label;
                      const isPrimary = !isStatus && (isFollowAction ? !isFollowing : action.style === "primary");
                      return (
                        <Pressable
                          key={key}
                          onPress={(event) => {
                            event.stopPropagation?.();
                            handleAction(notification, action);
                          }}
                          disabled={isPending || isStatus}
                          style={({ pressed }) => [
                            styles.actionButton,
                            isStatus
                              ? styles.actionStatus
                              : isPrimary
                                ? styles.actionPrimary
                                : styles.actionSecondary,
                            pressed && styles.actionPressed,
                            isPending && styles.actionDisabled,
                          ]}
                        >
                        <Text
                          style={[
                            styles.actionText,
                            isStatus
                              ? styles.actionTextStatus
                              : isPrimary
                                ? styles.actionTextPrimary
                                : styles.actionTextSecondary,
                          ]}
                        >
                          {resolvedLabel}
                        </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                ) : null}
                {metaLabel ? <Text style={styles.metaText}>{metaLabel}</Text> : null}
              </View>
              <NotificationThumbnail url={notification.thumbnailUrl} category={notification.category} />
              {!notification.isRead ? <View style={styles.unreadDot} /> : null}
            </View>
          </GlassCard>
        </Pressable>
      );
    },
    [followOverrides, handleAction, handleMute, handlePressNotification, notificationStatus, pendingActionKey],
  );

  const emptyState = !session?.user?.id ? (
    <GlassCard intensity={55} style={styles.emptyCard}>
      <Ionicons name="person" size={22} color="rgba(255,255,255,0.85)" />
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
    <GlassCard intensity={55} style={styles.emptyCard}>
      <Ionicons name="alert-circle" size={22} color="rgba(255,160,160,0.9)" />
      <Text style={styles.emptyTitle}>Não foi possível carregar</Text>
      <Text style={styles.emptyText}>Verifica a ligação e tenta novamente.</Text>
      <Pressable
        onPress={() => feed.refetch()}
        className="mt-4 rounded-2xl bg-white/10 px-4 py-3"
        style={{ minHeight: tokens.layout.touchTarget }}
      >
        <Text style={styles.retryText}>Tentar novamente</Text>
      </Pressable>
    </GlassCard>
  ) : (
    <GlassCard intensity={50} style={styles.emptyCard}>
      <Ionicons name="checkmark-circle" size={22} color="rgba(148,214,255,0.9)" />
      <Text style={styles.emptyTitle}>Tudo em dia</Text>
      <Text style={styles.emptyText}>Sem notificações para mostrar.</Text>
    </GlassCard>
  );

  const header = (
    <View style={{ paddingTop: topPadding, paddingBottom: 12 }}>
      <View style={styles.headerRow}>
        <Text style={styles.screenTitle}>Notificações</Text>
        <Pressable onPress={() => router.push("/settings")} style={styles.settingsButton}>
          <Text style={styles.settingsText}>Preferências</Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <LiquidBackground>
      <TopAppHeader />
      <FlatList
        data={listData}
        keyExtractor={(item) =>
          item.kind === "section" || item.kind === "skeleton"
            ? item.key
            : `${item.kind}-${item.item.id}`
        }
        renderItem={renderItem}
        ListHeaderComponent={header}
        ListEmptyComponent={emptyState}
        ListFooterComponent={
          feed.isFetchingNextPage ? (
            <View style={styles.footerLoading}>
              <ActivityIndicator color="rgba(255,255,255,0.75)" />
            </View>
          ) : null
        }
        onEndReached={() => {
          if (feed.hasNextPage && !feed.isFetchingNextPage) {
            feed.fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.4}
        refreshing={feed.isRefetching}
        onRefresh={() => feed.refetch()}
        contentContainerStyle={{
          paddingHorizontal: tokens.spacing.lg,
          paddingBottom: bottomPadding + 32,
        }}
      />
    </LiquidBackground>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "rgba(245,250,255,0.98)",
  },
  settingsButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  settingsText: {
    color: "rgba(220,235,255,0.9)",
    fontSize: 12,
    fontWeight: "600",
  },
  sectionHeader: {
    marginTop: 12,
    marginBottom: 8,
  },
  sectionLabel: {
    color: "rgba(210,220,235,0.75)",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  cardPressable: {
    marginBottom: 12,
  },
  cardRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  avatarStack: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatarShell: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.08)",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  avatarMore: {
    width: 30,
    height: 30,
    borderRadius: 999,
    marginLeft: -12,
    backgroundColor: "rgba(10,14,24,0.95)",
    borderWidth: 2,
    borderColor: "rgba(10,14,24,0.95)",
  },
  avatarMoreText: {
    color: "rgba(255,255,255,0.88)",
    fontSize: 11,
    fontWeight: "700",
  },
  cardContent: {
    flex: 1,
    gap: 8,
  },
  message: {
    color: "rgba(235,245,255,0.92)",
    fontSize: 13,
    lineHeight: 18,
  },
  messageActor: {
    fontWeight: "700",
    color: "rgba(245,250,255,0.98)",
  },
  messageBody: {
    color: "rgba(215,225,240,0.8)",
    fontWeight: "500",
  },
  metaText: {
    color: "rgba(185,200,220,0.55)",
    fontSize: 10,
    alignSelf: "flex-end",
    marginTop: 2,
  },
  actionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  actionButton: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    overflow: "hidden",
    minHeight: 36,
    justifyContent: "center",
  },
  actionPrimary: {
    backgroundColor: "#3897F0",
    borderColor: "#3897F0",
    shadowColor: "#3897F0",
    shadowOpacity: 0.28,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  actionSecondary: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderColor: "rgba(255,255,255,0.18)",
  },
  actionStatus: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderColor: "rgba(255,255,255,0.18)",
  },
  actionPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.9,
  },
  actionDisabled: {
    opacity: 0.6,
  },
  actionText: {
    fontSize: 12,
    fontWeight: "600",
  },
  actionTextPrimary: {
    color: "#ffffff",
  },
  actionTextSecondary: {
    color: "rgba(235,245,255,0.9)",
  },
  actionTextStatus: {
    color: "rgba(235,245,255,0.8)",
  },
  thumbnail: {
    width: 62,
    height: 62,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  thumbnailFallback: {
    backgroundColor: "rgba(255,255,255,0.05)",
    alignItems: "center",
    justifyContent: "center",
  },
  unreadDot: {
    position: "absolute",
    right: 10,
    top: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#6BFFFF",
  },
  emptyCard: {
    alignItems: "center",
    gap: 10,
    paddingVertical: 18,
  },
  emptyTitle: {
    color: "rgba(245,250,255,0.95)",
    fontSize: 16,
    fontWeight: "700",
  },
  emptyText: {
    color: "rgba(210,220,235,0.7)",
    fontSize: 12,
    textAlign: "center",
  },
  emptyCta: {
    color: "rgba(10,12,18,0.9)",
    fontSize: 12,
    fontWeight: "700",
  },
  retryText: {
    color: "rgba(245,250,255,0.9)",
    fontSize: 12,
    fontWeight: "600",
  },
  footerLoading: {
    paddingVertical: 24,
    alignItems: "center",
  },
});
