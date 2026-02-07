import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  UIManager,
  LayoutAnimation,
  View,
  InteractionManager,
} from "react-native";
import { i18n, tokens } from "@orya/shared";
import { useDebouncedValue, useDiscoverFeed } from "../../features/discover/hooks";
import { useDiscoverStore } from "../../features/discover/store";
import { useIpLocation } from "../../features/onboarding/hooks";
import { resolveCityToAddress } from "../../features/discover/location";
import { GlassSurface } from "../../components/glass/GlassSurface";
import { Ionicons } from "../../components/icons/Ionicons";
import { LiquidBackground } from "../../components/liquid/LiquidBackground";
import { SectionHeader } from "../../components/liquid/SectionHeader";
import { DiscoverDateFilter, DiscoverKind, DiscoverOfferCard } from "../../features/discover/types";
import { FiltersBottomSheet } from "../../components/discover/FiltersBottomSheet";
import { EventCardSquare, EventCardSquareSkeleton } from "../../components/events/EventCardSquare";
import { useTabBarPadding } from "../../components/navigation/useTabBarPadding";
import { getDistanceKm } from "../../lib/geo";
import { TopAppHeader } from "../../components/navigation/TopAppHeader";
import { useTopHeaderPadding } from "../../components/navigation/useTopHeaderPadding";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type DiscoverListItem =
  | { kind: "skeleton"; key: string }
  | { kind: "offer"; offer: DiscoverOfferCard };

const WORLD_OPTIONS: Array<{ key: "padel" | "events" | "services"; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { key: "padel", label: "Padel", icon: "tennisball" },
  { key: "events", label: "Eventos", icon: "calendar" },
  { key: "services", label: "Serviços", icon: "briefcase" },
];

