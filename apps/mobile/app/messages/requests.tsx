import { Pressable, Text, View } from "react-native";
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

export default function MessageRequestsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const topPadding = useTopHeaderPadding(16);
  const topBar = useTopBarScroll({ hideOnScroll: false });
  const { session } = useAuth();
  const accessToken = session?.access_token ?? null;
  const requestsQuery = useMessageRequests(Boolean(session?.user?.id), accessToken);
  const items = requestsQuery.data?.items ?? [];

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
    if (!accessToken) return;
    const response = await acceptMessageRequest(requestId, accessToken);
    if (response.conversationId) {
      router.push({
        pathname: "/messages/[threadId]",
        params: { threadId: response.conversationId, source: "conversation" },
      });
    }
    await requestsQuery.refetch();
  };

  const handleDecline = async (requestId: string) => {
    if (!accessToken) return;
    await declineMessageRequest(requestId, accessToken);
    await requestsQuery.refetch();
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
          <GlassCard intensity={52} className="mt-5">
            <Text className="text-white/70 text-sm">{t("messages:requestsScreen.empty")}</Text>
          </GlassCard>
        ) : (
          <View className="mt-4 gap-3">
            {items.map((request) => {
              const name =
                request.requester.fullName?.trim() ||
                (request.requester.username ? `@${request.requester.username}` : t("messages:requestsScreen.userFallback"));
              return (
                <GlassCard key={request.id} intensity={58} padding={14}>
                  <View className="gap-3">
                    <View>
                      <Text className="text-white text-sm font-semibold">{name}</Text>
                      <Text className="text-white/60 text-xs mt-1">
                        {t("messages:requestsScreen.requestLabel")}
                      </Text>
                    </View>
                    <View className="flex-row gap-2">
                      <Pressable
                        onPress={() => handleAccept(request.id)}
                        className="flex-1 rounded-2xl bg-white/90 px-4 py-2"
                        style={{ minHeight: tokens.layout.touchTarget - 6 }}
                        accessibilityRole="button"
                        accessibilityLabel={t("common:actions.accept")}
                      >
                        <Text className="text-center text-sm font-semibold" style={{ color: "#0b101a" }}>
                          {t("common:actions.accept")}
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => handleDecline(request.id)}
                        className="flex-1 rounded-2xl border border-white/15 bg-white/5 px-4 py-2"
                        style={{ minHeight: tokens.layout.touchTarget - 6 }}
                        accessibilityRole="button"
                        accessibilityLabel={t("common:actions.decline")}
                      >
                        <Text className="text-center text-sm font-semibold text-white">
                          {t("common:actions.decline")}
                        </Text>
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
