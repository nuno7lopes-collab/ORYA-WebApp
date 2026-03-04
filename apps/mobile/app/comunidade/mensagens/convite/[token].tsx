import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, Text, useWindowDimensions, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { LiquidBackground } from "../../../../components/liquid/LiquidBackground";
import { TopAppHeader } from "../../../../components/navigation/TopAppHeader";
import { useTopHeaderPadding } from "../../../../components/navigation/useTopHeaderPadding";
import { useTopBarScroll } from "../../../../components/navigation/useTopBarScroll";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { tokens, useTranslation } from "@orya/shared";
import { GlassCard } from "../../../../components/liquid/GlassCard";
import { useAuth } from "../../../../lib/auth";
import { redeemCommunityInviteLink } from "../../../../features/messages/api";
import { safePush } from "../../../../lib/navigation";
import { getUserFacingError } from "../../../../lib/errors";
import { Ionicons } from "../../../../components/icons/Ionicons";
import { ApiError } from "../../../../lib/api";

const resolveInviteRedeemError = (err: unknown) => {
  const fallback = "Não foi possível validar o convite.";
  if (err instanceof ApiError) {
    const code = err.code?.trim().toUpperCase() ?? "";
    if (code === "UNAUTHENTICATED") {
      return { message: "Inicia sessão para entrares nesta comunidade.", requiresAuth: true };
    }
    if (code === "INVALID_TOKEN" || code === "INVITE_LINK_INVALID") {
      return { message: "Este convite não é válido.", requiresAuth: false };
    }
    if (code === "INVITE_LINK_REVOKED") {
      return { message: "Este convite foi revogado pelo administrador.", requiresAuth: false };
    }
    if (code === "INVITE_LINK_EXPIRED") {
      return { message: "Este convite expirou. Pede um novo link.", requiresAuth: false };
    }
    if (code === "INVITE_MODE_DISABLED") {
      return { message: "A comunidade já não aceita convites por link.", requiresAuth: false };
    }
    if (code === "BANNED") {
      return { message: "Não podes entrar nesta comunidade.", requiresAuth: false };
    }
    if (code === "FORBIDDEN") {
      return { message: "Sem permissão para usar este convite.", requiresAuth: false };
    }
    if (err.status === 401) {
      return { message: "Inicia sessão para entrares nesta comunidade.", requiresAuth: true };
    }
  }

  const raw = (err instanceof Error ? err.message : String(err ?? "")).toUpperCase();
  if (raw.includes("UNAUTHENTICATED")) {
    return { message: "Inicia sessão para entrares nesta comunidade.", requiresAuth: true };
  }
  if (raw.includes("INVITE_LINK_REVOKED")) {
    return { message: "Este convite foi revogado pelo administrador.", requiresAuth: false };
  }
  if (raw.includes("INVITE_LINK_EXPIRED")) {
    return { message: "Este convite expirou. Pede um novo link.", requiresAuth: false };
  }
  if (raw.includes("INVITE_LINK_INVALID") || raw.includes("INVALID_TOKEN")) {
    return { message: "Este convite não é válido.", requiresAuth: false };
  }
  if (raw.includes("BANNED")) {
    return { message: "Não podes entrar nesta comunidade.", requiresAuth: false };
  }
  return { message: getUserFacingError(err, fallback), requiresAuth: false };
};

export default function CommunityInviteRedeemScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ token?: string | string[] }>();
  const topPadding = useTopHeaderPadding(16);
  const topBar = useTopBarScroll({ hideOnScroll: false });
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const isCompactWidth = screenWidth < 360;
  const horizontalGutter = isCompactWidth ? 14 : 20;
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
        pathname: "/comunidade/mensagens/[threadId]",
        params: { threadId: response.conversationId, source: "conversation" },
      });
    } catch (err) {
      const resolved = resolveInviteRedeemError(err);
      setError(resolved.message);
      setRequiresAuth(resolved.requiresAuth);
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
          paddingHorizontal: horizontalGutter,
          paddingBottom: insets.bottom + 20,
        }}
      >
        <View className="mt-1 mb-2">
          <Text className="text-white/90 text-sm">
            Validação segura do convite para entrares diretamente no chat da comunidade.
          </Text>
        </View>

        <GlassCard intensity={58} className="mt-3" padding={16}>
          <View className="mb-3 flex-row items-center gap-2">
            <View className="h-8 w-8 items-center justify-center rounded-full border border-sky-300/35 bg-sky-400/18">
              <Ionicons name="shield-checkmark-outline" size={16} color="rgba(186,230,253,0.98)" />
            </View>
            <Text className="text-white text-sm font-semibold">Convite da comunidade</Text>
          </View>
          {loading ? (
            <View className="items-center gap-3 py-3">
              <ActivityIndicator color="rgba(255,255,255,0.9)" />
              <Text className="text-white/90 text-sm">A validar convite...</Text>
              <Text className="text-white/75 text-xs text-center">
                Vamos confirmar permissões e abrir o grupo correto.
              </Text>
            </View>
          ) : error ? (
            <View className="gap-3">
              <View className="rounded-xl border border-red-300/35 bg-red-500/15 px-3 py-2">
                <Text className="text-red-200 text-sm">{error}</Text>
              </View>
              {requiresAuth ? (
                <Pressable
                  onPress={() =>
                    safePush(router, {
                      pathname: "/auth",
                      params: { next: `/comunidade/mensagens/convite/${encodeURIComponent(token.trim())}` },
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
                onPress={() => safePush(router, "/comunidade/mensagens")}
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
            <View className="rounded-xl border border-emerald-300/35 bg-emerald-500/15 px-3 py-2">
              <Text className="text-emerald-100 text-sm">Convite validado. A abrir conversa...</Text>
            </View>
          )}
        </GlassCard>
      </View>
    </LiquidBackground>
  );
}
