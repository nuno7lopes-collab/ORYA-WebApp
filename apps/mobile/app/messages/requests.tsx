import { ActivityIndicator, Alert, Pressable, Text, View } from "react-native";
import { useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { LiquidBackground } from "../../components/liquid/LiquidBackground";
import { TopAppHeader } from "../../components/navigation/TopAppHeader";
import { useTopHeaderPadding } from "../../components/navigation/useTopHeaderPadding";
import { useTopBarScroll } from "../../components/navigation/useTopBarScroll";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GlassCard } from "../../components/liquid/GlassCard";
import { GlassSkeleton } from "../../components/glass/GlassSkeleton";
import { tokens, useTranslation } from "@orya/shared";
import { useAuth } from "../../lib/auth";
import { useMessageRequests } from "../../features/messages/hooks";
import { acceptMessageRequest, declineMessageRequest } from "../../features/messages/api";
import { Ionicons } from "../../components/icons/Ionicons";
import { safeBack } from "../../lib/navigation";
import { useNavigation } from "@react-navigation/native";
import { AvatarCircle } from "../../components/avatar/AvatarCircle";
import { formatDate } from "../../lib/formatters";
import { getUserFacingError } from "../../lib/errors";

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

export default function MessageRequestsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const topPadding = useTopHeaderPadding(16);
  const topBar = useTopBarScroll({ hideOnScroll: false });
  const { session } = useAuth();
  const accessToken = session?.access_token ?? null;
  const requestsQuery = useMessageRequests(Boolean(session?.user?.id), accessToken, session?.user?.id);
  const requestItems = requestsQuery.data?.items ?? [];
  const items = useMemo(
    () => requestItems.filter((item) => item.status === "PENDING"),
    [requestItems],
  );
  const [pendingRequestId, setPendingRequestId] = useState<string | null>(null);
  const hasPendingAction = Boolean(pendingRequestId);

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

  const handleAccept = async (requestId: string) => {
    if (!accessToken || hasPendingAction) return;
    setPendingRequestId(requestId);
    try {
      const response = await acceptMessageRequest(requestId, accessToken);
      if (response.conversationId) {
        router.push({
          pathname: "/messages/[threadId]",
          params: { threadId: response.conversationId, source: "conversation" },
        });
      }
      await requestsQuery.refetch();
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
      await requestsQuery.refetch();
    } catch (err) {
      Alert.alert(
        t("messages:requests"),
        getUserFacingError(err, t("messages:requestsScreen.error")),
      );
    } finally {
      setPendingRequestId((current) => (current === requestId ? null : current));
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
      <View style={{ flex: 1, paddingTop: topPadding, paddingHorizontal: 20, paddingBottom: insets.bottom + 16 }}>
        <View className="mt-1 mb-2">
          <Text className="text-white/62 text-sm">{t("messages:requestsScreen.subtitle")}</Text>
        </View>

        {!session?.user?.id ? (
          <GlassCard intensity={55} className="mt-5">
            <Text className="text-white text-sm font-semibold mb-2">
              {t("messages:requestsScreen.signinTitle")}
            </Text>
            <Text className="text-white/65 text-sm">{t("messages:requestsScreen.signinBody")}</Text>
          </GlassCard>
        ) : requestsQuery.isLoading ? (
          <View className="mt-5 gap-3">
            {Array.from({ length: 3 }, (_, idx) => (
              <GlassSkeleton key={`req-skel-${idx}`} height={86} />
            ))}
          </View>
        ) : requestsQuery.isError ? (
          <GlassCard intensity={55} className="mt-5">
            <Text className="text-red-300 text-sm mb-2">{t("messages:requestsScreen.error")}</Text>
            <Pressable
              onPress={() => requestsQuery.refetch()}
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
        ) : items.length === 0 ? (
          <GlassCard intensity={52} className="mt-5" padding={16}>
            <View className="flex-row items-center gap-2">
              <Ionicons name="mail-open-outline" size={16} color="rgba(255,255,255,0.78)" />
              <Text className="text-white text-sm font-semibold">{t("messages:requestsScreen.empty")}</Text>
            </View>
            <Text className="mt-2 text-white/62 text-sm">{t("messages:requestsScreen.emptyHint")}</Text>
          </GlassCard>
        ) : (
          <View className="mt-4 gap-3">
            {items.map((request) => {
              const name =
                request.requester.fullName?.trim() ||
                (request.requester.username ? `@${request.requester.username}` : t("messages:requestsScreen.userFallback"));
              const isBusy = pendingRequestId === request.id;
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
                          <Text className="text-white/45 text-[11px]">
                            {formatRequestTimestamp(request.createdAt)}
                          </Text>
                        </View>
                        <Text className="text-white/60 text-xs" numberOfLines={1}>
                          {t("messages:requestsScreen.requestLabel")}
                        </Text>
                      </View>
                    </View>

                    <View className="flex-row gap-2">
                      <Pressable
                        onPress={() => handleDecline(request.id)}
                        disabled={hasPendingAction}
                        className="rounded-2xl border border-white/15 bg-white/5 px-4 py-2.5"
                        style={{ minHeight: tokens.layout.touchTarget, minWidth: tokens.layout.touchTarget }}
                        accessibilityRole="button"
                        accessibilityLabel={t("common:actions.decline")}
                        accessibilityState={{ disabled: hasPendingAction }}
                      >
                        {isBusy ? (
                          <ActivityIndicator color="rgba(255,255,255,0.9)" />
                        ) : (
                          <Ionicons name="close" size={16} color="rgba(255,255,255,0.9)" />
                        )}
                      </Pressable>

                      <Pressable
                        onPress={() => handleAccept(request.id)}
                        disabled={hasPendingAction}
                        className="flex-1 rounded-2xl bg-white/90 px-4 py-2"
                        style={{ minHeight: tokens.layout.touchTarget }}
                        accessibilityRole="button"
                        accessibilityLabel={t("common:actions.accept")}
                        accessibilityState={{ disabled: hasPendingAction }}
                      >
                        {isBusy ? (
                          <ActivityIndicator color="#0b101a" />
                        ) : (
                          <Text className="text-center text-sm font-semibold" style={{ color: "#0b101a" }}>
                            {t("common:actions.accept")}
                          </Text>
                        )}
                      </Pressable>
                    </View>
                  </View>
                </GlassCard>
              );
            })}
          </View>
        )}
      </View>
    </LiquidBackground>
  );
}
