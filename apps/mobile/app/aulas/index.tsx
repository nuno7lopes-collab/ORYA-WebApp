import { useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useNavigation } from "@react-navigation/native";
import { tokens } from "@orya/shared";
import { LiquidBackground } from "../../components/liquid/LiquidBackground";
import { TopAppHeader } from "../../components/navigation/TopAppHeader";
import { useTopHeaderPadding } from "../../components/navigation/useTopHeaderPadding";
import { useTopBarScroll } from "../../components/navigation/useTopBarScroll";
import { Ionicons } from "../../components/icons/Ionicons";
import { useAuth } from "../../lib/auth";
import { safeBack, safePush } from "../../lib/navigation";
import { TAB_PATHNAMES } from "../../lib/tabRoutes";
import { getUserFacingError } from "../../lib/errors";
import { getMobileEnv } from "../../lib/env";
import { cancelBooking } from "../../features/bookings/api";
import { useMyClassEnrollments } from "../../features/bookings/hooks";
import type { ClassEnrollmentItem } from "../../features/bookings/types";

const normalizeImageUrl = (value?: string | null) => {
  if (!value) return null;
  if (/^https?:\/\//i.test(value) || value.startsWith("data:")) return value;
  const base = getMobileEnv().apiBaseUrl.replace(/\/+$/, "");
  return `${base}${value.startsWith("/") ? "" : "/"}${value}`;
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "Data por definir";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Data por definir";
  return parsed.toLocaleString("pt-PT", { dateStyle: "medium", timeStyle: "short" });
};

const resolveStatusLabel = (item: ClassEnrollmentItem) => {
  const sessionStatus = String(item.sessionStatus ?? "").toUpperCase();
  if (sessionStatus === "CANCELLED") return "Cancelada";
  if (item.isFull) return "Cheia";
  const enrollmentStatus = String(item.status ?? "").toUpperCase();
  if (enrollmentStatus === "CANCELLED") return "Cancelada";
  if (enrollmentStatus === "PENDING") return "Pendente";
  return "Confirmada";
};

const splitByTimeline = (items: ClassEnrollmentItem[]) => {
  const now = Date.now();
  const upcoming: ClassEnrollmentItem[] = [];
  const history: ClassEnrollmentItem[] = [];
  items.forEach((item) => {
    const startsAt = new Date(item.startsAt).getTime();
    const cancelled = String(item.status ?? "").toUpperCase() === "CANCELLED";
    if (!Number.isFinite(startsAt) || startsAt < now || cancelled) {
      history.push(item);
      return;
    }
    upcoming.push(item);
  });
  return {
    upcoming: upcoming.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()),
    history: history.sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime()),
  };
};

