import { useEffect, useMemo } from "react";
import {
  FlatList,
  Platform,
  Pressable,
  Text,
  TextInput,
  UIManager,
  LayoutAnimation,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { i18n, tokens } from "@orya/shared";
import { useDebouncedValue, useDiscoverFeed } from "../../features/discover/hooks";
import { useDiscoverStore } from "../../features/discover/store";
import { useIpLocation } from "../../features/onboarding/hooks";
import { DiscoverEventCard } from "../../features/discover/DiscoverEventCard";
import { GlassSurface } from "../../components/glass/GlassSurface";
import { GlassSkeleton } from "../../components/glass/GlassSkeleton";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { LiquidBackground } from "../../components/liquid/LiquidBackground";
import { SectionHeader } from "../../components/liquid/SectionHeader";
import { DiscoverDateFilter, DiscoverKind, DiscoverOfferCard } from "../../features/discover/types";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type DiscoverListItem =
  | { kind: "skeleton"; key: string }
  | { kind: "offer"; offer: DiscoverOfferCard };

const kindMeta: Array<{ key: DiscoverKind; label: string; subtitle: string }> = [
  { key: "all", label: "Tudo", subtitle: "Eventos e servicos em tempo real." },
  { key: "padel", label: "Padel", subtitle: "Jogos, torneios e aulas perto de ti." },
  { key: "events", label: "Eventos", subtitle: "Concertos, experiencias e lives." },
  { key: "services", label: "Servicos", subtitle: "Reservas e servicos premium." },
];

export default function DiscoverScreen() {
  const t = i18n.pt.discover;
  const router = useRouter();
  const query = useDiscoverStore((state) => state.query);
  const priceFilter = useDiscoverStore((state) => state.priceFilter);
  const kind = useDiscoverStore((state) => state.kind);
  const dateFilter = useDiscoverStore((state) => state.dateFilter);
  const city = useDiscoverStore((state) => state.city);
  const setQuery = useDiscoverStore((state) => state.setQuery);
  const setPriceFilter = useDiscoverStore((state) => state.setPriceFilter);
  const setKind = useDiscoverStore((state) => state.setKind);
  const setDateFilter = useDiscoverStore((state) => state.setDateFilter);
  const setCity = useDiscoverStore((state) => state.setCity);
  const debouncedQuery = useDebouncedValue(query, 280);
  const debouncedCity = useDebouncedValue(city, 320);
  const { data: ipLocation } = useIpLocation();

  const { data, isFetching, isLoading, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useDiscoverFeed({ q: debouncedQuery, type: priceFilter, kind, date: dateFilter, city: debouncedCity });

  const items = useMemo<DiscoverOfferCard[]>(() => data?.pages.flatMap((page) => page.items) ?? [], [data?.pages]);

  const featured = useMemo(
    () => items.filter((item): item is Extract<DiscoverOfferCard, { type: "event" }> => item.type === "event" && Boolean(item.event.isHighlighted)).slice(0, 6),
    [items],
  );

  const featuredKeys = useMemo(() => new Set(featured.map((item) => item.key)), [featured]);

  const feedItems = useMemo(
    () => items.filter((item) => !featuredKeys.has(item.key)),
    [items, featuredKeys],
  );

  const showSkeleton = isLoading && items.length === 0;
  const showEmpty = !isLoading && !isError && items.length === 0;

  const listData = useMemo<DiscoverListItem[]>(
    () =>
      showSkeleton
        ? Array.from({ length: 5 }, (_, index) => ({
            kind: "skeleton" as const,
            key: `discover-skeleton-${index}`,
          }))
        : feedItems.map((offer) => ({ kind: "offer" as const, offer })),
    [feedItems, showSkeleton],
  );

  const activeKindMeta = useMemo(
    () => kindMeta.find((item) => item.key === kind) ?? kindMeta[0],
    [kind],
  );

  useEffect(() => {
    if (Platform.OS === "android" || Platform.OS === "ios") {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
  }, [items.length]);

  useEffect(() => {
    if (!city.trim() && ipLocation?.city) {
      setCity(ipLocation.city);
    }
  }, [city, ipLocation?.city, setCity]);

  return (
    <LiquidBackground>
      <FlatList
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 36 }}
        data={listData}
        keyExtractor={(item) => (item.kind === "skeleton" ? item.key : item.offer.key)}
        keyboardShouldPersistTaps="handled"
        refreshing={isFetching && !isFetchingNextPage}
        onRefresh={() => refetch()}
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.35}
        ListHeaderComponent={
          <View className="pt-14">
            <View className="px-5 pb-4">
              <Text className="text-white text-[30px] font-semibold">{t.title}</Text>
              <Text className="mt-1 text-white/60 text-sm">{t.subtitle}</Text>
            </View>

            <View className="px-5 pb-3">
              <GlassSurface intensity={65} padding={12}>
                <View className="flex-row items-center gap-3">
                  <Pressable
                    onPress={() => router.push({ pathname: "/search", params: { q: query } })}
                    style={{ minHeight: tokens.layout.touchTarget, justifyContent: "center" }}
                  >
                    <Ionicons name="search" size={18} color={tokens.colors.textMuted} />
                  </Pressable>
                  <TextInput
                    value={query}
                    onChangeText={setQuery}
                    placeholder={t.searchPlaceholder}
                    placeholderTextColor={tokens.colors.textMuted}
                    className="text-white text-base flex-1"
                    style={{ minHeight: tokens.layout.touchTarget - 12 }}
                    returnKeyType="search"
                    onSubmitEditing={() => router.push({ pathname: "/search", params: { q: query } })}
                  />
                </View>
              </GlassSurface>
            </View>

            <View className="px-5 pb-5 flex-row gap-2">
              {kindMeta.map((item) => {
                const active = item.key === kind;
                return (
                  <Pressable
                    key={item.key}
                    onPress={() => setKind(item.key)}
                    style={{ minHeight: tokens.layout.touchTarget }}
                    className="overflow-hidden rounded-full border border-white/10"
                  >
                    <BlurView
                      tint="dark"
                      intensity={active ? 80 : 35}
                      style={{
                        paddingHorizontal: tokens.spacing.lg,
                        justifyContent: "center",
                        minHeight: tokens.layout.touchTarget,
                        backgroundColor: active ? tokens.colors.glassStrong : tokens.colors.surface,
                      }}
                    >
                      <Text className={active ? "text-white text-sm font-semibold" : "text-white/70 text-sm"}>
                        {item.label}
                      </Text>
                    </BlurView>
                  </Pressable>
                );
              })}
            </View>

            <View className="px-5 pb-5 flex-row gap-2">
              {[
                { key: "all", label: t.all },
                { key: "free", label: t.free },
                { key: "paid", label: t.paid },
              ].map((item) => {
                const active = item.key === priceFilter;
                return (
                  <Pressable
                    key={item.key}
                    onPress={() => setPriceFilter(item.key as "all" | "free" | "paid")}
                    style={{ minHeight: tokens.layout.touchTarget }}
                    className="overflow-hidden rounded-full border border-white/10"
                  >
                    <BlurView
                      tint="dark"
                      intensity={active ? 80 : 35}
                      style={{
                        paddingHorizontal: tokens.spacing.lg,
                        justifyContent: "center",
                        minHeight: tokens.layout.touchTarget,
                        backgroundColor: active ? tokens.colors.glassStrong : tokens.colors.surface,
                      }}
                    >
                      <Text className={active ? "text-white text-sm font-semibold" : "text-white/70 text-sm"}>
                        {item.label}
                      </Text>
                    </BlurView>
                  </Pressable>
                );
              })}
            </View>

            <View className="px-5 pb-4">
              <GlassSurface intensity={62} padding={12}>
                <View className="flex-row items-center gap-3">
                  <Ionicons name="location-outline" size={16} color={tokens.colors.textMuted} />
                  <TextInput
                    value={city}
                    onChangeText={setCity}
                    placeholder="Cidade ou local"
                    placeholderTextColor={tokens.colors.textMuted}
                    className="text-white text-sm flex-1"
                    style={{ minHeight: tokens.layout.touchTarget - 14 }}
                    returnKeyType="done"
                  />
                  {city ? (
                    <Pressable
                      onPress={() => setCity("")}
                      className="rounded-full border border-white/10 bg-white/10 px-3 py-1"
                    >
                      <Text className="text-white/70 text-xs">Limpar</Text>
                    </Pressable>
                  ) : (
                    <Pressable
                      onPress={() => {
                        if (ipLocation?.city) setCity(ipLocation.city);
                      }}
                      className="rounded-full border border-white/10 bg-white/10 px-3 py-1"
                    >
                      <Text className="text-white/70 text-xs">Perto de mim</Text>
                    </Pressable>
                  )}
                </View>
              </GlassSurface>
            </View>

            <View className="px-5 pb-5 flex-row flex-wrap gap-2">
              {[
                { key: "all", label: "Todas" },
                { key: "today", label: "Hoje" },
                { key: "weekend", label: "Fim‑de‑semana" },
                { key: "upcoming", label: "Próximos 7 dias" },
              ].map((item) => {
                const active = item.key === dateFilter;
                return (
                  <Pressable
                    key={item.key}
                    onPress={() => setDateFilter(item.key as DiscoverDateFilter)}
                    style={{ minHeight: tokens.layout.touchTarget - 6 }}
                    className="overflow-hidden rounded-full border border-white/10"
                  >
                    <BlurView
                      tint="dark"
                      intensity={active ? 80 : 35}
                      style={{
                        paddingHorizontal: tokens.spacing.lg,
                        justifyContent: "center",
                        minHeight: tokens.layout.touchTarget - 6,
                        backgroundColor: active ? tokens.colors.glassStrong : tokens.colors.surface,
                      }}
                    >
                      <Text className={active ? "text-white text-xs font-semibold" : "text-white/70 text-xs"}>
                        {item.label}
                      </Text>
                    </BlurView>
                  </Pressable>
                );
              })}
            </View>

            {featured.length > 0 ?
              <View className="pb-6">
                <View className="px-5">
                  <SectionHeader title="Destaques" subtitle="Ofertas premium em tempo real." />
                </View>
                <FlatList
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  data={featured}
                  keyExtractor={(item) => item.key}
                  contentContainerStyle={{ paddingHorizontal: 20 }}
                  renderItem={({ item, index }) => (
                    <DiscoverEventCard item={item.event} itemType="event" variant="featured" index={index} />
                  )}
                />
              </View>
            : null}

            <View className="px-5">
              <SectionHeader title="Para ti" subtitle={activeKindMeta.subtitle} />
            </View>
          </View>
        }
        renderItem={({ item, index }) => {
          if (item.kind === "skeleton") {
            return <GlassSkeleton className="mb-4" height={140} />;
          }

          if (item.offer.type === "event") {
            return <DiscoverEventCard item={item.offer.event} itemType="event" index={index} />;
          }

          return <DiscoverEventCard item={item.offer.service} itemType="service" index={index} />;
        }}
        ListFooterComponent={
          !showSkeleton ? (
            <View className="pt-2">
              {isError ? (
                <GlassSurface intensity={50}>
                  <Text className="text-red-300 text-sm mb-3">Nao foi possivel carregar o feed.</Text>
                  <Pressable
                    onPress={() => refetch()}
                    className="rounded-xl bg-white/10 px-4 py-3"
                    style={{ minHeight: tokens.layout.touchTarget }}
                  >
                    <Text className="text-white text-sm font-semibold text-center">{t.retry}</Text>
                  </Pressable>
                </GlassSurface>
              ) : null}
              {showEmpty ? (
                <GlassSurface intensity={50}>
                  <Text className="text-white/70 text-sm">{t.empty}</Text>
                </GlassSurface>
              ) : null}
              {isFetchingNextPage ? (
                <GlassSkeleton className="mt-3" height={120} />
              ) : null}
              {!isError && hasNextPage && !isFetchingNextPage ? (
                <Pressable
                  onPress={() => fetchNextPage()}
                  className="mt-3 rounded-xl border border-white/15 bg-white/5 px-4 py-3"
                  style={{ minHeight: tokens.layout.touchTarget }}
                >
                  <Text className="text-white text-sm font-semibold text-center">{t.loadMore}</Text>
                </Pressable>
              ) : null}
              {!isLoading && isFetching && !isFetchingNextPage ? (
                <Text className="mt-3 text-white/50 text-center text-xs">{t.loading}</Text>
              ) : null}
            </View>
          ) : null
        }
      />
    </LiquidBackground>
  );
}
