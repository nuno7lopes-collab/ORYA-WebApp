import { useMemo } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useNavigation } from "@react-navigation/native";
import { tokens } from "@orya/shared";
import { LiquidBackground } from "../../../components/liquid/LiquidBackground";
import { TopAppHeader } from "../../../components/navigation/TopAppHeader";
import { useTopHeaderPadding } from "../../../components/navigation/useTopHeaderPadding";
import { useTopBarScroll } from "../../../components/navigation/useTopBarScroll";
import { Ionicons } from "../../../components/icons/Ionicons";
import { useClubCourts } from "../../../features/bookings/hooks";
import { safeBack, safePush } from "../../../lib/navigation";
import { TAB_PATHNAMES } from "../../../lib/tabRoutes";
import { getMobileEnv } from "../../../lib/env";

const normalizeImageUrl = (value?: string | null) => {
  if (!value) return null;
  if (/^https?:\/\//i.test(value) || value.startsWith("data:")) return value;
  const base = getMobileEnv().apiBaseUrl.replace(/\/+$/, "");
  return `${base}${value.startsWith("/") ? "" : "/"}${value}`;
};

const formatMoney = (amountCents?: number | null, currency = "EUR") => {
  if (typeof amountCents !== "number" || !Number.isFinite(amountCents)) return "-";
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency }).format(amountCents / 100);
};

export default function ClubCourtsScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const params = useLocalSearchParams<{ username?: string | string[] }>();
  const topPadding = useTopHeaderPadding(16);
  const topBar = useTopBarScroll({ hideOnScroll: false });
  const orgUsername = useMemo(() => {
    const raw = Array.isArray(params.username) ? params.username[0] : params.username;
    const normalized = String(raw ?? "").trim();
    return normalized.length > 0 ? normalized : null;
  }, [params.username]);
  const courtsQuery = useClubCourts(orgUsername, Boolean(orgUsername));
  const courts = courtsQuery.data ?? [];
  const clubName = courts[0]?.clubName || orgUsername || "Clube";
  const minPrice = useMemo(() => {
    if (courts.length === 0) return null;
    return courts.reduce<number | null>((acc, court) => {
      if (!Number.isFinite(court.unitPriceCents)) return acc;
      if (acc == null || court.unitPriceCents < acc) return court.unitPriceCents;
      return acc;
    }, null);
  }, [courts]);
  const currency = courts[0]?.currency ?? "EUR";

  return (
    <LiquidBackground>
      <TopAppHeader
        scrollState={topBar}
        variant="title"
        title={clubName}
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
              pressed ? { opacity: 0.82 } : null,
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
        <View className="gap-1">
          <Text className="text-white text-sm font-semibold">Campos</Text>
          {courts.length > 0 ? (
            <View className="mt-1 flex-row flex-wrap items-center gap-2">
              <View className="rounded-full border border-white/20 bg-white/10 px-2 py-0.5">
                <Text className="text-[10px] text-white/90 font-semibold">
                  {courts.length} {courts.length === 1 ? "campo" : "campos"}
                </Text>
              </View>
              {minPrice != null ? (
                <View className="rounded-full border border-cyan-200/35 bg-cyan-300/12 px-2 py-0.5">
                  <Text className="text-[10px] text-cyan-50 font-semibold">
                    Desde {formatMoney(minPrice, currency)}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>

        {!orgUsername ? (
          <View className="rounded-2xl border border-rose-300/35 bg-rose-500/12 px-4 py-4">
            <Text className="text-rose-100 text-xs">Clube inválido.</Text>
          </View>
        ) : courtsQuery.isLoading ? (
          <View className="py-6">
            <ActivityIndicator color="rgba(255,255,255,0.9)" />
          </View>
        ) : courtsQuery.isError ? (
          <View className="rounded-2xl border border-rose-300/35 bg-rose-500/12 px-4 py-4 gap-2">
            <Text className="text-rose-100 text-xs">Não foi possível carregar os campos.</Text>
            <Pressable
              onPress={() => courtsQuery.refetch()}
              className="self-start rounded-full border border-white/20 bg-white/8 px-4 py-2"
              accessibilityRole="button"
              accessibilityLabel="Tentar novamente"
            >
              <Text className="text-white/85 text-xs font-semibold">Tentar novamente</Text>
            </Pressable>
          </View>
        ) : courts.length === 0 ? (
          <View className="rounded-2xl border border-white/14 bg-white/6 px-4 py-4">
            <Text className="text-white/70 text-xs">Sem campos ativos para reserva.</Text>
          </View>
        ) : (
          <View className="gap-3">
            {courts.map((court) => (
              <Pressable
                key={court.id}
                onPress={() => {
                  safePush(router, {
                    pathname: "/service/[id]/booking",
                    params: {
                      id: String(court.serviceId),
                      courtId: String(court.courtId),
                      orgUsername: court.orgUsername,
                      bookingVertical: "COURT",
                    },
                  });
                }}
                className="rounded-2xl border border-white/14 bg-white/6 p-3"
                accessibilityRole="button"
                accessibilityLabel={`Reservar ${court.courtName}`}
              >
                <View className="flex-row items-start gap-3">
                  <View className="overflow-hidden rounded-xl border border-white/12 bg-white/8" style={{ width: 92, height: 72 }}>
                    {normalizeImageUrl(court.coverImageUrl) ? (
                      <Image
                        source={{ uri: normalizeImageUrl(court.coverImageUrl) as string }}
                        contentFit="cover"
                        style={{ width: "100%", height: "100%" }}
                      />
                    ) : (
                      <View className="flex-1 bg-white/6" />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <View className="flex-row items-start justify-between gap-2">
                      <Text className="text-white text-sm font-semibold" numberOfLines={1}>
                        {court.courtName}
                      </Text>
                      <Ionicons name="chevron-forward" size={16} color="rgba(240,247,255,0.82)" />
                    </View>
                    {court.description ? (
                      <Text className="mt-1 text-white/70 text-xs" numberOfLines={2}>
                        {court.description}
                      </Text>
                    ) : null}
                    <View className="mt-2 flex-row flex-wrap items-center gap-2">
                      <View className="rounded-full border border-white/20 bg-white/10 px-2 py-1">
                        <Text className="text-[10px] font-semibold text-white/85">{court.durationMinutes} min</Text>
                      </View>
                      <View className="rounded-full border border-cyan-200/35 bg-cyan-300/14 px-2 py-1">
                        <Text className="text-[10px] font-semibold text-cyan-50">
                          Desde {formatMoney(court.unitPriceCents, court.currency)}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </LiquidBackground>
  );
}