export default function AulasScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const topPadding = useTopHeaderPadding(16);
  const topBar = useTopBarScroll({ hideOnScroll: false });
  const { session } = useAuth();
  const accessReady = Boolean(session?.user?.id);
  const enrollmentsQuery = useMyClassEnrollments(accessReady);
  const [cancelingBookingId, setCancelingBookingId] = useState<number | null>(null);

  const timeline = useMemo(
    () => splitByTimeline(enrollmentsQuery.data ?? []),
    [enrollmentsQuery.data],
  );

  const runCancel = async (bookingId: number) => {
    try {
      setCancelingBookingId(bookingId);
      await cancelBooking(bookingId);
      await enrollmentsQuery.refetch();
      Alert.alert("Aula cancelada", "A inscrição foi cancelada com sucesso.");
    } catch (err) {
      Alert.alert("Cancelamento", getUserFacingError(err, "Não foi possível cancelar a inscrição."));
    } finally {
      setCancelingBookingId(null);
    }
  };

  const renderCard = (item: ClassEnrollmentItem, section: "upcoming" | "history") => {
    const cover = normalizeImageUrl(item.class?.coverImageUrl ?? null);
    const trainerAvatar = normalizeImageUrl(item.trainer?.avatarUrl ?? null);
    const statusLabel = resolveStatusLabel(item);
    const canCancel =
      section === "upcoming" &&
      item.cancellation.allowed &&
      item.booking?.id != null;

    return (
      <View
        key={`class-enrollment-${item.id}`}
        className="rounded-2xl border border-white/14 bg-white/6 p-3"
      >
        {cover ? (
          <Image
            source={{ uri: cover }}
            style={{ width: "100%", height: 128, borderRadius: 14, marginBottom: 10 }}
            contentFit="cover"
            transition={120}
          />
        ) : null}

        <View className="flex-row items-start justify-between gap-3">
          <View style={{ flex: 1 }}>
            <Text className="text-white text-sm font-semibold">{item.class.title}</Text>
            <Text className="text-white/70 text-xs mt-1">{formatDateTime(item.startsAt)}</Text>
            <Text className="text-white/60 text-xs mt-1">
              {item.organization.publicName ?? item.organization.businessName ?? item.organization.username ?? "Clube"}
              {item.court?.name ? ` · ${item.court.name}` : ""}
            </Text>
          </View>
          <View className="rounded-full border border-white/20 bg-white/10 px-2 py-1">
            <Text className="text-white/80 text-[10px] font-semibold uppercase tracking-[0.12em]">
              {statusLabel}
            </Text>
          </View>
        </View>

        <View className="mt-3 flex-row items-center gap-2">
          {trainerAvatar ? (
            <Image
              source={{ uri: trainerAvatar }}
              style={{ width: 24, height: 24, borderRadius: 12 }}
              contentFit="cover"
              transition={100}
            />
          ) : (
            <View className="h-6 w-6 items-center justify-center rounded-full border border-white/20 bg-white/10">
              <Ionicons name="person" size={13} color="rgba(240,247,255,0.9)" />
            </View>
          )}
          <Text className="text-white/75 text-xs">
            {item.trainer?.name ?? "Treinador por definir"}
          </Text>
          <Text className="text-white/55 text-xs">· {item.enrolledCount}/{item.capacity}</Text>
        </View>

        {canCancel ? (
          <Pressable
            onPress={() => {
              if (!item.booking?.id) return;
              void runCancel(item.booking.id);
            }}
            disabled={cancelingBookingId === item.booking?.id}
            className="mt-3 rounded-xl border border-rose-300/40 bg-rose-500/12 px-3 py-2"
            style={{ minHeight: tokens.layout.touchTarget }}
            accessibilityRole="button"
            accessibilityLabel="Cancelar inscrição"
          >
            <Text className="text-rose-100 text-xs font-semibold text-center">
              {cancelingBookingId === item.booking?.id ? "A cancelar..." : "Cancelar inscrição"}
            </Text>
          </Pressable>
        ) : null}
      </View>
    );
  };

  return (
    <LiquidBackground>
      <TopAppHeader
        scrollState={topBar}
        variant="title"
        title="Aulas"
        leftSlot={
          <Pressable
            onPress={() => safeBack(router, navigation, TAB_PATHNAMES.reservas)}
            accessibilityRole="button"
            accessibilityLabel="Voltar"
            style={({ pressed }) => [
              {
                width: tokens.layout.touchTarget,
                height: tokens.layout.touchTarget,
                minHeight: tokens.layout.touchTarget,
                borderRadius: tokens.layout.touchTarget / 2,
                alignItems: "center",
                justifyContent: "center",
              },
              pressed ? { opacity: 0.8 } : null,
            ]}
          >
            <Ionicons name="chevron-back" size={20} color="rgba(240,247,255,0.95)" />
          </Pressable>
        }
        showNotifications
        showMessages={false}
      />
      <ScrollView
        contentContainerStyle={{ paddingTop: topPadding, paddingBottom: 24, paddingHorizontal: 20, gap: 12 }}
        onScroll={topBar.onScroll}
        onScrollEndDrag={topBar.onScrollEndDrag}
        onMomentumScrollEnd={topBar.onMomentumScrollEnd}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        {!accessReady ? (
          <View className="rounded-2xl border border-white/14 bg-white/6 px-4 py-4 gap-2">
            <Text className="text-white text-sm font-semibold">Inicia sessão para ver as tuas aulas.</Text>
            <Pressable
              onPress={() => safePush(router, { pathname: "/auth", params: { next: "/aulas" } })}
              className="mt-2 self-start rounded-full border border-white/20 bg-white/90 px-4 py-2.5"
              accessibilityRole="button"
              accessibilityLabel="Iniciar sessão"
            >
              <Text className="text-[#0b1014] text-xs font-semibold">Iniciar sessão</Text>
            </Pressable>
          </View>
        ) : enrollmentsQuery.isLoading ? (
          <View className="py-6">
            <ActivityIndicator color="rgba(255,255,255,0.9)" />
          </View>
        ) : enrollmentsQuery.isError ? (
          <View className="rounded-2xl border border-rose-300/40 bg-rose-500/12 px-4 py-4 gap-2">
            <Text className="text-rose-100 text-sm font-semibold">Não foi possível carregar as aulas.</Text>
            <Pressable
              onPress={() => enrollmentsQuery.refetch()}
              className="self-start rounded-full border border-white/20 bg-white/8 px-4 py-2"
              accessibilityRole="button"
              accessibilityLabel="Tentar novamente"
            >
              <Text className="text-white/85 text-xs font-semibold">Tentar novamente</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View className="gap-3">
              <View>
                <Text className="text-white text-sm font-semibold">Próximas</Text>
                <Text className="text-white/65 text-xs">As tuas inscrições ativas por sessão.</Text>
              </View>
              {timeline.upcoming.length === 0 ? (
                <View className="rounded-2xl border border-white/14 bg-white/6 px-4 py-4">
                  <Text className="text-white/70 text-xs">Sem aulas próximas.</Text>
                </View>
              ) : (
                timeline.upcoming.map((item) => renderCard(item, "upcoming"))
              )}
            </View>

            <View className="gap-3">
              <View>
                <Text className="text-white text-sm font-semibold">Histórico</Text>
                <Text className="text-white/65 text-xs">Aulas concluídas, passadas ou canceladas.</Text>
              </View>
              {timeline.history.length === 0 ? (
                <View className="rounded-2xl border border-white/14 bg-white/6 px-4 py-4">
                  <Text className="text-white/70 text-xs">Sem histórico de aulas.</Text>
                </View>
              ) : (
                timeline.history.map((item) => renderCard(item, "history"))
              )}
            </View>
          </>
        )}
      </ScrollView>
    </LiquidBackground>
  );
}
