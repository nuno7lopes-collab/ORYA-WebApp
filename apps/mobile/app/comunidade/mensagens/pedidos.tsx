import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { LiquidBackground } from "../../../components/liquid/LiquidBackground";
import { TopAppHeader } from "../../../components/navigation/TopAppHeader";
import { useTopHeaderPadding } from "../../../components/navigation/useTopHeaderPadding";
import { useTopBarScroll } from "../../../components/navigation/useTopBarScroll";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GlassCard } from "../../../components/liquid/GlassCard";
import { GlassSkeleton } from "../../../components/glass/GlassSkeleton";
import { tokens, useTranslation } from "@orya/shared";
import { useAuth } from "../../../lib/auth";
import {
  useMessageRequests,
  useMessageCommunityInvites,
} from "../../../features/messages/hooks";
import {
  acceptMessageRequest,
  acceptCommunityInvite,
  declineCommunityInvite,
  declineMessageRequest,
} from "../../../features/messages/api";
import { Ionicons } from "../../../components/icons/Ionicons";
import { safeBack, safePush } from "../../../lib/navigation";
import { useNavigation } from "@react-navigation/native";
import { AvatarCircle } from "../../../components/avatar/AvatarCircle";
import { formatDate } from "../../../lib/formatters";
import { getUserFacingError } from "../../../lib/errors";

const formatRequestTimestamp = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const sameDay =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();
  if (sameDay) return formatDate(date, { hour: "2-digit", minute: "2-digit" });
  return formatDate(date, { day: "2-digit", month: "short" });
};

const formatRequestExpiry = (value: string | null | undefined) => {
  if (!value) return "Sem validade";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sem validade";
  return `Expira ${formatDate(date, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}`;
};

const formatLastSyncLabel = (value: number) => {
  if (!value || !Number.isFinite(value)) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `Atualizado ${formatDate(date, { hour: "2-digit", minute: "2-digit" })}`;
};

const resolveCommunityAccessLabel = (mode?: string | null) => {
  const normalized = mode?.trim().toUpperCase() ?? "";
  if (normalized === "PUBLIC") return "Pública";
  if (normalized === "FOLLOWERS") return "Seguidores";
  if (normalized === "APPROVAL") return "Aprovação";
  if (normalized === "INVITE") return "Convite";
  return "Comunidade";
};

const resolveCommunityTalkLabel = (talkPolicy?: string | null) => {
  const normalized = talkPolicy?.trim().toUpperCase() ?? "";
  if (normalized === "TEAM_ONLY") return "Fala da equipa";
  return "Todos falam";
};

