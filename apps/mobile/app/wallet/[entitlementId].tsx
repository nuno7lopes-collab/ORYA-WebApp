import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef } from "react";
import { Animated, Image, Linking, Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getSharedEnv, tokens } from "@orya/shared";
import { GlassCard } from "../../components/liquid/GlassCard";
import { GlassPill } from "../../components/liquid/GlassPill";
import { LiquidBackground } from "../../components/liquid/LiquidBackground";
import { GlassSkeleton } from "../../components/glass/GlassSkeleton";
import { useWalletDetail } from "../../features/wallet/hooks";
import { ApiError } from "../../lib/api";

const formatDate = (value: string | null | undefined) => {
  if (!value) return "Data por anunciar";
  try {
    return new Date(value).toLocaleString("pt-PT", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "Data por anunciar";
  }
};

const statusLabel = (value: string) => {
  const normalized = value.toUpperCase();
  if (normalized === "ACTIVE") return "Ativo";
  if (normalized === "USED") return "Usado";
  if (normalized === "CANCELLED") return "Cancelado";
  if (normalized === "EXPIRED") return "Expirado";
  return value;
};

const typeLabel = (value: string) => {
  const normalized = value.toUpperCase();
  if (normalized === "TICKET") return "Bilhete";
  if (normalized === "REGISTRATION") return "Inscrição";
  if (normalized === "BOOKING") return "Reserva";
  return value;
};

export default function WalletDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ entitlementId?: string | string[] }>();
  const entitlementId = useMemo(
    () => (Array.isArray(params.entitlementId) ? params.entitlementId[0] : params.entitlementId) ?? null,
    [params.entitlementId],
  );
  const { data, isLoading, isError, error, refetch } = useWalletDetail(entitlementId);
  const fade = useRef(new Animated.Value(0)).current;
  const translate = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    if (!data) return;
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: tokens.motion.normal,
        useNativeDriver: true,
      }),
      Animated.timing(translate, {
        toValue: 0,
        duration: tokens.motion.normal,
        useNativeDriver: true,
      }),
    ]).start();
  }, [data, fade, translate]);

  const baseUrl = getSharedEnv().apiBaseUrl.replace(/\/$/, "");
  const qrUrl = data?.qrToken ? `${baseUrl}/api/qr/${encodeURIComponent(data.qrToken)}?theme=dark` : null;
  const passUrl = data?.passUrl ?? null;

  return (
    <>
      <Stack.Screen options={{ headerShown: false, animation: "slide_from_right" }} />
      <LiquidBackground variant="deep">
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 34 }}>
          <View className="pt-12 pb-4">
            <Pressable
              onPress={() => router.back()}
              className="flex-row items-center gap-2"
              style={{ minHeight: tokens.layout.touchTarget }}
            >
              <Ionicons name="chevron-back" size={22} color={tokens.colors.text} />
              <Text className="text-white text-sm font-semibold">Voltar à carteira</Text>
            </Pressable>
          </View>

          {isLoading ? (
            <View className="gap-3">
              <GlassSkeleton height={200} />
              <GlassSkeleton height={160} />
              <GlassSkeleton height={120} />
            </View>
          ) : isError || !data ? (
            <GlassCard intensity={52}>
              <Text className="text-red-300 text-sm mb-3">
                {error instanceof ApiError && error.status === 404
                  ? "Entitlement não encontrado."
                  : "Não foi possível carregar o detalhe."}
              </Text>
              <Pressable
                onPress={() => refetch()}
                className="rounded-xl bg-white/10 px-4 py-3"
                style={{ minHeight: tokens.layout.touchTarget }}
              >
                <Text className="text-white text-sm font-semibold text-center">Tentar novamente</Text>
              </Pressable>
            </GlassCard>
          ) : (
            <Animated.View style={{ opacity: fade, transform: [{ translateY: translate }] }}>
              <GlassCard intensity={62} className="mb-4">
                <View className="gap-3">
                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center gap-2">
                      <GlassPill label={typeLabel(data.type)} />
                      <GlassPill label={statusLabel(data.status)} variant="muted" />
                    </View>
                    <Text className="text-[11px] text-white/45 uppercase tracking-[0.16em]">
                      {data.entitlementId.slice(0, 8)}
                    </Text>
                  </View>
                  <Text className="text-white text-xl font-semibold">
                    {data.snapshot.title ?? "Entitlement"}
                  </Text>
                  <View className="flex-row items-center gap-2">
                    <Ionicons name="calendar-outline" size={15} color="rgba(255,255,255,0.65)" />
                    <Text className="text-white/70 text-sm">{formatDate(data.snapshot.startAt)}</Text>
                  </View>
                  <View className="flex-row items-center gap-2">
                    <Ionicons name="location-outline" size={15} color="rgba(255,255,255,0.6)" />
                    <Text className="text-white/65 text-sm">{data.snapshot.venueName ?? "Local a anunciar"}</Text>
                  </View>
                </View>
              </GlassCard>

              {qrUrl ? (
                <GlassCard intensity={58} className="mb-4">
                  <View className="items-center gap-3">
                    <Text className="text-white text-sm font-semibold">QR de entrada</Text>
                    <View className="rounded-2xl border border-white/15 bg-white p-3">
                      <Image
                        source={{ uri: qrUrl }}
                        style={{ width: 214, height: 214, borderRadius: 10 }}
                        resizeMode="cover"
                      />
                    </View>
                    <Text className="text-white/65 text-xs text-center">
                      Mostra este QR na entrada. Atualiza se o organizador pedir.
                    </Text>
                  </View>
                </GlassCard>
              ) : (
                <GlassCard intensity={50} className="mb-4">
                  <Text className="text-white/70 text-sm">
                    Este entitlement não tem QR disponível neste momento.
                  </Text>
                </GlassCard>
              )}

              {data.event?.slug ? (
                <Pressable
                  onPress={() => router.push({ pathname: "/event/[slug]", params: { slug: data.event?.slug } })}
                  className="rounded-2xl border border-white/15 bg-white/10 px-4 py-4 mb-4"
                  style={{ minHeight: tokens.layout.touchTarget }}
                >
                  <Text className="text-white text-sm font-semibold text-center">Abrir evento</Text>
                </Pressable>
              ) : null}

              <GlassCard intensity={46}>
                <Text className="text-white/70 text-sm mb-2">Apple Wallet Pass</Text>
                {passUrl ? (
                  <>
                    <Text className="text-white/55 text-xs mb-3">
                      Guarda o bilhete na Apple Wallet e apresenta no check-in.
                    </Text>
                    <Pressable
                      onPress={() => Linking.openURL(passUrl)}
                      className="rounded-xl bg-white/10 px-4 py-3"
                      style={{ minHeight: tokens.layout.touchTarget }}
                    >
                      <Text className="text-white text-sm font-semibold text-center">Adicionar à Wallet</Text>
                    </Pressable>
                  </>
                ) : (
                  <Text className="text-white/55 text-xs">
                    Disponível quando a Wallet estiver ativa para este bilhete.
                  </Text>
                )}
              </GlassCard>
            </Animated.View>
          )}
        </ScrollView>
      </LiquidBackground>
    </>
  );
}
