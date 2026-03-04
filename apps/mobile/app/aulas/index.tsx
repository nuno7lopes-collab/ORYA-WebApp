import { useMemo } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useNavigation } from "@react-navigation/native";
import { tokens } from "@orya/shared";
import { LiquidBackground } from "../../components/liquid/LiquidBackground";
import { TopAppHeader } from "../../components/navigation/TopAppHeader";
import { useTopHeaderPadding } from "../../components/navigation/useTopHeaderPadding";
import { useTopBarScroll } from "../../components/navigation/useTopBarScroll";
import { Ionicons } from "../../components/icons/Ionicons";
import { safeBack, safePush } from "../../lib/navigation";
import { TAB_PATHNAMES } from "../../lib/tabRoutes";
import { useDiscoverFeed } from "../../features/discover/hooks";
import type { DiscoverOfferCard, DiscoverServiceCard } from "../../features/discover/types";

const asServiceOffer = (offer: DiscoverOfferCard): offer is Extract<DiscoverOfferCard, { type: "service" }> =>
  offer.type === "service";

const resolveServiceVertical = (service: DiscoverServiceCard): "COURT" | "CLASS" | "SERVICE" => {
  const byVertical = String(service.bookingVertical ?? "").trim().toUpperCase();
  if (byVertical === "COURT" || byVertical === "CLASS" || byVertical === "SERVICE") return byVertical;
  const byDomain = String(service.category?.domain ?? "").trim().toUpperCase();
  if (byDomain === "COURT" || byDomain === "CLASS" || byDomain === "SERVICE") return byDomain;
  const byKind = String(service.kind ?? "").trim().toUpperCase();
  if (byKind === "COURT") return "COURT";
  if (byKind === "CLASS") return "CLASS";
  return "SERVICE";
};

const formatPriceLabel = (cents?: number | null, currency = "EUR") => {
  if (typeof cents !== "number" || !Number.isFinite(cents)) return "Preço sob consulta";
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency }).format(cents / 100);
};

export default function AulasScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const topPadding = useTopHeaderPadding(16);
  const topBar = useTopBarScroll({ hideOnScroll: false });

  const lessonsQuery = useDiscoverFeed(
    { q: "padel treino aula", type: "all", kind: "classes", date: "upcoming", city: "" },
    true,
  );

  const lessons = useMemo(() => {
    const offers = lessonsQuery.data?.pages.flatMap((page) => page.items) ?? [];
    const map = new Map<number, DiscoverServiceCard>();
    offers.filter(asServiceOffer).forEach((offer) => {
      if (resolveServiceVertical(offer.service) !== "CLASS") return;
      if (!map.has(offer.service.id)) {
        map.set(offer.service.id, offer.service);
      }
    });
    return Array.from(map.values());
  }, [lessonsQuery.data?.pages]);

  return (
    <LiquidBackground>
      <TopAppHeader
        scrollState={topBar}
        variant="title"
        title="Aulas"
        leftSlot={
          <Pressable
            onPress={() => safeBack(router, navigation, TAB_PATHNAMES.inicio)}
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
        contentContainerStyle={{ paddingTop: topPadding, paddingBottom: 24, paddingHorizontal: 20, gap: 10 }}
        onScroll={topBar.onScroll}
        onScrollEndDrag={topBar.onScrollEndDrag}
        onMomentumScrollEnd={topBar.onMomentumScrollEnd}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        {lessonsQuery.isLoading ? (
          <View className="py-6">
            <ActivityIndicator color="rgba(255,255,255,0.9)" />
          </View>
        ) : lessons.length === 0 ? (
          <View className="rounded-2xl border border-white/14 bg-white/6 px-4 py-4">
            <Text className="text-white/75 text-sm">Sem aulas disponíveis neste momento.</Text>
          </View>
        ) : (
          lessons.map((service) => (
            <Pressable
              key={`lesson-${service.id}`}
              onPress={() => {
                const params: Record<string, string> = {
                  id: String(service.id),
                  bookingVertical: "CLASS",
                };
                if (service.organization?.username) {
                  params.orgUsername = service.organization.username;
                }
                safePush(router, { pathname: "/service/[id]/booking", params });
              }}
              className="rounded-2xl border border-white/14 bg-white/6 px-4 py-4"
              accessibilityRole="button"
              accessibilityLabel={service.title}
            >
              <Text className="text-white text-sm font-semibold">{service.title}</Text>
              <Text className="mt-1 text-white/70 text-xs">
                {service.organization.publicName ?? service.organization.businessName ?? "Clube"}
              </Text>
              <Text className="mt-1 text-white/60 text-xs">
                {formatPriceLabel(service.unitPriceCents, service.currency)} · {service.durationMinutes} min
              </Text>
            </Pressable>
          ))
        )}
      </ScrollView>
    </LiquidBackground>
  );
}
