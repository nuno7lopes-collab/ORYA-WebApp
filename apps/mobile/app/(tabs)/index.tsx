import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  Text,
  UIManager,
  LayoutAnimation,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { i18n, tokens } from "@orya/shared";
import { useDebouncedValue, useDiscoverFeed } from "../../features/discover/hooks";
import { useDiscoverStore } from "../../features/discover/store";
import { useIpLocation } from "../../features/onboarding/hooks";
import { GlassSurface } from "../../components/glass/GlassSurface";
import { Ionicons } from "../../components/icons/Ionicons";
import { LiquidBackground } from "../../components/liquid/LiquidBackground";
import { SectionHeader } from "../../components/liquid/SectionHeader";
import { DiscoverDateFilter, DiscoverKind, DiscoverOfferCard } from "../../features/discover/types";
import { FiltersBottomSheet } from "../../components/discover/FiltersBottomSheet";
import { EventCardSquare, EventCardSquareSkeleton } from "../../components/events/EventCardSquare";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTabBarPadding } from "../../components/navigation/useTabBarPadding";
import { getDistanceKm } from "../../lib/geo";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type DiscoverListItem =
  | { kind: "skeleton"; key: string }
  | { kind: "offer"; offer: DiscoverOfferCard };

const kindMeta: Array<{ key: DiscoverKind; label: string; subtitle: string }> = [
  { key: "all", label: "Tudo", subtitle: "Eventos e serviços em tempo real." },
  { key: "padel", label: "Padel", subtitle: "Jogos, torneios e aulas perto de ti." },
  { key: "events", label: "Eventos", subtitle: "Concertos, experiências e lives." },
  { key: "services", label: "Serviços", subtitle: "Reservas e serviços premium." },
];

const categoryChips = [
  { key: "all", label: "Tudo", kind: "all" as DiscoverKind },
  { key: "padel", label: "Padel", kind: "padel" as DiscoverKind },
  { key: "events", label: "Eventos", kind: "events" as DiscoverKind },
  { key: "services", label: "Serviços", kind: "services" as DiscoverKind },
  { key: "experiences", label: "Experiências", kind: "events" as DiscoverKind },
];

