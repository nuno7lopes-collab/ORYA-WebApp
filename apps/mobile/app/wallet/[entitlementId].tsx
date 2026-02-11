import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Platform,
  Pressable,
  RefreshControl,
  Share,
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
import { ApiError, api, unwrapApiResponse } from "../../lib/api";
import { getMobileEnv } from "../../lib/env";
import { safeBack } from "../../lib/navigation";
import { useAuth } from "../../lib/auth";
import { getUserFacingError } from "../../lib/errors";
import { acceptInvite, declineInvite } from "../../features/tournaments/api";
import { useMessageInvites } from "../../features/messages/hooks";
import { acceptMessageInvite } from "../../features/messages/api";
import { useEventChatThread } from "../../features/chat/hooks";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";

const WALLET_DATE_TIME_FORMATTER = new Intl.DateTimeFormat("pt-PT", {
  weekday: "short",
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

const WALLET_SHORT_DATE_FORMATTER = new Intl.DateTimeFormat("pt-PT", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

const WALLET_RELATIVE_FALLBACK_FORMATTER = new Intl.DateTimeFormat("pt-PT", {
  day: "2-digit",
  month: "short",
});

const formatDate = (value: string | null | undefined): string | null => {
  if (!value) return null;
  try {
    return WALLET_DATE_TIME_FORMATTER.format(new Date(value));
  } catch {
    return null;
  }
};

const formatShortDate = (value: string | null | undefined): string | null => {
  if (!value) return null;
  try {
    return WALLET_SHORT_DATE_FORMATTER.format(new Date(value));
  } catch {
    return null;
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
  return WALLET_RELATIVE_FALLBACK_FORMATTER.format(new Date(timestamp));
};

const formatMoney = (cents: number | null | undefined, currency?: string | null): string | null => {
  if (typeof cents !== "number" || !Number.isFinite(cents)) return null;
  if (cents <= 0) return "Grátis";
  const amount = cents / 100;
  return `${amount.toFixed(0)} ${currency?.toUpperCase() || "EUR"}`;
};

const statusLabel = (value: string, consumedAt?: string | null) => {
  if (consumedAt) return "Usado";
  const normalized = value.toUpperCase();
  if (normalized === "ACTIVE") return "Ativo";
  if (normalized === "PENDING") return "Pendente";
  if (normalized === "REVOKED") return "Revogado";
  if (normalized === "SUSPENDED") return "Suspenso";
  if (normalized === "CHARGEBACK_LOST") return "Chargeback";
  if (normalized === "EXPIRED") return "Expirado";
  if (normalized === "CANCELLED") return "Cancelado";
  return value;
};

const typeLabel = (value: string) => {
  const normalized = value.toUpperCase();
  if (normalized === "EVENT_TICKET" || normalized === "TICKET") return "Bilhete";
  if (normalized === "PADEL_ENTRY" || normalized === "REGISTRATION") return "Inscrição";
  if (normalized === "SERVICE_BOOKING" || normalized === "BOOKING") return "Reserva";
  return value;
};

const paymentStatusLabel = (value?: string | null): string | null => {
  if (!value) return null;
  const normalized = value.toUpperCase();
  if (normalized === "PAID") return "Pago";
  if (normalized === "PROCESSING") return "Em processamento";
  if (normalized === "PENDING") return "Pendente";
  if (normalized === "FAILED") return "Falhado";
  if (normalized === "REFUNDED") return "Reembolsado";
  if (normalized === "DISPUTED") return "Em disputa";
  if (normalized === "CHARGEBACK_LOST") return "Chargeback";
  if (normalized === "CHARGEBACK_WON") return "Disputa ganha";
  return value;
};

const paymentMethodLabel = (value?: string | null): string | null => {
  if (!value) return null;
  const normalized = value.toLowerCase();
  if (normalized === "mbway") return "MBWay";
  if (normalized === "card") return "Cartão";
  if (normalized === "apple_pay") return "Apple Pay";
  return value;
};

const pairingPaymentLabel = (value?: string | null): string | null => {
  const normalized = value?.toUpperCase();
  if (normalized === "FULL") return "Pago completo";
  if (normalized === "SPLIT") return "Split";
  return value ?? null;
};

const pairingLifecycleLabel = (value?: string | null): string | null => {
  const normalized = value?.toUpperCase();
  if (normalized === "CONFIRMED_BOTH_PAID" || normalized === "CONFIRMED_CAPTAIN_FULL") {
    return "Confirmado";
  }
  if (normalized === "PENDING_PARTNER_PAYMENT") return "Pagamento pendente";
  if (normalized === "PENDING_ONE_PAID") return "Aguardando parceiro";
  if (normalized === "CANCELLED_INCOMPLETE") return "Cancelado";
  return value ?? null;
};

export default function WalletDetailScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { session } = useAuth();
  const accessToken = session?.access_token ?? null;
  const params = useLocalSearchParams<{ entitlementId?: string | string[] }>();
  const entitlementId = useMemo(
    () => (Array.isArray(params.entitlementId) ? params.entitlementId[0] : params.entitlementId) ?? null,
    [params.entitlementId],
  );
  const nextRoute = useMemo(() => (entitlementId ? `/wallet/${entitlementId}` : "/tickets"), [entitlementId]);
  const openAuth = useCallback(() => {
    router.push({ pathname: "/auth", params: { next: nextRoute } });
  }, [nextRoute, router]);
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
  const qrUrl =
    data?.qrToken && !data?.consumedAt
      ? `${baseUrl}/api/qr/${encodeURIComponent(data.qrToken)}?theme=dark`
      : null;
  const passUrl = data?.passUrl ?? null;
  const shareUrl = data?.event?.slug ? `${baseUrl}/eventos/${data.event.slug}` : null;
  const eventId = data?.event?.id ?? null;
  const canOpenEventChat = Boolean(eventId && data?.consumedAt && session?.user?.id);
  const inviteQuery = useMessageInvites(eventId, canOpenEventChat, accessToken);
  const eventChatQuery = useEventChatThread(eventId, canOpenEventChat, accessToken);
  const pendingInvite = inviteQuery.data?.items?.[0] ?? null;
  const updatedLabel = formatRelativeTime(data?.audit?.updatedAt);
  const consumedAtLabel = formatShortDate(data?.consumedAt);
  const title = data?.snapshot.title ?? (data ? typeLabel(data.type) : "");
  const venueLabel = data?.snapshot.venueName ?? data?.event?.organizationName ?? null;
  const dateLabel = formatDate(data?.snapshot.startAt);
  const qrFallbackLabel = (() => {
    if (!data) return null;
    if (data.consumedAt) return "Este bilhete já foi usado.";
    if (data.actions?.canShowQr) return null;
    if (!data.snapshot.startAt) return null;
    const start = new Date(data.snapshot.startAt);
    if (Number.isNaN(start.getTime())) return null;
    const windowStart = new Date(start.getTime() - 6 * 60 * 60 * 1000);
    const windowLabel = formatShortDate(windowStart.toISOString());
    return windowLabel ? `O QR fica disponível a partir de ${windowLabel}.` : null;
  })();
  const handleBack = () => {
    safeBack(router, navigation, "/tickets");
  };
  const handleShare = async () => {
    if (!data) return;
    try {
      const title = data.snapshot.title ?? "Bilhete ORYA";
      const message = shareUrl ? `${title}\n${shareUrl}` : `${title} · ORYA`;
      await Share.share({ message, url: shareUrl ?? undefined });
    } catch {
      // ignore share errors
    }
  };

  const handleAcceptChatInvite = async () => {
    if (!pendingInvite || !accessToken || !eventId) return;
    try {
      const result = await acceptMessageInvite(pendingInvite.id, accessToken);
      await Promise.all([inviteQuery.refetch(), eventChatQuery.refetch()]);
      if (result?.threadId) {
        router.push({
          pathname: "/messages/[threadId]",
          params: {
            threadId: result.threadId,
            eventId: String(eventId),
            title: data?.snapshot?.title ?? "",
            coverImageUrl: data?.snapshot?.coverUrl ?? "",
            source: "event",
          },
        });
      }
    } catch (err) {
      Alert.alert("Chat", getUserFacingError(err, "Não foi possível aceitar o convite."));
    }
  };

  const handleOpenWallet = async () => {
    if (!passUrl) return;
    if (!session?.access_token) {
      Alert.alert("Sessão expirada", "Entra novamente para adicionar à Wallet.");
      openAuth();
      return;
    }
    if (downloadingPass) return;
    if (Platform.OS !== "ios") {
      Alert.alert("Apple Wallet", "Disponível apenas no iPhone.");
      return;
    }
    setDownloadingPass(true);
    try {
      const baseDir = FileSystem.Paths.cache?.uri ?? FileSystem.Paths.document?.uri ?? null;
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
      Alert.alert("Wallet", getUserFacingError(err, "Não foi possível adicionar à Wallet."));
    } finally {
      setDownloadingPass(false);
    }
  };

  const [pairingAction, setPairingAction] = useState<"accept" | "decline" | null>(null);
  const [resaleAction, setResaleAction] = useState<"list" | "cancel" | null>(null);
  const [localResaleId, setLocalResaleId] = useState<string | null>(null);
  const resaleInfo = data?.resale ?? null;
  const activeResaleId = localResaleId ?? resaleInfo?.activeResaleId ?? null;
  const canListResale = Boolean(resaleInfo?.ticketId && resaleInfo?.canList && !activeResaleId);
  const canCancelResale = Boolean(resaleInfo?.ticketId && (resaleInfo?.canCancel || activeResaleId));
  const suggestedResaleCents = useMemo(() => {
    const paid = data?.payment?.totalPaidCents ?? 0;
    if (Number.isFinite(paid) && paid > 0) {
      return Math.max(100, Math.round(paid * 0.9));
    }
    return 1500;
  }, [data?.payment?.totalPaidCents]);

  const handleAcceptInvite = async () => {
    if (!data?.pairing?.id) return;
    setPairingAction("accept");
    try {
      await acceptInvite(data.pairing.id);
      await refetch();
    } catch (err: any) {
      Alert.alert("Convite", getUserFacingError(err, "Não foi possível aceitar o convite."));
    } finally {
      setPairingAction(null);
    }
  };

  const handleDeclineInvite = async () => {
    if (!data?.pairing?.id) return;
    setPairingAction("decline");
    try {
      await declineInvite(data.pairing.id);
      await refetch();
    } catch (err: any) {
      Alert.alert("Convite", getUserFacingError(err, "Não foi possível recusar o convite."));
    } finally {
      setPairingAction(null);
    }
  };

  const handlePayPairing = () => {
    if (!data?.event?.slug || !data?.pairing?.id) return;
    router.push({
      pathname: "/event/[slug]",
      params: { slug: data.event.slug, pairingId: String(data.pairing.id) },
    });
  };

  const handleListResale = async () => {
    if (!resaleInfo?.ticketId) return;
    setResaleAction("list");
    try {
      const response = await api.request<unknown>("/api/tickets/resale/list", {
        method: "POST",
        body: JSON.stringify({
          ticketId: resaleInfo.ticketId,
          price: suggestedResaleCents,
        }),
      });
      const payload = unwrapApiResponse<{ resaleId?: string }>(response);
      if (payload?.resaleId) {
        setLocalResaleId(payload.resaleId);
      }
      await refetch();
      Alert.alert("Revenda", "Bilhete listado para revenda.");
    } catch (err) {
      Alert.alert("Revenda", getUserFacingError(err, "Não foi possível listar o bilhete."));
    } finally {
      setResaleAction(null);
    }
  };

  const handleCancelResale = async () => {
    if (!activeResaleId) return;
    setResaleAction("cancel");
    try {
      await api.request<unknown>("/api/tickets/resale/cancel", {
        method: "POST",
        body: JSON.stringify({
          resaleId: activeResaleId,
        }),
      });
      setLocalResaleId(null);
      await refetch();
      Alert.alert("Revenda", "Revenda cancelada.");
    } catch (err) {
      Alert.alert("Revenda", getUserFacingError(err, "Não foi possível cancelar a revenda."));
    } finally {
      setResaleAction(null);
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
              accessibilityRole="button"
              accessibilityLabel="Voltar à carteira"
              style={{
                width: tokens.layout.touchTarget,
                height: tokens.layout.touchTarget,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="chevron-back" size={22} color={tokens.colors.text} />
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
                accessibilityRole="button"
                accessibilityLabel="Tentar novamente"
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
                      <GlassPill label={statusLabel(data.status, data.consumedAt)} variant="muted" />
                    </View>
                    <Text className="text-[11px] text-white/45 uppercase tracking-[0.16em]">
                      {data.entitlementId.slice(0, 8)}
                    </Text>
                  </View>
                  {consumedAtLabel && data.consumedAt ? (
                    <Text className="text-[11px] text-white/50 uppercase tracking-[0.16em]">
                      Usado em {consumedAtLabel}
                    </Text>
                  ) : null}
                  {updatedLabel ? (
                    <Text className="text-[11px] text-white/45 uppercase tracking-[0.16em]">
                      Atualizado {updatedLabel}
                    </Text>
                  ) : null}
                  {title ? (
                    <Text className="text-white text-xl font-semibold">
                      {title}
                    </Text>
                  ) : null}
                  {dateLabel ? (
                    <View className="flex-row items-center gap-2">
                      <Ionicons name="calendar-outline" size={15} color="rgba(255,255,255,0.65)" />
                      <Text className="text-white/70 text-sm">{dateLabel}</Text>
                    </View>
                  ) : null}
                  {venueLabel ? (
                    <View className="flex-row items-center gap-2">
                      <Ionicons name="location-outline" size={15} color="rgba(255,255,255,0.6)" />
                      <Text className="text-white/65 text-sm">{venueLabel}</Text>
                    </View>
                  ) : null}
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
                      O QR vale por 1 hora. Se expirar, toca em Atualizar.
                    </Text>
                    <Pressable
                      onPress={() => refetch()}
                      disabled={isFetching}
                      className="rounded-full border border-white/15 bg-white/10 px-4 py-2"
                      style={{ minHeight: tokens.layout.touchTarget }}
                      accessibilityRole="button"
                      accessibilityLabel="Atualizar QR"
                      accessibilityState={{ disabled: isFetching }}
                    >
                      <Text className="text-white text-xs font-semibold">
                        {isFetching ? "A atualizar..." : "Atualizar QR"}
                      </Text>
                    </Pressable>
                  </View>
                </GlassCard>
              ) : qrFallbackLabel ? (
                <GlassCard intensity={50} className="mb-4">
                  <Text className="text-white/70 text-sm">
                    {qrFallbackLabel}
                  </Text>
                </GlassCard>
              ) : null}

              {data.event?.slug ? (
                <Pressable
                  onPress={() => router.push({ pathname: "/event/[slug]", params: { slug: data.event?.slug } })}
                  className="rounded-2xl border border-white/15 bg-white/10 px-4 py-4 mb-4"
                  style={{ minHeight: tokens.layout.touchTarget }}
                  accessibilityRole="button"
                  accessibilityLabel="Abrir evento"
                >
                  <Text className="text-white text-sm font-semibold text-center">Abrir evento</Text>
                </Pressable>
              ) : null}

              {canOpenEventChat ? (
                pendingInvite ? (
                  <GlassCard intensity={54} className="mb-4">
                    <View className="gap-3">
                      <Text className="text-white text-sm font-semibold">Chat do evento</Text>
                      <Text className="text-white/65 text-sm">
                        O chat está disponível após o check-in. Entra para falar com os participantes.
                      </Text>
                      <Pressable
                        onPress={handleAcceptChatInvite}
                        className="rounded-2xl bg-white/90 px-4 py-3"
                        style={{ minHeight: tokens.layout.touchTarget }}
                        accessibilityRole="button"
                        accessibilityLabel="Entrar no chat"
                      >
                        <Text className="text-center text-sm font-semibold" style={{ color: "#0b101a" }}>
                          Entrar no chat
                        </Text>
                      </Pressable>
                    </View>
                  </GlassCard>
                ) : eventChatQuery.data?.thread?.id ? (
                  <Pressable
                    onPress={() =>
                      router.push({
                        pathname: "/messages/[threadId]",
                        params: {
                          threadId: eventChatQuery.data.thread.id,
                          eventId: String(eventId ?? ""),
                          title: data?.snapshot?.title ?? "",
                          coverImageUrl: data?.snapshot?.coverUrl ?? "",
                          source: "event",
                        },
                      })
                    }
                    className="rounded-2xl border border-white/15 bg-white/10 px-4 py-4 mb-4"
                    style={{ minHeight: tokens.layout.touchTarget }}
                    accessibilityRole="button"
                    accessibilityLabel="Abrir chat"
                  >
                    <Text className="text-white text-sm font-semibold text-center">Abrir chat</Text>
                  </Pressable>
                ) : null
              ) : null}

              {data.pairing ? (
                <GlassCard intensity={48} className="mb-4">
                  <View className="gap-3">
                    <View className="flex-row items-center justify-between">
                      <Text className="text-white text-sm font-semibold">Dupla</Text>
                      {pairingPaymentLabel(data.pairing.paymentMode) ? (
                        <GlassPill label={pairingPaymentLabel(data.pairing.paymentMode) as string} variant="muted" />
                      ) : null}
                    </View>
                    {pairingLifecycleLabel(data.pairing.lifecycleStatus) ? (
                      <Text className="text-white/70 text-sm">
                        {pairingLifecycleLabel(data.pairing.lifecycleStatus)}
                      </Text>
                    ) : null}
                    <View className="flex-row flex-wrap gap-2">
                      {data.pairingActions?.canAccept ? (
                        <Pressable
                          onPress={handleAcceptInvite}
                          disabled={pairingAction !== null}
                          className="rounded-full bg-white/15 px-4 py-2"
                          style={{ minHeight: tokens.layout.touchTarget - 8 }}
                          accessibilityRole="button"
                          accessibilityLabel="Aceitar convite"
                          accessibilityState={{ disabled: pairingAction !== null }}
                        >
                          <Text className="text-white text-xs font-semibold">
                            {pairingAction === "accept" ? "A aceitar..." : "Aceitar convite"}
                          </Text>
                        </Pressable>
                      ) : null}
                      {data.pairingActions?.canDecline ? (
                        <Pressable
                          onPress={handleDeclineInvite}
                          disabled={pairingAction !== null}
                          className="rounded-full border border-white/15 bg-white/5 px-4 py-2"
                          style={{ minHeight: tokens.layout.touchTarget - 8 }}
                          accessibilityRole="button"
                          accessibilityLabel="Recusar convite"
                          accessibilityState={{ disabled: pairingAction !== null }}
                        >
                          <Text className="text-white/80 text-xs font-semibold">
                            {pairingAction === "decline" ? "A recusar..." : "Recusar"}
                          </Text>
                        </Pressable>
                      ) : null}
                      {data.pairingActions?.canPay ? (
                        <Pressable
                          onPress={handlePayPairing}
                          disabled={pairingAction !== null}
                          className="rounded-full border border-white/15 bg-white/10 px-4 py-2"
                          style={{ minHeight: tokens.layout.touchTarget - 8 }}
                          accessibilityRole="button"
                          accessibilityLabel="Pagar inscrição"
                          accessibilityState={{ disabled: pairingAction !== null }}
                        >
                          <Text className="text-white text-xs font-semibold">
                            Pagar inscrição
                          </Text>
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                </GlassCard>
              ) : null}

              {resaleInfo?.ticketId ? (
                <GlassCard intensity={46} className="mb-4">
                  <View className="gap-3">
                    <View className="flex-row items-center justify-between">
                      <Text className="text-white text-sm font-semibold">Revenda</Text>
                      <GlassPill label={activeResaleId ? "LISTED" : "OFF"} variant="muted" />
                    </View>
                    <Text className="text-white/60 text-xs">
                      Preço sugerido: {formatMoney(suggestedResaleCents, data.payment?.currency ?? "EUR")}
                    </Text>
                    <View className="flex-row flex-wrap gap-2">
                      {canListResale ? (
                        <Pressable
                          onPress={handleListResale}
                          disabled={resaleAction !== null}
                          className="rounded-full border border-emerald-300/35 bg-emerald-400/15 px-4 py-2"
                          style={{ minHeight: tokens.layout.touchTarget - 8 }}
                          accessibilityRole="button"
                          accessibilityLabel="Listar para revenda"
                          accessibilityState={{ disabled: resaleAction !== null }}
                        >
                          <Text className="text-emerald-100 text-xs font-semibold">
                            {resaleAction === "list" ? "A listar..." : "Listar para revenda"}
                          </Text>
                        </Pressable>
                      ) : null}
                      {canCancelResale ? (
                        <Pressable
                          onPress={handleCancelResale}
                          disabled={resaleAction !== null || !activeResaleId}
                          className="rounded-full border border-white/15 bg-white/5 px-4 py-2"
                          style={{ minHeight: tokens.layout.touchTarget - 8 }}
                          accessibilityRole="button"
                          accessibilityLabel="Cancelar revenda"
                          accessibilityState={{ disabled: resaleAction !== null || !activeResaleId }}
                        >
                          <Text className="text-white/85 text-xs font-semibold">
                            {resaleAction === "cancel" ? "A cancelar..." : "Cancelar revenda"}
                          </Text>
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                </GlassCard>
              ) : null}

              <Pressable
                onPress={handleShare}
                className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 mb-4"
                style={{ minHeight: tokens.layout.touchTarget }}
                accessibilityRole="button"
                accessibilityLabel="Partilhar"
              >
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  <Ionicons name="share-outline" size={16} color="rgba(255,255,255,0.9)" />
                  <Text className="text-white text-sm font-semibold">Partilhar</Text>
                </View>
              </Pressable>

              {Platform.OS === "ios" && passUrl ? (
                <GlassCard intensity={46}>
                  <Text className="text-white/70 text-sm mb-2">Apple Wallet</Text>
                  <Text className="text-white/55 text-xs mb-3">
                    Guarda o bilhete na Apple Wallet e apresenta no check-in.
                  </Text>
                  <Pressable
                    onPress={handleOpenWallet}
                    disabled={downloadingPass}
                    className="rounded-xl bg-white/10 px-4 py-3"
                    style={{ minHeight: tokens.layout.touchTarget }}
                    accessibilityRole="button"
                    accessibilityLabel="Adicionar à Wallet"
                    accessibilityState={{ disabled: downloadingPass }}
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
                </GlassCard>
              ) : null}

              {data.payment ? (
                <GlassCard intensity={46} className="mt-4">
                  <Text className="text-white/70 text-sm mb-3">Pagamento</Text>
                  <View className="gap-2">
                    {formatMoney(data.payment.totalPaidCents, data.payment.currency) ? (
                      <View className="flex-row items-center justify-between">
                        <Text className="text-white/60 text-xs">Total pago</Text>
                        <Text className="text-white text-sm font-semibold">
                          {formatMoney(data.payment.totalPaidCents, data.payment.currency)}
                        </Text>
                      </View>
                    ) : null}
                    {paymentMethodLabel(data.payment.paymentMethod) ? (
                      <View className="flex-row items-center justify-between">
                        <Text className="text-white/60 text-xs">Método</Text>
                        <Text className="text-white/80 text-xs">
                          {paymentMethodLabel(data.payment.paymentMethod)}
                        </Text>
                      </View>
                    ) : null}
                    {paymentStatusLabel(data.payment.status) ? (
                      <View className="flex-row items-center justify-between">
                        <Text className="text-white/60 text-xs">Estado</Text>
                        <Text className="text-white/80 text-xs">
                          {paymentStatusLabel(data.payment.status)}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </GlassCard>
              ) : null}

              {data.refund && formatMoney(data.refund.baseAmountCents, data.payment?.currency) ? (
                <GlassCard intensity={46} className="mt-4">
                  <Text className="text-white/70 text-sm mb-3">Reembolso</Text>
                  <View className="gap-2">
                    <View className="flex-row items-center justify-between">
                      <Text className="text-white/60 text-xs">Valor</Text>
                      <Text className="text-white text-sm font-semibold">
                        {formatMoney(data.refund.baseAmountCents, data.payment?.currency)}
                      </Text>
                    </View>
                    {formatShortDate(data.refund.refundedAt) ? (
                      <View className="flex-row items-center justify-between">
                        <Text className="text-white/60 text-xs">Data</Text>
                        <Text className="text-white/80 text-xs">
                          {formatShortDate(data.refund.refundedAt)}
                        </Text>
                      </View>
                    ) : null}
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