export default function DiscoverScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ search?: string; q?: string }>();
  const t = i18n.pt.discover;
  const priceFilter = useDiscoverStore((state) => state.priceFilter);
  const worlds = useDiscoverStore((state) => state.worlds);
  const dateFilter = useDiscoverStore((state) => state.dateFilter);
  const city = useDiscoverStore((state) => state.city);
  const locationAddressId = useDiscoverStore((state) => state.locationAddressId);
  const locationLat = useDiscoverStore((state) => state.locationLat);
  const locationLng = useDiscoverStore((state) => state.locationLng);
  const locationSource = useDiscoverStore((state) => state.locationSource);
  const setPriceFilter = useDiscoverStore((state) => state.setPriceFilter);
  const setWorlds = useDiscoverStore((state) => state.setWorlds);
  const setDateFilter = useDiscoverStore((state) => state.setDateFilter);
  const setLocation = useDiscoverStore((state) => state.setLocation);
  const distanceKm = useDiscoverStore((state) => state.distanceKm);
  const setDistanceKm = useDiscoverStore((state) => state.setDistanceKm);
  const resetFilters = useDiscoverStore((state) => state.resetFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [dataReady, setDataReady] = useState(false);
  const searchInputRef = useRef<TextInput>(null);
  const debouncedCity = useDebouncedValue(city, 320);
  const shouldFetchLocation = dataReady && locationSource === "NONE";
  const { data: ipLocation } = useIpLocation(shouldFetchLocation);
  const userLat = locationLat ?? ipLocation?.approxLatLon?.lat ?? null;
  const userLon = locationLng ?? ipLocation?.approxLatLon?.lon ?? null;
  const tabBarPadding = useTabBarPadding();
  const topPadding = useTopHeaderPadding(12);
  const locationResolveRef = useRef(false);

  const isAllWorlds = worlds.length === 0 || worlds.length === WORLD_OPTIONS.length;
  const resolvedKind: DiscoverKind = isAllWorlds
    ? "all"
    : worlds.length === 1
      ? worlds[0] === "services"
        ? "services"
        : worlds[0] === "padel"
          ? "padel"
          : "events"
      : "all";

  const toggleWorld = (key: "padel" | "events" | "services") => {
    const exists = worlds.includes(key as any);
    const next = exists ? worlds.filter((item) => item !== key) : [...worlds, key];
    setWorlds(next.length === WORLD_OPTIONS.length ? [] : next);
  };

  const { data, isFetching, isLoading, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useDiscoverFeed(
      { q: "", type: priceFilter, kind: resolvedKind, date: dateFilter, city: debouncedCity },
      dataReady,
    );

  const items = useMemo<DiscoverOfferCard[]>(() => data?.pages.flatMap((page) => page.items) ?? [], [data?.pages]);

  const feedItems = useMemo(() => {
    const filtered = items.filter((item) => {
      if (!isAllWorlds) {
        if (item.type === "event") {
          const isPadelEvent = (item.event.categories ?? []).includes("PADEL");
          const matchesPadel = worlds.includes("padel") && isPadelEvent;
          const matchesEvents = worlds.includes("events") && !isPadelEvent;
          if (!matchesPadel && !matchesEvents) return false;
        }
        if (item.type === "service") {
          const isPadelService = item.service.kind === "COURT";
          const matchesPadel = worlds.includes("padel") && isPadelService;
          const matchesServices = worlds.includes("services") && !isPadelService;
          if (!matchesPadel && !matchesServices) return false;
        }
      }

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
        if (userLat == null || userLon == null) return true;
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
    return filtered;
  }, [distanceKm, isAllWorlds, items, priceFilter, userLat, userLon, worlds]);

  const showSkeleton = isLoading && items.length === 0;
  const showEmpty = !isLoading && !isError && feedItems.length === 0;
  const hasActiveFilters = Boolean(
    locationSource !== "NONE" ||
      priceFilter !== "all" ||
      !isAllWorlds ||
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
    () => ({
      subtitle: "Eventos, serviços e experiências para ti.",
    }),
    [],
  );

  useEffect(() => {
    if (Platform.OS === "android" || Platform.OS === "ios") {
      if (items.length <= 24) {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      }
    }
  }, [items.length]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const task = InteractionManager.runAfterInteractions(() => {
        if (active) setDataReady(true);
      });
      return () => {
        active = false;
        task.cancel();
        setDataReady(false);
      };
    }, []),
  );

  useEffect(() => {
    if (!ipLocation?.city) return;
    if (locationSource === "APPLE_MAPS") return;
    if (!city.trim()) {
      setLocation({ city: ipLocation.city, label: ipLocation.city, source: "IP" });
    }
    if (locationResolveRef.current) return;
    if (locationAddressId) return;
    locationResolveRef.current = true;
    resolveCityToAddress(ipLocation.city)
      .then((details) => {
        if (!details?.addressId) return;
        const canonical = (details.canonical as Record<string, unknown> | null) ?? null;
        const cityFromCanonical =
          (canonical && typeof canonical.city === "string" && canonical.city.trim()
            ? canonical.city.trim()
            : null) ?? details.city ?? ipLocation.city;
        setLocation({
          city: cityFromCanonical ?? "",
          label: details.formattedAddress || ipLocation.city,
          addressId: details.addressId,
          lat: typeof details.lat === "number" ? details.lat : null,
          lng: typeof details.lng === "number" ? details.lng : null,
          source: "APPLE_MAPS",
        });
      })
      .catch(() => undefined)
      .finally(() => {
        locationResolveRef.current = false;
      });
  }, [city, ipLocation?.city, locationAddressId, locationSource, setLocation]);

  useEffect(() => {
    const shouldOpen = params.search === "1" || params.search === "true";
    if (shouldOpen) setSearchOpen(true);
    if (typeof params.q === "string" && params.q.trim().length > 0) {
      setSearchQuery(params.q);
    }
  }, [params.q, params.search]);

  useEffect(() => {
    if (!searchOpen) return;
    const id = setTimeout(() => searchInputRef.current?.focus(), 120);
    return () => clearTimeout(id);
  }, [searchOpen]);

  const handleCloseSearch = useCallback(() => {
    setSearchOpen(false);
    setSearchQuery("");
    router.setParams({ search: undefined, q: undefined });
  }, [router]);

  const handleSubmitSearch = useCallback(() => {
    const query = searchQuery.trim();
    router.push({ pathname: "/search", params: query ? { q: query } : {} });
  }, [router, searchQuery]);

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
      <TopAppHeader />
      <FlatList
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: tabBarPadding, paddingTop: topPadding }}
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
          <View>
            {searchOpen && (
              <View style={{ paddingHorizontal: 20, paddingBottom: 12 }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: "rgba(255,255,255,0.14)",
                    backgroundColor: "rgba(255,255,255,0.06)",
                  }}
                >
                  <Ionicons name="search" size={16} color="rgba(240,246,255,0.9)" />
                  <TextInput
                    ref={searchInputRef}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholder="Pesquisar eventos, pessoas ou organizações"
                    placeholderTextColor="rgba(235, 244, 255, 0.45)"
                    returnKeyType="search"
                    onSubmitEditing={handleSubmitSearch}
                    style={{ flex: 1, color: "white", fontSize: 14 }}
                  />
                  <Pressable
                    onPress={handleCloseSearch}
                    hitSlop={10}
                    style={({ pressed }) => [
                      {
                        width: 28,
                        height: 28,
                        borderRadius: 14,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: "rgba(255,255,255,0.08)",
                        borderWidth: 1,
                        borderColor: "rgba(255,255,255,0.12)",
                      },
                      pressed ? { opacity: 0.8, transform: [{ scale: 0.97 }] } : null,
                    ]}
                  >
                    <Ionicons name="close" size={14} color="rgba(240,246,255,0.8)" />
                  </Pressable>
                </View>
              </View>
            )}
            <View className="px-5 pb-4 flex-row items-center gap-12">
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 10, paddingVertical: 2 }}
              >
                {WORLD_OPTIONS.map((world) => {
                  const active = worlds.includes(world.key);
                  return (
                    <Pressable
                      key={world.key}
                      onPress={() => toggleWorld(world.key)}
                      style={({ pressed }) => [
                        {
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 8,
                          paddingHorizontal: 16,
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
                      <Ionicons
                        name={world.icon}
                        size={16}
                        color={active ? "#ffffff" : "rgba(200, 220, 255, 0.7)"}
                      />
                      <Text style={active ? { color: "#ffffff", fontWeight: "600" } : { color: "rgba(255,255,255,0.7)" }}>
                        {world.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Pressable
                  onPress={() => setFiltersOpen(true)}
                  style={({ pressed }) => [
                    {
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: "rgba(255,255,255,0.12)",
                      backgroundColor: "rgba(255,255,255,0.08)",
                      minHeight: tokens.layout.touchTarget,
                    },
                    pressed ? { opacity: 0.85 } : null,
                  ]}
                >
                  <Ionicons name="options-outline" size={16} color="rgba(255,255,255,0.9)" />
                  <Text style={{ color: "rgba(255,255,255,0.85)", fontWeight: "600", fontSize: 12 }}>
                    Filtros
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => router.push("/map")}
                  style={({ pressed }) => [
                    {
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: "rgba(255,255,255,0.12)",
                      backgroundColor: "rgba(255,255,255,0.08)",
                      minHeight: tokens.layout.touchTarget,
                    },
                    pressed ? { opacity: 0.85 } : null,
                  ]}
                >
                  <Ionicons name="map-outline" size={16} color="rgba(255,255,255,0.9)" />
                  <Text style={{ color: "rgba(255,255,255,0.85)", fontWeight: "600", fontSize: 12 }}>
                    Mapa
                  </Text>
                </Pressable>
              </View>
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
        date={dateFilter as DiscoverDateFilter}
        onDateChange={setDateFilter}
        price={priceFilter}
        onPriceChange={setPriceFilter}
      />
    </LiquidBackground>
  );
}
