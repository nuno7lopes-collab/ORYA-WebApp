import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "../../components/icons/Ionicons";
import { tokens } from "@orya/shared";
import { useNavigation } from "@react-navigation/native";
import { GlassCard } from "../../components/liquid/GlassCard";
import { GlassPill } from "../../components/liquid/GlassPill";
import { LiquidBackground } from "../../components/liquid/LiquidBackground";
import { GlassSkeleton } from "../../components/glass/GlassSkeleton";
import { useWalletDetail } from "../../features/wallet/hooks";
import { ApiError } from "../../lib/api";
import { getMobileEnv } from "../../lib/env";
import { safeBack } from "../../lib/navigation";
import { useAuth } from "../../lib/auth";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";

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

const formatShortDate = (value: string | null | undefined) => {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("pt-PT", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
};

const formatRelativeTime = (value: string | null | undefined) => {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return null;
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

const formatMoney = (cents: number | null | undefined, currency?: string | null) => {
  if (typeof cents !== "number" || !Number.isFinite(cents)) return "—";
  if (cents <= 0) return "Grátis";
  const amount = cents / 100;
  return `${amount.toFixed(0)} ${currency?.toUpperCase() || "EUR"}`;
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

const paymentStatusLabel = (value?: string | null) => {
  if (!value) return "—";
  const normalized = value.toUpperCase();
  if (normalized === "PAID") return "Pago";
  if (normalized === "PROCESSING") return "Em processamento";
  if (normalized === "PENDING") return "Pendente";
  if (normalized === "FAILED") return "Falhado";
  if (normalized === "REFUNDED") return "Reembolsado";
  return value;
};

const paymentMethodLabel = (value?: string | null) => {
  if (!value) return "—";
  const normalized = value.toLowerCase();
  if (normalized === "mbway") return "MBWay";
  if (normalized === "card") return "Cartão";
  if (normalized === "apple_pay") return "Apple Pay";
  return value;
};

export default function WalletDetailScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { session } = useAuth();
  const params = useLocalSearchParams<{ entitlementId?: string | string[] }>();
  const entitlementId = useMemo(
    () => (Array.isArray(params.entitlementId) ? params.entitlementId[0] : params.entitlementId) ?? null,
    [params.entitlementId],
  );
  const { data, isLoading, isFetching, isError, error, refetch } = useWalletDetail(entitlementId);
  const fade = useRef(new Animated.Value(0)).current;
  const translate = useRef(new Animated.Value(12)).current;
  const [downloadingPass, setDownloadingPass] = useState(false);

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

  const baseUrl = getMobileEnv().apiBaseUrl.replace(/\/$/, "");
  const qrUrl = data?.qrToken ? `${baseUrl}/api/qr/${encodeURIComponent(data.qrToken)}?theme=dark` : null;
  const passUrl = data?.passUrl ?? null;
  const updatedLabel = formatRelativeTime(data?.audit?.updatedAt);
  const handleBack = () => {
    safeBack(router, navigation, "/(tabs)/tickets");
  };

  const handleOpenWallet = async () => {
    if (!passUrl) return;
    if (!session?.access_token) {
      Alert.alert("Sessão expirada", "Entra novamente para adicionar à Wallet.");
      router.push("/auth");
      return;
    }
    if (downloadingPass) return;
    if (Platform.OS !== "ios") {
      Alert.alert("Apple Wallet", "Disponível apenas no iPhone.");
      return;
    }
    setDownloadingPass(true);
    try {
      const baseDir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
      if (!baseDir) {
        Alert.alert("Wallet", "Não foi possível preparar o ficheiro da Wallet.");
        return;
      }
      const fileUri = `${baseDir}orya-${data?.entitlementId}.pkpass`;
      const result = await FileSystem.downloadAsync(passUrl, fileUri, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        Alert.alert("Não disponível", "Partilha não disponível neste dispositivo.");
        return;
      }
      await Sharing.shareAsync(result.uri, {
        mimeType: "application/vnd.apple.pkpass",
        UTI: "com.apple.pkpass",
      });
    } catch (err: any) {
      Alert.alert("Wallet", err?.message ?? "Não foi possível adicionar à Wallet.");
    } finally {
      setDownloadingPass(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false, animation: "slide_from_right" }} />
      <LiquidBackground variant="solid">
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 34 }}
          refreshControl={<RefreshControl refreshing={isFetching} onRefresh={() => refetch()} tintColor="#fff" />}
        >
          <View className="pt-12 pb-4">
            <Pressable
              onPress={handleBack}
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
                  {updatedLabel ? (
                    <Text className="text-[11px] text-white/45 uppercase tracking-[0.16em]">
                      Atualizado {updatedLabel}
                    </Text>
                  ) : null}
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
                        contentFit="cover"
                        cachePolicy="memory-disk"
                        transition={120}
                      />
                    </View>
                    <Text className="text-white/65 text-xs text-center">
                      QR válido por 1 hora. Atualiza se precisares de um novo.
                    </Text>
                    <Pressable
                      onPress={() => refetch()}
                      disabled={isFetching}
                      className="rounded-full border border-white/15 bg-white/10 px-4 py-2"
                      style={{ minHeight: tokens.layout.touchTarget }}
                    >
                      <Text className="text-white text-xs font-semibold">
                        {isFetching ? "A atualizar..." : "Atualizar QR"}
                      </Text>
                    </Pressable>
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
                <Text className="text-white/70 text-sm mb-2">Apple Wallet</Text>
                {Platform.OS !== "ios" ? (
                  <Text className="text-white/55 text-xs">
                    Disponível apenas no iPhone.
                  </Text>
                ) : passUrl ? (
                  <>
                    <Text className="text-white/55 text-xs mb-3">
                      Guarda o bilhete na Apple Wallet e apresenta no check-in.
                    </Text>
                    <Pressable
                      onPress={handleOpenWallet}
                      disabled={downloadingPass}
                      className="rounded-xl bg-white/10 px-4 py-3"
                      style={{ minHeight: tokens.layout.touchTarget }}
                    >
                      {downloadingPass ? (
                        <View className="flex-row items-center justify-center gap-2">
                          <ActivityIndicator color="white" />
                          <Text className="text-white text-sm font-semibold">A preparar…</Text>
                        </View>
                      ) : (
                        <Text className="text-white text-sm font-semibold text-center">Adicionar à Wallet</Text>
                      )}
                    </Pressable>
                  </>
                ) : (
                  <Text className="text-white/55 text-xs">
                    Disponível quando a Wallet estiver ativa para este bilhete.
                  </Text>
                )}
              </GlassCard>

              {data.payment ? (
                <GlassCard intensity={46} className="mt-4">
                  <Text className="text-white/70 text-sm mb-3">Pagamento</Text>
                  <View className="gap-2">
                    <View className="flex-row items-center justify-between">
                      <Text className="text-white/60 text-xs">Total pago</Text>
                      <Text className="text-white text-sm font-semibold">
                        {formatMoney(data.payment.totalPaidCents, data.payment.currency)}
                      </Text>
                    </View>
                    <View className="flex-row items-center justify-between">
                      <Text className="text-white/60 text-xs">Método</Text>
                      <Text className="text-white/80 text-xs">{paymentMethodLabel(data.payment.paymentMethod)}</Text>
                    </View>
                    <View className="flex-row items-center justify-between">
                      <Text className="text-white/60 text-xs">Estado</Text>
                      <Text className="text-white/80 text-xs">{paymentStatusLabel(data.payment.status)}</Text>
                    </View>
                  </View>
                </GlassCard>
              ) : null}

              {data.refund ? (
                <GlassCard intensity={46} className="mt-4">
                  <Text className="text-white/70 text-sm mb-3">Reembolso</Text>
                  <View className="gap-2">
                    <View className="flex-row items-center justify-between">
                      <Text className="text-white/60 text-xs">Valor</Text>
                      <Text className="text-white text-sm font-semibold">
                        {formatMoney(data.refund.baseAmountCents, data.payment?.currency)}
                      </Text>
                    </View>
                    <View className="flex-row items-center justify-between">
                      <Text className="text-white/60 text-xs">Data</Text>
                      <Text className="text-white/80 text-xs">{formatShortDate(data.refund.refundedAt)}</Text>
                    </View>
                    {data.refund.reason ? (
                      <Text className="text-white/55 text-xs">Motivo: {data.refund.reason}</Text>
                    ) : null}
                  </View>
                </GlassCard>
              ) : null}
            </Animated.View>
          )}
        </ScrollView>
      </LiquidBackground>
    </>
  );
}
