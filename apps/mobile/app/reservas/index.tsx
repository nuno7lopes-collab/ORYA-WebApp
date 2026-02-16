import { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { tokens } from "@orya/shared";
import { LiquidBackground } from "../../components/liquid/LiquidBackground";
import { TopAppHeader } from "../../components/navigation/TopAppHeader";
import { GlassCard } from "../../components/liquid/GlassCard";
import { GlassSkeleton } from "../../components/glass/GlassSkeleton";
import { Ionicons } from "../../components/icons/Ionicons";
import { useTopHeaderPadding } from "../../components/navigation/useTopHeaderPadding";
import { useTopBarScroll } from "../../components/navigation/useTopBarScroll";
import { useAuth } from "../../lib/auth";
import { safeBack } from "../../lib/navigation";
import { getUserFacingError } from "../../lib/errors";
import {
  cancelBooking,
  previewBookingCancellation,
  respondBookingChangeRequest,
} from "../../features/bookings/api";
import { useMyBookings } from "../../features/bookings/hooks";
import type { BookingItem } from "../../features/bookings/types";
import { splitBookingsByTimeline } from "../../features/bookings/types";

const formatDateTime = (value?: string | null) => {
  if (!value) return "Data por definir";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Data por definir";
  return parsed.toLocaleString("pt-PT", { dateStyle: "medium", timeStyle: "short" });
};

const formatMoney = (amountCents?: number | null, currency = "EUR") => {
  if (typeof amountCents !== "number" || !Number.isFinite(amountCents)) return "-";
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency }).format(amountCents / 100);
};

const bookingStatusLabel = (status?: string | null) => {
  const normalized = (status ?? "").toUpperCase();
  if (normalized === "PENDING" || normalized === "PENDING_CONFIRMATION") return "Pendente";
  if (normalized === "CONFIRMED") return "Confirmada";
  if (normalized === "COMPLETED") return "Concluída";
  if (normalized === "NO_SHOW") return "No-show";
  if (normalized === "DISPUTED") return "Em disputa";
  if (normalized.startsWith("CANCELLED")) return "Cancelada";
  return status ?? "Estado";
};

const bookingOrganizationLabel = (booking: BookingItem) =>
  booking.organization?.publicName?.trim() ||
  booking.organization?.businessName?.trim() ||
  booking.organization?.username?.trim() ||
  "Organização";