export default function MessageRequestsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const isCompactWidth = screenWidth < 360;
  const horizontalGutter = isCompactWidth ? 14 : 20;
  const topPadding = useTopHeaderPadding(16);
  const topBar = useTopBarScroll({ hideOnScroll: false });
  const { session } = useAuth();
  const accessToken = session?.access_token ?? null;
  const openAuth = () => {
    safePush(router, { pathname: "/auth", params: { next: "/comunidade/mensagens/pedidos" } });
  };
  const requestsQuery = useMessageRequests(Boolean(session?.user?.id), accessToken, session?.user?.id);
  const communityInvitesQuery = useMessageCommunityInvites(
    Boolean(session?.user?.id),
    accessToken,
    session?.user?.id,
  );
  const requestItems = requestsQuery.data?.items ?? [];
  const communityInviteItems = communityInvitesQuery.data?.items ?? [];
  const items = useMemo(
    () => requestItems.filter((item) => item.status === "PENDING"),
    [requestItems],
  );
  const pendingCommunityInvites = useMemo(
    () => communityInviteItems.filter((invite) => invite.status === "PENDING"),
    [communityInviteItems],
  );
  const sortedPendingCommunityInvites = useMemo(
    () =>
      [...pendingCommunityInvites].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [pendingCommunityInvites],
  );
  const sortedItems = useMemo(
    () => [...items].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [items],
  );
  const hasAnyPending = items.length > 0 || pendingCommunityInvites.length > 0;
  const totalPending = sortedItems.length + sortedPendingCommunityInvites.length;
  const [pendingRequestId, setPendingRequestId] = useState<string | null>(null);
  const hasPendingAction = Boolean(pendingRequestId);
  const isRefreshing =
    Boolean(session?.user?.id) &&
    !requestsQuery.isLoading &&
    !communityInvitesQuery.isLoading &&
    (requestsQuery.isFetching || communityInvitesQuery.isFetching);
  const lastSyncAt = Math.max(requestsQuery.dataUpdatedAt ?? 0, communityInvitesQuery.dataUpdatedAt ?? 0);

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

  const handleAccept = async (requestId: string) => {
    if (!accessToken || hasPendingAction) return;
    setPendingRequestId(requestId);
    try {
      const response = await acceptMessageRequest(requestId, accessToken);
      if (response.conversationId) {
        safePush(router, {
          pathname: "/comunidade/mensagens/[threadId]",
          params: { threadId: response.conversationId, source: "conversation" },
        });
      }
      await Promise.all([requestsQuery.refetch(), communityInvitesQuery.refetch()]);
    } catch (err) {
      Alert.alert(
        t("messages:requests"),
        getUserFacingError(err, t("messages:requestsScreen.error")),
      );
    } finally {
      setPendingRequestId((current) => (current === requestId ? null : current));
    }
  };

  const handleDecline = async (requestId: string) => {
    if (!accessToken || hasPendingAction) return;
    setPendingRequestId(requestId);
    try {
      await declineMessageRequest(requestId, accessToken);
      await Promise.all([requestsQuery.refetch(), communityInvitesQuery.refetch()]);
    } catch (err) {
      Alert.alert(
        t("messages:requests"),
        getUserFacingError(err, t("messages:requestsScreen.error")),
      );
    } finally {
      setPendingRequestId((current) => (current === requestId ? null : current));
    }
  };

  const handleAcceptCommunityInvite = async (inviteId: string) => {
    if (!accessToken || hasPendingAction) return;
    setPendingRequestId(inviteId);
    try {
      const response = await acceptCommunityInvite(inviteId, accessToken);
      if (response.conversationId) {
        safePush(router, {
          pathname: "/comunidade/mensagens/[threadId]",
          params: { threadId: response.conversationId, source: "conversation" },
        });
      }
      await Promise.all([requestsQuery.refetch(), communityInvitesQuery.refetch()]);
    } catch (err) {
      Alert.alert(
        t("messages:requests"),
        getUserFacingError(err, t("messages:requestsScreen.error")),
      );
    } finally {
      setPendingRequestId((current) => (current === inviteId ? null : current));
    }
  };

  const handleDeclineCommunityInvite = async (inviteId: string) => {
    if (!accessToken || hasPendingAction) return;
    setPendingRequestId(inviteId);
    try {
      await declineCommunityInvite(inviteId, accessToken);
      await Promise.all([requestsQuery.refetch(), communityInvitesQuery.refetch()]);
    } catch (err) {
      Alert.alert(
        t("messages:requests"),
        getUserFacingError(err, t("messages:requestsScreen.error")),
      );
    } finally {
      setPendingRequestId((current) => (current === inviteId ? null : current));
    }
  };

  return (
    <LiquidBackground>
      <TopAppHeader
        scrollState={topBar}
        variant="title"
        title={t("messages:requests")}
        leftSlot={backButton}
        showNotifications
        showMessages={false}
      />
      <ScrollView
        style={{ flex: 1 }}
        onScroll={topBar.onScroll}
        onScrollEndDrag={topBar.onScrollEndDrag}
        onMomentumScrollEnd={topBar.onMomentumScrollEnd}
        scrollEventThrottle={16}
        refreshControl={
          session?.user?.id ? (
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => {
                requestsQuery.refetch();
                communityInvitesQuery.refetch();
              }}
              tintColor="rgba(255,255,255,0.88)"
            />
          ) : undefined
        }
        contentContainerStyle={{
          paddingTop: topPadding,
          paddingHorizontal: horizontalGutter,
          paddingBottom: insets.bottom + 16,
        }}
      >
        <View className="mt-1 mb-2">
          <Text className="text-white/90 text-sm">{t("messages:requestsScreen.subtitle")}</Text>
        </View>

        {session?.user?.id ? (
          <GlassCard intensity={48} padding={12}>
            <View className="flex-row items-center justify-between gap-2">
              <View style={{ flex: 1 }}>
                <Text className="text-white text-sm font-semibold">Pendentes</Text>
                <Text className="text-white/88 text-xs mt-1">
                  {totalPending} no total · {sortedPendingCommunityInvites.length} comunidades · {sortedItems.length} diretos
                </Text>
                <Text className="text-white/68 text-[11px] mt-1">{formatLastSyncLabel(lastSyncAt)}</Text>
                {isRefreshing ? <Text className="text-cyan-100 text-[11px] mt-1">A atualizar...</Text> : null}
              </View>
              <Pressable
                onPress={() => {
                  requestsQuery.refetch();
                  communityInvitesQuery.refetch();
                }}
                disabled={isRefreshing || hasPendingAction}
                className="rounded-full border border-white/20 bg-white/12 px-3 py-1.5"
                style={{ minHeight: tokens.layout.touchTarget, justifyContent: "center" }}
                accessibilityRole="button"
                accessibilityLabel="Atualizar pedidos"
              >
                <Text className="text-white text-[11px] font-semibold">{isRefreshing ? "A atualizar..." : "Atualizar"}</Text>
              </Pressable>
            </View>
          </GlassCard>
        ) : null}

        {hasPendingAction ? (
          <View className="mt-3 rounded-xl border border-cyan-200/35 bg-cyan-500/14 px-3 py-2">
            <Text className="text-cyan-100 text-xs">A processar pedido...</Text>
          </View>
        ) : null}

        {!session?.user?.id ? (
          <GlassCard intensity={55} className="mt-5">
            <Text className="text-white text-sm font-semibold mb-2">{t("messages:requestsScreen.signinTitle")}</Text>
            <Text className="text-white/88 text-sm">{t("messages:requestsScreen.signinBody")}</Text>
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
        ) : requestsQuery.isLoading || communityInvitesQuery.isLoading ? (
          <View className="mt-5 gap-3">
            {Array.from({ length: 3 }, (_, idx) => (
              <GlassSkeleton key={`req-skel-${idx}`} height={86} />
            ))}
          </View>
        ) : requestsQuery.isError || communityInvitesQuery.isError ? (
          <GlassCard intensity={55} className="mt-5">
            <Text className="text-red-300 text-sm mb-2">{t("messages:requestsScreen.error")}</Text>
            <Pressable
              onPress={() => {
                requestsQuery.refetch();
                communityInvitesQuery.refetch();
              }}
              className="rounded-2xl bg-white/10 px-4 py-3"
              style={{ minHeight: tokens.layout.touchTarget }}
              accessibilityRole="button"
              accessibilityLabel={t("common:actions.retry")}
            >
              <Text className="text-white text-sm font-semibold text-center">{t("common:actions.retry")}</Text>
            </Pressable>
          </GlassCard>
        ) : !hasAnyPending ? (
          <GlassCard intensity={52} className="mt-5" padding={16}>
            <View className="flex-row items-center gap-2">
              <Ionicons name="mail-open-outline" size={16} color="rgba(255,255,255,0.86)" />
              <Text className="text-white text-sm font-semibold">{t("messages:requestsScreen.empty")}</Text>
            </View>
            <Text className="mt-2 text-white/88 text-sm">{t("messages:requestsScreen.emptyHint")}</Text>
            <Pressable
              onPress={() => safePush(router, "/comunidade/mensagens")}
              className="mt-4 rounded-2xl border border-white/18 bg-white/8 px-4 py-3"
              style={{ minHeight: tokens.layout.touchTarget }}
              accessibilityRole="button"
              accessibilityLabel="Abrir mensagens"
            >
              <Text className="text-center text-sm font-semibold text-white">Abrir mensagens</Text>
            </Pressable>
          </GlassCard>
        ) : (
          <View className="mt-4 gap-3">
            {sortedPendingCommunityInvites.length ? (
              <View className="mb-1 flex-row items-center justify-between">
                <Text className="text-white text-xs font-semibold uppercase tracking-[0.12em]">
                  Convites de Comunidade
                </Text>
                <Text className="text-white/70 text-[11px]">{sortedPendingCommunityInvites.length}</Text>
              </View>
            ) : null}
            {sortedPendingCommunityInvites.map((invite) => {
              const label = invite.community?.title?.trim() || t("messages:thread.conversationTitleFallback");
              const isBusy = pendingRequestId === invite.id;
              return (
                <GlassCard key={`community-invite-${invite.id}`} intensity={58} padding={14}>
                  <View className="gap-3">
                    <View className="flex-row items-center gap-3">
                      <AvatarCircle
                        size={48}
                        uri={invite.community?.coverImageUrl ?? null}
                        iconName="people-outline"
                        iconColor="rgba(255,255,255,0.72)"
                        borderColor="rgba(255,255,255,0.12)"
                        backgroundColor="rgba(255,255,255,0.08)"
                      />

                      <View style={{ flex: 1, gap: 2 }}>
                        <View className="flex-row items-center gap-2">
                          <Text className="text-white text-sm font-semibold" numberOfLines={1} style={{ flex: 1 }}>
                            {label}
                          </Text>
                          <Text className="text-white/75 text-[11px]">{formatRequestTimestamp(invite.createdAt)}</Text>
                        </View>
                        <View className="flex-row items-center gap-2">
                          <Text className="text-white/88 text-xs" numberOfLines={1}>
                            Convite para comunidade
                          </Text>
                          <View className="rounded-full border border-sky-300/30 bg-sky-400/14 px-2 py-0.5">
                            <Text className="text-[10px] font-semibold text-sky-100">COMUNIDADE</Text>
                          </View>
                        </View>
                        <Text className="text-white/78 text-[11px]" numberOfLines={2}>
                          {resolveCommunityAccessLabel(invite.community?.accessMode)} ·{" "}
                          {resolveCommunityTalkLabel(invite.community?.talkPolicy)}
                        </Text>
                        {invite.requester?.username || invite.requester?.fullName ? (
                          <Text className="text-white/72 text-[11px]" numberOfLines={1}>
                            Convite enviado por{" "}
                            {invite.requester?.fullName?.trim() || `@${invite.requester?.username}`}
                          </Text>
                        ) : null}
                        <Text className="text-white/72 text-[11px]">{formatRequestExpiry(invite.expiresAt)}</Text>
                      </View>
                    </View>

                    <View className={isCompactWidth ? "gap-2" : "flex-row gap-2"}>
                      <Pressable
                        onPress={() => handleDeclineCommunityInvite(invite.id)}
                        disabled={hasPendingAction}
                        className="rounded-2xl border border-red-300/40 bg-red-500/20 px-4 py-2.5"
                        style={{
                          minHeight: tokens.layout.touchTarget,
                          minWidth: isCompactWidth ? undefined : tokens.layout.touchTarget,
                          justifyContent: "center",
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={t("common:actions.decline")}
                        accessibilityState={{ disabled: hasPendingAction }}
                      >
                        {isBusy ? (
                          <ActivityIndicator color="rgba(255,255,255,0.9)" />
                        ) : (
                          <Text className="text-center text-sm font-semibold text-red-50">{t("common:actions.decline")}</Text>
                        )}
                      </Pressable>

                      <Pressable
                        onPress={() => handleAcceptCommunityInvite(invite.id)}
                        disabled={hasPendingAction}
                        className="flex-1 rounded-2xl border border-emerald-300/40 bg-emerald-500/22 px-4 py-2"
                        style={{ minHeight: tokens.layout.touchTarget, justifyContent: "center" }}
                        accessibilityRole="button"
                        accessibilityLabel="Entrar"
                        accessibilityState={{ disabled: hasPendingAction }}
                      >
                        {isBusy ? (
                          <ActivityIndicator color="rgba(255,255,255,0.95)" />
                        ) : (
                          <Text className="text-center text-sm font-semibold text-emerald-50">Entrar</Text>
                        )}
                      </Pressable>
                    </View>
                  </View>
                </GlassCard>
              );
            })}

            {sortedItems.length ? (
              <View className="mt-2 mb-1 flex-row items-center justify-between">
                <Text className="text-white text-xs font-semibold uppercase tracking-[0.12em]">
                  Pedidos Diretos
                </Text>
                <Text className="text-white/70 text-[11px]">{sortedItems.length}</Text>
              </View>
            ) : null}
            {sortedItems.map((request) => {
              const name =
                request.requester.fullName?.trim() ||
                (request.requester.username ? `@${request.requester.username}` : t("messages:requestsScreen.userFallback"));
              const isBusy = pendingRequestId === request.id;
              const requestExpiryLabel = formatRequestExpiry(request.expiresAt);
              return (
                <GlassCard key={request.id} intensity={58} padding={14}>
                  <View className="gap-3">
                    <View className="flex-row items-center gap-3">
                      <AvatarCircle
                        size={48}
                        uri={request.requester.avatarUrl}
                        iconName="person-outline"
                        iconColor="rgba(255,255,255,0.72)"
                        borderColor="rgba(255,255,255,0.12)"
                        backgroundColor="rgba(255,255,255,0.08)"
                      />

                      <View style={{ flex: 1, gap: 2 }}>
                        <View className="flex-row items-center gap-2">
                          <Text className="text-white text-sm font-semibold" numberOfLines={1} style={{ flex: 1 }}>
                            {name}
                          </Text>
                          <Text className="text-white/75 text-[11px]">{formatRequestTimestamp(request.createdAt)}</Text>
                        </View>
                        <View className="flex-row items-center gap-2">
                          <Text className="text-white/88 text-xs" numberOfLines={1}>
                            {t("messages:requestsScreen.requestLabel")}
                          </Text>
                          <View className="rounded-full border border-white/25 bg-white/10 px-2 py-0.5">
                            <Text className="text-[10px] font-semibold text-white/92">MENSAGEM</Text>
                          </View>
                        </View>
                        {request.requester.username ? (
                          <Text className="text-white/72 text-[11px]" numberOfLines={1}>
                            @{request.requester.username}
                          </Text>
                        ) : null}
                        <Text className="text-white/72 text-[11px]">{requestExpiryLabel}</Text>
                      </View>
                    </View>

                    <View className={isCompactWidth ? "gap-2" : "flex-row gap-2"}>
                      <Pressable
                        onPress={() => handleDecline(request.id)}
                        disabled={hasPendingAction}
                        className="rounded-2xl border border-red-300/40 bg-red-500/20 px-4 py-2.5"
                        style={{
                          minHeight: tokens.layout.touchTarget,
                          minWidth: isCompactWidth ? undefined : tokens.layout.touchTarget,
                          justifyContent: "center",
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={t("common:actions.decline")}
                        accessibilityState={{ disabled: hasPendingAction }}
                      >
                        {isBusy ? (
                          <ActivityIndicator color="rgba(255,255,255,0.9)" />
                        ) : (
                          <Text className="text-center text-sm font-semibold text-red-50">{t("common:actions.decline")}</Text>
                        )}
                      </Pressable>

                      <Pressable
                        onPress={() => handleAccept(request.id)}
                        disabled={hasPendingAction}
                        className="flex-1 rounded-2xl border border-emerald-300/40 bg-emerald-500/22 px-4 py-2"
                        style={{ minHeight: tokens.layout.touchTarget, justifyContent: "center" }}
                        accessibilityRole="button"
                        accessibilityLabel={t("common:actions.accept")}
                        accessibilityState={{ disabled: hasPendingAction }}
                      >
                        {isBusy ? (
                          <ActivityIndicator color="rgba(255,255,255,0.95)" />
                        ) : (
                          <Text className="text-center text-sm font-semibold text-emerald-50">{t("common:actions.accept")}</Text>
                        )}
                      </Pressable>
                    </View>
                  </View>
                </GlassCard>
              );
            })}
          </View>
        )}
      </ScrollView>
    </LiquidBackground>
  );
}
