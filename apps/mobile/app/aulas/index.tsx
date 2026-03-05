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

const resolveStatus = (item: ClassEnrollmentItem) => {
  const sessionStatus = String(item.sessionStatus ?? "").toUpperCase();
  const enrollmentStatus = String(item.status ?? "").toUpperCase();

  if (sessionStatus === "CANCELLED" || enrollmentStatus === "CANCELLED") {
    return {
      label: "Cancelada",
      className: "border-rose-300/45 bg-rose-500/18 text-rose-50",
    };
  }
  if (item.isFull) {
    return {
      label: "Cheia",
      className: "border-amber-200/45 bg-amber-500/18 text-amber-50",
    };
  }
  if (enrollmentStatus === "PENDING") {
    return {
      label: "Pendente",
      className: "border-sky-200/45 bg-sky-500/18 text-sky-50",
    };
  }
  return {
    label: "Confirmada",
    className: "border-emerald-200/45 bg-emerald-500/18 text-emerald-50",
  };
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
  const [activeTab, setActiveTab] = useState<"upcoming" | "history">("upcoming");

  const timeline = useMemo(
    () => splitByTimeline(enrollmentsQuery.data ?? []),
    [enrollmentsQuery.data],
  );

  const activeItems = activeTab === "upcoming" ? timeline.upcoming : timeline.history;

  const runCancel = async (bookingId: number) => {
    try {
      setCancelingBookingId(bookingId);
      await cancelBooking(bookingId);
      await enrollmentsQuery.refetch();
      Alert.alert("Inscrição cancelada", "A tua inscrição foi cancelada.");
    } catch (err) {
      Alert.alert("Cancelamento", getUserFacingError(err, "Não foi possível cancelar."));
    } finally {
      setCancelingBookingId(null);
    }
  };

  const renderCard = (item: ClassEnrollmentItem, section: "upcoming" | "history") => {
    const cover = normalizeImageUrl(item.class?.coverImageUrl ?? null);
    const trainerAvatar = normalizeImageUrl(item.trainer?.avatarUrl ?? null);
    const status = resolveStatus(item);
    const canCancel =
      section === "upcoming" &&
      item.cancellation.allowed &&
      item.booking?.id != null;

    return (
      <View
        key={`class-enrollment-${item.id}`}
        className="overflow-hidden rounded-[22px] border border-white/14 bg-white/6"
      >
        <View className="relative h-32">
          {cover ? (
            <Image
              source={{ uri: cover }}
              style={{ width: "100%", height: "100%" }}
              contentFit="cover"
              transition={130}
            />
          ) : (
            <View className="h-full w-full bg-white/8" />
          )}
          <View className="absolute inset-0 bg-black/40" />
          <View className="absolute left-3 top-3 rounded-full border border-white/25 bg-black/35 px-2 py-1">
            <Text className="text-white text-[10px] font-semibold">{formatDateTime(item.startsAt)}</Text>
          </View>
          <View className={`absolute right-3 top-3 rounded-full border px-2 py-1 ${status.className}`}>
            <Text className="text-[10px] font-semibold">{status.label}</Text>
          </View>
        </View>

        <View className="gap-2.5 p-3">
          <Text className="text-white text-sm font-semibold" numberOfLines={1}>
            {item.class.title}
          </Text>

          <View className="flex-row items-center gap-2">
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
            <Text className="text-white/78 text-xs" numberOfLines={1}>
              {item.trainer?.name ?? "Treinador por definir"}
            </Text>
          </View>

          <View className="flex-row flex-wrap gap-1.5">
            {item.court?.name ? (
              <View className="rounded-full border border-white/20 bg-white/10 px-2 py-1">
                <Text className="text-white/75 text-[10px]">{item.court.name}</Text>
              </View>
            ) : null}
            <View className="rounded-full border border-white/20 bg-white/10 px-2 py-1">
              <Text className="text-white/75 text-[10px]">{item.enrolledCount}/{item.capacity}</Text>
            </View>
            <View className="rounded-full border border-white/20 bg-white/10 px-2 py-1">
              <Text className="text-white/75 text-[10px]" numberOfLines={1}>
                {item.organization.publicName ?? item.organization.businessName ?? item.organization.username ?? "Clube"}
              </Text>
            </View>
          </View>

          {canCancel ? (
            <Pressable
              onPress={() => {
                if (!item.booking?.id) return;
                void runCancel(item.booking.id);
              }}
              disabled={cancelingBookingId === item.booking?.id}
              className="rounded-xl border border-rose-300/45 bg-rose-500/14 px-3 py-2"
              style={{ minHeight: tokens.layout.touchTarget }}
              accessibilityRole="button"
              accessibilityLabel="Cancelar inscrição"
            >
              <Text className="text-rose-50 text-xs font-semibold text-center">
                {cancelingBookingId === item.booking?.id ? "A cancelar..." : "Cancelar"}
              </Text>
            </Pressable>
          ) : null}
        </View>
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
            <Text className="text-white text-sm font-semibold">Inicia sessão para aceder às aulas.</Text>
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
            <Text className="text-rose-100 text-sm font-semibold">Não foi possível carregar.</Text>
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
            <View className="rounded-2xl border border-white/14 bg-white/6 px-3 py-3">
              <View className="flex-row items-center justify-between">
                <Text className="text-white text-sm font-semibold">Inscrições</Text>
                <Text className="text-white/70 text-xs">{timeline.upcoming.length + timeline.history.length}</Text>
              </View>
              <View className="mt-2 flex-row gap-2">
                <View className="rounded-full border border-emerald-200/40 bg-emerald-400/12 px-3 py-1">
                  <Text className="text-emerald-50 text-[11px] font-semibold">Próximas {timeline.upcoming.length}</Text>
                </View>
                <View className="rounded-full border border-white/18 bg-white/8 px-3 py-1">
                  <Text className="text-white/80 text-[11px] font-semibold">Histórico {timeline.history.length}</Text>
                </View>
              </View>
              <View className="mt-3 rounded-full border border-white/16 bg-white/8 p-1 flex-row">
                <Pressable
                  onPress={() => setActiveTab("upcoming")}
                  className={
                    activeTab === "upcoming"
                      ? "flex-1 rounded-full bg-white/18 px-3 py-2"
                      : "flex-1 rounded-full px-3 py-2"
                  }
                  accessibilityRole="button"
                  accessibilityLabel="Ver próximas"
                >
                  <Text className={activeTab === "upcoming" ? "text-white text-xs font-semibold text-center" : "text-white/65 text-xs font-semibold text-center"}>
                    Próximas
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setActiveTab("history")}
                  className={
                    activeTab === "history"
                      ? "flex-1 rounded-full bg-white/18 px-3 py-2"
                      : "flex-1 rounded-full px-3 py-2"
                  }
                  accessibilityRole="button"
                  accessibilityLabel="Ver histórico"
                >
                  <Text className={activeTab === "history" ? "text-white text-xs font-semibold text-center" : "text-white/65 text-xs font-semibold text-center"}>
                    Histórico
                  </Text>
                </Pressable>
              </View>
            </View>

            {activeItems.length === 0 ? (
              <View className="rounded-2xl border border-white/14 bg-white/6 px-4 py-4">
                <Text className="text-white/70 text-xs">Sem aulas {activeTab === "upcoming" ? "próximas" : "no histórico"}.</Text>
              </View>
            ) : (
              activeItems.map((item) => renderCard(item, activeTab))
            )}
          </>
        )}
      </ScrollView>
    </LiquidBackground>
  );
}