export default function DiscoverScreen() {
  const t = i18n.pt.discover;
  const router = useRouter();
  const priceFilter = useDiscoverStore((state) => state.priceFilter);
  const kind = useDiscoverStore((state) => state.kind);
  const dateFilter = useDiscoverStore((state) => state.dateFilter);
  const city = useDiscoverStore((state) => state.city);
  const setPriceFilter = useDiscoverStore((state) => state.setPriceFilter);
  const setKind = useDiscoverStore((state) => state.setKind);
  const setDateFilter = useDiscoverStore((state) => state.setDateFilter);
  const setCity = useDiscoverStore((state) => state.setCity);
  const distanceKm = useDiscoverStore((state) => state.distanceKm);
  const setDistanceKm = useDiscoverStore((state) => state.setDistanceKm);
  const resetFilters = useDiscoverStore((state) => state.resetFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [activeChip, setActiveChip] = useState("all");
  const debouncedCity = useDebouncedValue(city, 320);
  const { data: ipLocation } = useIpLocation();
  const userLat = ipLocation?.approxLatLon?.lat ?? null;
  const userLon = ipLocation?.approxLatLon?.lon ?? null;
  const insets = useSafeAreaInsets();
  const tabBarPadding = useTabBarPadding();

  const { data, isFetching, isLoading, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useDiscoverFeed({ q: "", type: priceFilter, kind, date: dateFilter, city: debouncedCity });

  const items = useMemo<DiscoverOfferCard[]>(() => data?.pages.flatMap((page) => page.items) ?? [], [data?.pages]);

  const feedItems = useMemo(() => {
    return items.filter((item) => {
      if (priceFilter === "soon" && item.type === "event") {
        const hasTickets = (item.event.ticketTypes?.length ?? 0) > 0;
        const hasUpcoming = item.event.ticketTypes?.some((ticket) => ticket.status === "UPCOMING") ?? false;
        const hasPrice = typeof item.event.priceFrom === "number" || Boolean(item.event.isGratis);
        if (hasPrice) return false;
        if (!hasTickets && !hasUpcoming) return true;
        return true;
      }
      if (priceFilter === "soon" && item.type === "service") {
        return false;
      }
      if (distanceKm > 0 && item.type === "event") {
        const distance = getDistanceKm(
          item.event.location?.lat ?? null,
          item.event.location?.lng ?? null,
          userLat ?? null,
          userLon ?? null,
        );
        if (distance == null) return false;
        return distance <= distanceKm;
      }
      return true;
    });
  }, [distanceKm, items, priceFilter, userLat, userLon]);

  const showSkeleton = isLoading && items.length === 0;
  const showEmpty = !isLoading && !isError && feedItems.length === 0;
  const hasActiveFilters = Boolean(
    city.trim() ||
      priceFilter !== "all" ||
      kind !== "all" ||
      dateFilter !== "all" ||
      distanceKm !== 5,
  );

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
      if (items.length <= 24) {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      }
    }
  }, [items.length]);

  useEffect(() => {
    if (kind === "all" && activeChip !== "all") setActiveChip("all");
    if (kind === "padel" && activeChip !== "padel") setActiveChip("padel");
    if (kind === "events" && activeChip === "services") setActiveChip("events");
    if (kind === "services" && activeChip !== "services") setActiveChip("services");
  }, [activeChip, kind]);

  useEffect(() => {
    if (!city.trim() && ipLocation?.city) {
      setCity(ipLocation.city);
    }
  }, [city, ipLocation?.city, setCity]);

  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const renderItem = useCallback(
    ({ item, index }: { item: DiscoverListItem; index: number }) => {
      if (item.kind === "skeleton") {
        return <EventCardSquareSkeleton />;
      }

      if (item.offer.type === "event") {
        return (
          <EventCardSquare
            event={item.offer.event}
            index={index}
            userLat={userLat}
            userLon={userLon}
          />
        );
      }

      return (
        <GlassSurface intensity={52} padding={16} style={{ marginBottom: 16 }}>
          <Text className="text-white text-base font-semibold">{item.offer.service.title}</Text>
          <Text className="text-white/60 text-sm mt-1" numberOfLines={2}>
            {item.offer.service.description ?? "Serviço premium"}
          </Text>
        </GlassSurface>
      );
    },
    [userLat, userLon],
  );

  const keyExtractor = useCallback(
    (item: DiscoverListItem) => (item.kind === "skeleton" ? item.key : item.offer.key),
    [],
  );

  return (
    <LiquidBackground>
      <FlatList
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: tabBarPadding }}
        data={listData}
        keyExtractor={keyExtractor}
        keyboardShouldPersistTaps="handled"
        refreshing={isFetching && !isFetchingNextPage}
        onRefresh={handleRefresh}
        removeClippedSubviews={Platform.OS === "android"}
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        updateCellsBatchingPeriod={40}
        windowSize={7}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.35}
        ListHeaderComponent={
            <View style={{ paddingTop: insets.top + 12 }}>
              <View className="px-5 pb-3 flex-row items-center justify-between">
                <View>
                  <Text className="text-white text-[30px] font-semibold">{t.title}</Text>
                  <Text className="mt-1 text-white/60 text-sm">{t.subtitle}</Text>
                </View>
                <View className="flex-row items-center gap-8">
                  <Pressable
                    onPress={() => router.push({ pathname: "/search" })}
                    style={{ minHeight: tokens.layout.touchTarget, justifyContent: "center" }}
                  >
                    <Ionicons name="search" size={20} color="rgba(255,255,255,0.9)" />
                  </Pressable>
                  <Pressable
                    onPress={() => setFiltersOpen(true)}
                    style={{ minHeight: tokens.layout.touchTarget, justifyContent: "center" }}
                  >
                    <Ionicons name="options-outline" size={20} color="rgba(255,255,255,0.9)" />
                  </Pressable>
                </View>
              </View>

              <View className="px-5 pb-4">
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                  {categoryChips.map((chip) => {
                    const active = activeChip === chip.key;
                    return (
                      <Pressable
                        key={chip.key}
                        onPress={() => {
                          setActiveChip(chip.key);
                          setKind(chip.kind);
                        }}
                        style={({ pressed }) => [
                          {
                            paddingHorizontal: 18,
                            paddingVertical: 10,
                            borderRadius: 999,
                            borderWidth: 1,
                            borderColor: active ? "rgba(170, 220, 255, 0.55)" : "rgba(255,255,255,0.12)",
                            backgroundColor: active ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.06)",
                            minHeight: tokens.layout.touchTarget,
                          },
                          pressed ? { opacity: 0.9 } : null,
                        ]}
                      >
                        <Text style={active ? { color: "#ffffff", fontWeight: "600" } : { color: "rgba(255,255,255,0.7)" }}>
                          {chip.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>

              {hasActiveFilters ? (
                <View className="px-5 pb-4">
                  <Pressable
                    onPress={() => resetFilters()}
                    className="self-start rounded-full border border-white/15 bg-white/5 px-4 py-2"
                    style={{ minHeight: tokens.layout.touchTarget - 8 }}
                  >
                    <Text className="text-white/75 text-xs font-semibold">Limpar filtros</Text>
                  </Pressable>
                </View>
              ) : null}

              <View className="px-5">
                <SectionHeader title="Para ti" subtitle={activeKindMeta.subtitle} />
              </View>
            </View>
        }
        renderItem={renderItem}
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
                  {hasActiveFilters ? (
                    <Pressable
                      onPress={() => resetFilters()}
                      className="mt-3 rounded-xl border border-white/15 bg-white/5 px-4 py-3"
                      style={{ minHeight: tokens.layout.touchTarget }}
                    >
                      <Text className="text-white text-sm font-semibold text-center">Limpar filtros</Text>
                    </Pressable>
                  ) : null}
                </GlassSurface>
              ) : null}
              {isFetchingNextPage ? (
                <EventCardSquareSkeleton />
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
      <FiltersBottomSheet
        visible={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        distanceKm={distanceKm}
        onDistanceChange={setDistanceKm}
        city={city}
        onCityChange={setCity}
        onCityReset={() => setCity("")}
        date={dateFilter as DiscoverDateFilter}
        onDateChange={setDateFilter}
        price={priceFilter}
        onPriceChange={setPriceFilter}
      />
    </LiquidBackground>
  );
}