export default function BookingsScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ bookingId?: string | string[] }>();
  const focusBookingIdRaw = Array.isArray(params.bookingId) ? params.bookingId[0] : params.bookingId;
  const focusBookingId = Number(focusBookingIdRaw);
  const topPadding = useTopHeaderPadding(14);
  const topBar = useTopBarScroll();
  const { session } = useAuth();
  const accessReady = Boolean(session?.user?.id);
  const bookingsQuery = useMyBookings(accessReady);
  const [cancelingBookingId, setCancelingBookingId] = useState<number | null>(null);
  const [respondingRequestId, setRespondingRequestId] = useState<number | null>(null);

  const bookings = bookingsQuery.data ?? [];
  const timeline = useMemo(() => splitBookingsByTimeline(bookings), [bookings]);
  const activeBookings = useMemo(() => {
    if (!Number.isFinite(focusBookingId)) return timeline.active;
    const id = Number(focusBookingId);
    const focused = timeline.active.find((booking) => booking.id === id);
    if (!focused) return timeline.active;
    const remaining = timeline.active.filter((booking) => booking.id !== id);
    return [focused, ...remaining];
  }, [focusBookingId, timeline.active]);

  const runCancel = async (bookingId: number) => {
    try {
      setCancelingBookingId(bookingId);
      await cancelBooking(bookingId);
      await bookingsQuery.refetch();
      Alert.alert("Reserva cancelada", "A reserva foi cancelada com sucesso.");
    } catch (err) {
      Alert.alert("Cancelamento", getUserFacingError(err, "Não foi possível cancelar a reserva."));
    } finally {
      setCancelingBookingId(null);
    }
  };

  const handleCancelPress = async (bookingId: number) => {
    if (cancelingBookingId || respondingRequestId) return;
    try {
      const preview = await previewBookingCancellation(bookingId);
      if (!preview.allowed) {
        Alert.alert(
          "Cancelamento indisponível",
          preview.deadline
            ? `O prazo de cancelamento terminou em ${formatDateTime(preview.deadline)}.`
            : "Esta reserva já não pode ser cancelada.",
        );
        return;
      }

      const details: string[] = [];
      if (preview.deadline) {
        details.push(`Podes cancelar até ${formatDateTime(preview.deadline)}.`);
      }
      if (preview.refund) {
        details.push(`Reembolso estimado: ${formatMoney(preview.refund.refundCents, preview.refund.currency)}.`);
      }

      Alert.alert(
        "Cancelar reserva",
        details.length ? details.join("\n") : "Queres cancelar esta reserva?",
        [
          { text: "Manter", style: "cancel" },
          {
            text: "Cancelar reserva",
            style: "destructive",
            onPress: () => {
              void runCancel(bookingId);
            },
          },
        ],
      );
    } catch (err) {
      Alert.alert("Cancelamento", getUserFacingError(err, "Não foi possível validar o cancelamento."));
    }
  };

  const handleChangeRequest = async (booking: BookingItem, action: "ACCEPT" | "DECLINE") => {
    if (!booking.changeRequest) return;
    try {
      setRespondingRequestId(booking.changeRequest.id);
      const result = await respondBookingChangeRequest({
        bookingId: booking.id,
        requestId: booking.changeRequest.id,
        action,
      });
      await bookingsQuery.refetch();

      if (action === "ACCEPT" && result.payment?.clientSecret) {
        Alert.alert(
          "Alteração aceite",
          "A alteração foi aceite e exige pagamento adicional. Conclui o pagamento no checkout para finalizar o reagendamento.",
        );
        return;
      }

      Alert.alert(
        "Pedido atualizado",
        action === "ACCEPT" ? "A proposta de alteração foi aceite." : "A proposta de alteração foi recusada.",
      );
    } catch (err) {
      Alert.alert("Alteração", getUserFacingError(err, "Não foi possível responder ao pedido."));
    } finally {
      setRespondingRequestId(null);
    }
  };

  const backButton = (
    <Pressable
      onPress={() => safeBack(router, navigation, "/(tabs)/profile")}
      accessibilityRole="button"
      accessibilityLabel="Voltar"
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

  const renderBookingCard = (booking: BookingItem, section: "active" | "history") => {
    const showCancelAction = section === "active" && booking.cancellation.allowed;
    const pendingRequest = booking.changeRequest?.status === "PENDING" ? booking.changeRequest : null;
    const isFocused = Number.isFinite(focusBookingId) && booking.id === Number(focusBookingId);
    return (
      <GlassCard key={`booking-${booking.id}`} intensity={section === "active" ? 58 : 48}>
        <View
          className="gap-2 rounded-2xl border px-3 py-3"
          style={{
            borderColor: isFocused ? "rgba(192,235,255,0.55)" : "rgba(255,255,255,0.12)",
            backgroundColor: isFocused ? "rgba(143,223,255,0.12)" : "rgba(255,255,255,0.04)",
          }}
        >
          <View className="flex-row items-start justify-between gap-3">
            <View style={{ flex: 1 }}>
              <Text className="text-white text-sm font-semibold">
                {booking.service?.title?.trim() || "Reserva de serviço"}
              </Text>
              <Text className="text-white/65 text-xs">{bookingOrganizationLabel(booking)}</Text>
            </View>
            <View className="rounded-full border border-white/15 bg-white/10 px-2 py-1">
              <Text className="text-white/80 text-[10px] font-semibold uppercase tracking-[0.12em]">
                {bookingStatusLabel(booking.status)}
              </Text>
            </View>
          </View>

          <Text className="text-white/80 text-xs">
            {formatDateTime(booking.startsAt)} · {booking.durationMinutes} min
          </Text>
          <Text className="text-white/60 text-xs">{formatMoney(booking.price, booking.currency)}</Text>

          {booking.estimatedStartsAt && booking.delayMinutes && booking.delayMinutes > 0 ? (
            <Text className="text-amber-200 text-xs">
              Início estimado: {formatDateTime(booking.estimatedStartsAt)} ({booking.delayMinutes} min de atraso)
            </Text>
          ) : null}

          {pendingRequest ? (
            <View className="mt-1 rounded-xl border border-amber-300/35 bg-amber-400/10 px-3 py-2">
              <Text className="text-amber-100 text-xs font-semibold">Pedido de alteração pendente</Text>
              <Text className="text-amber-100/85 text-xs mt-1">
                Nova data: {formatDateTime(pendingRequest.proposedStartsAt)}
              </Text>
              <Text className="text-amber-100/75 text-xs mt-1">
                Responder até {formatDateTime(pendingRequest.expiresAt)}
              </Text>
              <View className="mt-2 flex-row gap-2">
                <Pressable
                  onPress={() => void handleChangeRequest(booking, "DECLINE")}
                  disabled={respondingRequestId === pendingRequest.id}
                  className="flex-1 rounded-xl border border-white/20 bg-white/5 px-3 py-2"
                  accessibilityRole="button"
                  accessibilityLabel="Recusar alteração"
                >
                  <Text className="text-white text-xs font-semibold text-center">
                    {respondingRequestId === pendingRequest.id ? "A processar..." : "Recusar"}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => void handleChangeRequest(booking, "ACCEPT")}
                  disabled={respondingRequestId === pendingRequest.id}
                  className="flex-1 rounded-xl bg-white/90 px-3 py-2"
                  accessibilityRole="button"
                  accessibilityLabel="Aceitar alteração"
                >
                  <Text className="text-[#0b1014] text-xs font-semibold text-center">
                    {respondingRequestId === pendingRequest.id ? "A processar..." : "Aceitar"}
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          {showCancelAction ? (
            <Pressable
              onPress={() => void handleCancelPress(booking.id)}
              disabled={cancelingBookingId === booking.id}
              className="mt-2 rounded-xl border border-rose-300/40 bg-rose-500/12 px-3 py-2"
              accessibilityRole="button"
              accessibilityLabel="Cancelar reserva"
            >
              <Text className="text-rose-100 text-xs font-semibold text-center">
                {cancelingBookingId === booking.id ? "A cancelar..." : "Cancelar reserva"}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </GlassCard>
    );
  };

  return (
    <LiquidBackground>
      <TopAppHeader
        scrollState={topBar}
        variant="title"
        title="Reservas"
        titleAlign="center"
        leftSlot={backButton}
        showNotifications
        showMessages={false}
      />
      <ScrollView
        contentContainerStyle={{
          paddingTop: topPadding,
          paddingBottom: insets.bottom + 24,
          paddingHorizontal: 20,
          gap: 12,
        }}
        onScroll={topBar.onScroll}
        onScrollEndDrag={topBar.onScrollEndDrag}
        onMomentumScrollEnd={topBar.onMomentumScrollEnd}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        {!accessReady ? (
          <GlassCard intensity={56}>
            <Text className="text-white text-sm font-semibold">Inicia sessão para ver as tuas reservas.</Text>
            <Pressable
              onPress={() => router.push({ pathname: "/auth", params: { next: "/reservas" } })}
              className="mt-3 rounded-xl bg-white/90 px-4 py-3"
              accessibilityRole="button"
              accessibilityLabel="Iniciar sessão"
            >
              <Text className="text-[#0b1014] text-center text-sm font-semibold">Iniciar sessão</Text>
            </Pressable>
          </GlassCard>
        ) : bookingsQuery.isLoading ? (
          <View className="gap-3">
            <GlassSkeleton height={120} />
            <GlassSkeleton height={120} />
          </View>
        ) : bookingsQuery.isError ? (
          <GlassCard intensity={56}>
            <Text className="text-red-200 text-sm font-semibold">Não foi possível carregar reservas.</Text>
            <Pressable
              onPress={() => bookingsQuery.refetch()}
              className="mt-3 rounded-xl border border-white/15 bg-white/8 px-4 py-3"
              accessibilityRole="button"
              accessibilityLabel="Tentar novamente"
            >
              <Text className="text-white text-center text-sm font-semibold">Tentar novamente</Text>
            </Pressable>
          </GlassCard>
        ) : (
          <View className="gap-3">
            <GlassCard intensity={54}>
              <View className="flex-row items-center justify-between gap-3">
                <View>
                  <Text className="text-white text-sm font-semibold">Timeline pessoal</Text>
                  <Text className="text-white/65 text-xs">Ativos e histórico de reservas de serviço.</Text>
                </View>
                <View className="items-end">
                  <Text className="text-white/85 text-xs">Ativos: {activeBookings.length}</Text>
                  <Text className="text-white/60 text-xs">Histórico: {timeline.history.length}</Text>
                </View>
              </View>
            </GlassCard>

            {activeBookings.length === 0 && timeline.history.length === 0 ? (
              <GlassCard intensity={50}>
                <Text className="text-white/70 text-sm">Ainda não tens reservas de serviço.</Text>
                <Pressable
                  onPress={() => router.push("/search")}
                  className="mt-3 rounded-xl border border-white/15 bg-white/8 px-4 py-3"
                  accessibilityRole="button"
                  accessibilityLabel="Explorar serviços"
                >
                  <Text className="text-white text-center text-sm font-semibold">Explorar serviços</Text>
                </Pressable>
              </GlassCard>
            ) : null}

            {activeBookings.length > 0 ? (
              <View className="gap-2">
                <Text className="text-white text-sm font-semibold">Ativas</Text>
                {activeBookings.map((booking) => renderBookingCard(booking, "active"))}
              </View>
            ) : null}

            {timeline.history.length > 0 ? (
              <View className="gap-2">
                <Text className="text-white/85 text-sm font-semibold">Histórico</Text>
                {timeline.history.map((booking) => renderBookingCard(booking, "history"))}
              </View>
            ) : null}
          </View>
        )}
      </ScrollView>
    </LiquidBackground>
  );
}
