import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { LiquidBackground } from "../../../components/liquid/LiquidBackground";
import { TopAppHeader } from "../../../components/navigation/TopAppHeader";
import { useTopHeaderPadding } from "../../../components/navigation/useTopHeaderPadding";
import { useTopBarScroll } from "../../../components/navigation/useTopBarScroll";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { tokens, useTranslation } from "@orya/shared";
import { GlassCard } from "../../../components/liquid/GlassCard";
import { useAuth } from "../../../lib/auth";
import { redeemCommunityInviteLink } from "../../../features/messages/api";
import { safePush } from "../../../lib/navigation";
import { getUserFacingError } from "../../../lib/errors";

export default function CommunityInviteRedeemScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ token?: string | string[] }>();
  const topPadding = useTopHeaderPadding(16);
  const topBar = useTopBarScroll({ hideOnScroll: false });
  const insets = useSafeAreaInsets();
  const { session } = useAuth();

  const token = useMemo(
    () => (Array.isArray(params.token) ? params.token[0] : params.token) ?? "",
    [params.token],
  );

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requiresAuth, setRequiresAuth] = useState(false);

  const runRedeem = async () => {
    setRequiresAuth(false);

    if (!session?.access_token) {
      setError("Inicia sessão para entrares nesta comunidade.");
      setRequiresAuth(true);
      setLoading(false);
      return;
    }
    if (!token.trim()) {
      setError("Convite inválido.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await redeemCommunityInviteLink(token.trim(), session.access_token);
      if (!response?.conversationId) {
        throw new Error("Não foi possível validar o convite.");
      }
      safePush(router, {
        pathname: "/messages/[threadId]",
        params: { threadId: response.conversationId, source: "conversation" },
      });
    } catch (err) {
      setError(getUserFacingError(err, "Não foi possível validar o convite."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void runRedeem();
  }, [token, session?.access_token]);

  return (
    <LiquidBackground>
      <TopAppHeader
        scrollState={topBar}
        variant="title"
        title="Convite da comunidade"
        showNotifications
        showMessages={false}
      />
      <View
        style={{
          flex: 1,
          paddingTop: topPadding,
          paddingHorizontal: 20,
          paddingBottom: insets.bottom + 20,
        }}
      >
        <GlassCard intensity={58} className="mt-5" padding={16}>
          {loading ? (
            <View className="items-center gap-3 py-3">
              <ActivityIndicator color="rgba(255,255,255,0.9)" />
              <Text className="text-white/70 text-sm">A validar convite...</Text>
            </View>
          ) : error ? (
            <View className="gap-3">
              <Text className="text-red-300 text-sm">{error}</Text>
              {requiresAuth ? (
                <Pressable
                  onPress={() =>
                    safePush(router, {
                      pathname: "/auth",
                      params: { next: `/messages/community-invite/${encodeURIComponent(token.trim())}` },
                    })
                  }
                  className="rounded-2xl bg-white/90 px-4 py-3"
                  style={{ minHeight: tokens.layout.touchTarget }}
                  accessibilityRole="button"
                  accessibilityLabel="Iniciar sessão"
                >
                  <Text className="text-center text-sm font-semibold" style={{ color: "#0b101a" }}>
                    Iniciar sessão
                  </Text>
                </Pressable>
              ) : null}
              <Pressable
                onPress={() => void runRedeem()}
                className="rounded-2xl bg-white/90 px-4 py-3"
                style={{ minHeight: tokens.layout.touchTarget }}
                accessibilityRole="button"
                accessibilityLabel={t("common:actions.retry")}
              >
                <Text className="text-center text-sm font-semibold" style={{ color: "#0b101a" }}>
                  {t("common:actions.retry")}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => safePush(router, "/messages")}
                className="rounded-2xl border border-white/18 bg-white/8 px-4 py-3"
                style={{ minHeight: tokens.layout.touchTarget }}
                accessibilityRole="button"
                accessibilityLabel={t("common:actions.back")}
              >
                <Text className="text-center text-sm font-semibold text-white">
                  {t("common:actions.back")}
                </Text>
              </Pressable>
            </View>
          ) : (
            <Text className="text-white/80 text-sm">Convite validado.</Text>
          )}
        </GlassCard>
      </View>
    </LiquidBackground>
  );
}
