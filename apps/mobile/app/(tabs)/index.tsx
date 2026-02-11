import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  StyleSheet,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  useWindowDimensions,
  UIManager,
  LayoutAnimation,
  View,
} from "react-native";
import { SafeFlashList } from "../../components/lists/SafeFlashList";
import { tokens, useTranslation } from "@orya/shared";
import { useDebouncedValue, useDiscoverFeed } from "../../features/discover/hooks";
import { useDiscoverStore } from "../../features/discover/store";
import { useIpLocation } from "../../features/onboarding/hooks";
import { resolveCityToAddress } from "../../features/discover/location";
import { GlassSurface } from "../../components/glass/GlassSurface";
import { Ionicons } from "../../components/icons/Ionicons";
import { LiquidBackground } from "../../components/liquid/LiquidBackground";
import { SectionHeader } from "../../components/liquid/SectionHeader";
import { DiscoverDateFilter, DiscoverKind, DiscoverOfferCard, DiscoverPriceFilter } from "../../features/discover/types";
import { FiltersBottomSheet } from "../../components/discover/FiltersBottomSheet";
import { DiscoverGridCard, DiscoverGridCardSkeleton } from "../../components/discover/DiscoverGridCard";
import { useTabBarPadding } from "../../components/navigation/useTabBarPadding";
import { getDistanceKm } from "../../lib/geo";
import { TopAppHeader } from "../../components/navigation/TopAppHeader";
import { useTopHeaderPadding } from "../../components/navigation/useTopHeaderPadding";
import { useTopBarScroll } from "../../components/navigation/useTopBarScroll";
import { useGlobalSearchParams, useRouter } from "expo-router";
import { useScopedTabSwipeBlocker } from "../../components/navigation/TabSwipeProvider";
import { useIsFocused } from "@react-navigation/native";
import { resolveEventInterestTags } from "../../features/events/interestTags";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const animateLayout = () => {
  if (Platform.OS !== "ios") return;
  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
};

type DiscoverListItem =
  | { kind: "skeleton"; key: string }
  | { kind: "offer"; offer: DiscoverOfferCard };

type WorldOption = { key: "padel" | "events" | "services"; label: string; icon: keyof typeof Ionicons.glyphMap };

const GRID_COLUMNS = 3;
const GRID_GAP = 10;
const GRID_PADDING = 20;
const GRID_SKELETON_COUNT = 12;

export default function DiscoverScreen() {
  const router = useRouter();
  const isFocused = useIsFocused();
  const params = useGlobalSearchParams<{ search?: string; q?: string }>();
  const { t } = useTranslation();
  const priceFilter = useDiscoverStore((state) => state.priceFilter);
  const worlds = useDiscoverStore((state) => state.worlds);
  const dateFilter = useDiscoverStore((state) => state.dateFilter);
  const city = useDiscoverStore((state) => state.city);
  const locationLabel = useDiscoverStore((state) => state.locationLabel);
  const locationAddressId = useDiscoverStore((state) => state.locationAddressId);
  const locationLat = useDiscoverStore((state) => state.locationLat);
  const locationLng = useDiscoverStore((state) => state.locationLng);
  const locationSource = useDiscoverStore((state) => state.locationSource);
  const setPriceFilter = useDiscoverStore((state) => state.setPriceFilter);
  const setWorlds = useDiscoverStore((state) => state.setWorlds);
  const setDateFilter = useDiscoverStore((state) => state.setDateFilter);
  const setLocation = useDiscoverStore((state) => state.setLocation);
  const clearLocation = useDiscoverStore((state) => state.clearLocation);
  const distanceKm = useDiscoverStore((state) => state.distanceKm);
  const setDistanceKm = useDiscoverStore((state) => state.setDistanceKm);
  const resetFilters = useDiscoverStore((state) => state.resetFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [dataReady, setDataReady] = useState(false);
  const [hiddenEventIds, setHiddenEventIds] = useState<number[]>([]);
  const hiddenEventSet = useMemo(() => new Set(hiddenEventIds), [hiddenEventIds]);
  const [hiddenTags, setHiddenTags] = useState<string[]>([]);
  const hiddenTagSet = useMemo(() => new Set(hiddenTags), [hiddenTags]);
  const searchInputRef = useRef<TextInput>(null);
  const searchParamsAppliedRef = useRef(false);
  const previousItemsLengthRef = useRef(0);
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 280);
  const debouncedCity = useDebouncedValue(city, 320);
  const shouldFetchLocation = dataReady && locationSource === "NONE";
  const { data: ipLocation } = useIpLocation(shouldFetchLocation);
  const userLat = locationLat ?? ipLocation?.approxLatLon?.lat ?? null;
  const userLon = locationLng ?? ipLocation?.approxLatLon?.lon ?? null;
  const tabBarPadding = useTabBarPadding();
  const topPadding = useTopHeaderPadding(12);
  const topBar = useTopBarScroll();
  const locationResolveRef = useRef(false);
  const { width: screenWidth } = useWindowDimensions();
  const gridItemSize = useMemo(() => {
    const available = screenWidth - GRID_PADDING * 2 - GRID_GAP * (GRID_COLUMNS - 1);
    return Math.max(80, Math.floor(available / GRID_COLUMNS));
  }, [screenWidth]);

  const { block, unblock } = useScopedTabSwipeBlocker();
  const worldScrollBlockedRef = useRef(false);
  const handleWorldScrollStart = useCallback(() => {
    if (worldScrollBlockedRef.current) return;
    worldScrollBlockedRef.current = true;
    block();
  }, [block]);
  const handleWorldScrollEnd = useCallback(() => {
    if (!worldScrollBlockedRef.current) return;
    worldScrollBlockedRef.current = false;
    unblock();
  }, [unblock]);

  const WORLD_OPTIONS: WorldOption[] = useMemo(
    () => [
      { key: "padel", label: t("discover:worlds.padel"), icon: "tennisball" },
      { key: "events", label: t("discover:worlds.events"), icon: "calendar" },
      { key: "services", label: t("discover:worlds.services"), icon: "briefcase" },
    ],
    [t],
  );

  const DATE_FILTER_LABELS: Record<DiscoverDateFilter, string> = useMemo(
    () => ({
      today: t("discover:dateFilters.today"),
      weekend: t("discover:dateFilters.weekend"),
      upcoming: t("discover:dateFilters.upcoming"),
      all: t("discover:dateFilters.all"),
    }),
    [t],
  );

  const PRICE_FILTER_LABELS: Record<DiscoverPriceFilter, string> = useMemo(
    () => ({
      free: t("discover:priceFilters.free"),
      paid: t("discover:priceFilters.paid"),
      all: t("discover:priceFilters.all"),
    }),
    [t],
  );

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

  const isSearchActive = searchOpen;
  const trimmedSearchQuery = debouncedSearchQuery.trim();
  const feedEnabled = dataReady && (!isSearchActive || trimmedSearchQuery.length > 0);
  const canShowMapCta = resolvedKind !== "services";

  const toggleWorld = useCallback(
    (key: "padel" | "events" | "services") => {
      const exists = worlds.includes(key as any);
      const next = exists ? worlds.filter((item) => item !== key) : [...worlds, key];
      setWorlds(next.length === WORLD_OPTIONS.length ? [] : next);
    },
    [setWorlds, worlds],
  );

  const {
    data,
    isFetching,
    isLoading,
    isError,
    isRefetching,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } =
    useDiscoverFeed(
      {
        q: isSearchActive ? trimmedSearchQuery : "",
        type: priceFilter,
        kind: resolvedKind,
        date: dateFilter,
        city: debouncedCity,
      },
      feedEnabled,
    );

  const items = useMemo<DiscoverOfferCard[]>(() => data?.pages.flatMap((page) => page.items) ?? [], [data?.pages]);

  const feedItems = useMemo(() => {
    const filtered = items.filter((item) => {
      if (item.type === "event" && hiddenEventSet.has(item.event.id)) return false;
      if (item.type === "event" && hiddenTagSet.size > 0) {
        const tags = resolveEventInterestTags(item.event);
        if (tags.some((tag) => hiddenTagSet.has(tag))) return false;
      }
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
  }, [distanceKm, hiddenEventSet, hiddenTagSet, isAllWorlds, items, priceFilter, userLat, userLon, worlds]);

  const showSearchIdle = isSearchActive && trimmedSearchQuery.length === 0;
  const showSkeleton = isLoading && items.length === 0 && (!isSearchActive || trimmedSearchQuery.length > 0);
  const showEmpty =
    !isLoading && !isError && feedItems.length === 0 && (!isSearchActive || trimmedSearchQuery.length > 0);
  const activeFilters = useMemo(() => {
    const chips: Array<{ key: string; label: string; onPress: () => void }> = [];
    const locationText = locationLabel || city;
    if (locationSource === "APPLE_MAPS" && locationText) {
      chips.push({
        key: "location",
        label: `Em ${locationText}`,
        onPress: () => clearLocation(),
      });
    }
    if (dateFilter !== "all") {
      chips.push({
        key: `date-${dateFilter}`,
        label: DATE_FILTER_LABELS[dateFilter],
        onPress: () => setDateFilter("all"),
      });
    }
    if (priceFilter !== "all") {
      chips.push({
        key: `price-${priceFilter}`,
        label: PRICE_FILTER_LABELS[priceFilter],
        onPress: () => setPriceFilter("all"),
      });
    }
    if (distanceKm !== 5) {
      chips.push({
        key: `distance-${distanceKm}`,
        label: `Até ${distanceKm} km`,
        onPress: () => setDistanceKm(5),
      });
    }
    if (!isAllWorlds) {
      worlds.forEach((world) => {
        const meta = WORLD_OPTIONS.find((option) => option.key === world);
        chips.push({
          key: `world-${world}`,
          label: meta?.label ?? world,
          onPress: () => toggleWorld(world),
        });
      });
    }
    return chips;
  }, [
    city,
    clearLocation,
    dateFilter,
    distanceKm,
    isAllWorlds,
    locationLabel,
    locationSource,
    priceFilter,
    setDateFilter,
    setDistanceKm,
    setPriceFilter,
    toggleWorld,
    worlds,
  ]);

  const hasActiveFilters = activeFilters.length > 0;
  const showEmptyActions = hasActiveFilters || (!searchOpen && canShowMapCta);
  const showEmptyClear = hasActiveFilters;
  const showEmptyMap = !searchOpen && canShowMapCta;

  const listData = useMemo<DiscoverListItem[]>(
    () =>
      showSearchIdle
        ? []
        : showSkeleton
        ? Array.from({ length: GRID_SKELETON_COUNT }, (_, index) => ({
            kind: "skeleton" as const,
            key: `discover-skeleton-${index}`,
          }))
        : feedItems.map((offer) => ({ kind: "offer" as const, offer })),
    [feedItems, showSearchIdle, showSkeleton],
  );

  const activeKindMeta = useMemo(() => {
    const subtitleParts: string[] = [];
    const locationText = locationLabel || city;
    if (locationText) subtitleParts.push(`Em ${locationText}`);
    if (dateFilter !== "all") subtitleParts.push(DATE_FILTER_LABELS[dateFilter]);
    const subtitle =
      subtitleParts.length > 0
        ? subtitleParts.join(" · ")
        : t("discover:subtitle");
    return { subtitle };
  }, [city, dateFilter, locationLabel]);

  useEffect(() => {
    const previousLength = previousItemsLengthRef.current;
    previousItemsLengthRef.current = items.length;
    if (previousLength === 0 || items.length === 0) return;
    const delta = Math.abs(items.length - previousLength);
    if (delta > 0 && delta <= 6) {
      animateLayout();
    }
  }, [items.length]);

  useEffect(() => {
    setDataReady(isFocused);
  }, [isFocused]);

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
    if (searchParamsAppliedRef.current) return;
    const shouldOpen = params.search === "1" || params.search === "true";
    const query = typeof params.q === "string" ? params.q.trim() : "";
    if (shouldOpen || query) {
      searchParamsAppliedRef.current = true;
      animateLayout();
      setSearchOpen(true);
      if (query) setSearchQuery(query);
      router.setParams({ search: undefined, q: undefined });
    }
  }, [params.q, params.search, router]);

  useEffect(() => {
    if (!searchOpen) return;
    const id = setTimeout(() => searchInputRef.current?.focus(), 120);
    return () => clearTimeout(id);
  }, [searchOpen]);

  const handleCancelSearch = useCallback(() => {
    animateLayout();
    setSearchOpen(false);
    setSearchQuery("");
    searchInputRef.current?.blur();
  }, []);

  const handleOpenSearch = useCallback(() => {
    if (searchOpen) return;
    animateLayout();
    setSearchOpen(true);
  }, [searchOpen]);

  const handleClearSearch = useCallback(() => {
    setSearchQuery("");
    searchInputRef.current?.focus();
  }, []);

  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const endReachedGuard = useRef(true);
  const handleEndReached = useCallback(() => {
    if (!hasNextPage || isFetchingNextPage || isLoading || showSearchIdle) return;
    if (!endReachedGuard.current) return;
    endReachedGuard.current = false;
    fetchNextPage();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, showSearchIdle]);

  const handleScrollBeginDrag = useCallback(() => {
    endReachedGuard.current = true;
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: DiscoverListItem }) => {
      if (item.kind === "skeleton") {
        return <DiscoverGridCardSkeleton size={gridItemSize} style={styles.gridItem} />;
      }
      return (
        <DiscoverGridCard
          offer={item.offer}
          size={gridItemSize}
          source="discover"
          style={styles.gridItem}
        />
      );
    },
    [gridItemSize],
  );

  const keyExtractor = useCallback(
    (item: DiscoverListItem) => (item.kind === "skeleton" ? item.key : item.offer.key),
    [],
  );

  return (
    <View collapsable={false} style={{ flex: 1 }}>
      <LiquidBackground variant="deep">
        <TopAppHeader
          scrollState={topBar}
          variant="custom"
          centerSlot={
            <View style={styles.searchBar}>
              <Ionicons name="search" size={20} color="rgba(240,246,255,0.92)" />
              <View style={styles.searchInputWrap}>
                <TextInput
                  ref={searchInputRef}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder={t("discover:searchPlaceholder")}
                  placeholderTextColor="rgba(235, 244, 255, 0.6)"
                  accessibilityLabel={t("common:actions.search")}
                  returnKeyType="search"
                  autoCorrect={false}
                  editable={searchOpen}
                  onSubmitEditing={() => searchInputRef.current?.blur()}
                  style={styles.searchInput}
                />
                {!searchOpen ? (
                  <Pressable
                    onPress={handleOpenSearch}
                    accessibilityRole="button"
                    accessibilityLabel={t("common:actions.search")}
                    accessibilityHint={t("discover:cta.openSearch")}
                    style={styles.searchOverlay}
                  />
                ) : null}
              </View>
              {searchOpen && searchQuery ? (
                <Pressable
                  onPress={handleClearSearch}
                  accessibilityRole="button"
                  accessibilityLabel={t("common:actions.clearSearch")}
                  hitSlop={10}
                  style={({ pressed }) => [styles.searchClear, pressed ? { opacity: 0.8 } : null]}
                >
                  <Ionicons name="close" size={14} color="rgba(240,246,255,0.9)" />
                </Pressable>
              ) : null}
            </View>
          }
          rightSlot={
            searchOpen ? (
              <Pressable
                onPress={handleCancelSearch}
                accessibilityRole="button"
                accessibilityLabel={t("discover:cta.cancelSearch")}
                hitSlop={10}
                style={({ pressed }) => [styles.searchCancel, pressed ? { opacity: 0.85 } : null]}
              >
                <Text style={styles.searchCancelText}>{t("common:actions.cancel")}</Text>
              </Pressable>
            ) : undefined
          }
          showNotifications={false}
          showMessages={false}
        />
        <SafeFlashList
          contentContainerStyle={{ paddingHorizontal: GRID_PADDING, paddingBottom: tabBarPadding, paddingTop: topPadding }}
          data={listData}
          keyExtractor={keyExtractor}
          keyboardShouldPersistTaps="handled"
          numColumns={GRID_COLUMNS}
          columnWrapperStyle={styles.gridRow}
          estimatedItemSize={gridItemSize}
          refreshing={isRefetching}
          onRefresh={handleRefresh}
          removeClippedSubviews={Platform.OS === "android"}
          initialNumToRender={6}
          maxToRenderPerBatch={6}
          updateCellsBatchingPeriod={40}
          windowSize={7}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.35}
          onScrollBeginDrag={handleScrollBeginDrag}
          onScroll={topBar.onScroll}
          onScrollEndDrag={topBar.onScrollEndDrag}
          onMomentumScrollEnd={topBar.onMomentumScrollEnd}
          scrollEventThrottle={16}
          ListHeaderComponentStyle={styles.listHeader}
          ListHeaderComponent={
            searchOpen ? (
              trimmedSearchQuery.length > 0 ? (
                <View className="px-5 pb-4">
                  <SectionHeader
                    title={t("discover:sections.results")}
                    subtitle={t("discover:sections.resultsFor", { query: trimmedSearchQuery })}
                  />
                </View>
              ) : (
                <View style={{ height: 8 }} />
              )
            ) : (
            <View style={{ width: "100%" }}>
              <View className="px-5 pb-4 flex-row items-center gap-12">
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ flex: 1 }}
                contentContainerStyle={{ gap: 10, paddingVertical: 2 }}
                onScrollBeginDrag={handleWorldScrollStart}
                onScrollEndDrag={handleWorldScrollEnd}
                onMomentumScrollEnd={handleWorldScrollEnd}
              >
                {WORLD_OPTIONS.map((world) => {
                  const active = worlds.includes(world.key);
                  return (
                    <Pressable
                      key={world.key}
                      onPress={() => toggleWorld(world.key)}
                      accessibilityRole="button"
                      accessibilityLabel={t("discover:cta.filterBy", { label: world.label })}
                      accessibilityState={{ selected: active }}
                      style={({ pressed }) => [
                        styles.worldChip,
                        active ? styles.worldChipActive : null,
                        pressed ? { opacity: 0.9 } : null,
                      ]}
                    >
                      <Ionicons
                        name={world.icon}
                        size={18}
                        color={active ? "#ffffff" : "rgba(220, 235, 255, 0.7)"}
                      />
                      <Text style={active ? styles.worldChipTextActive : styles.worldChipText}>{world.label}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Pressable
                  onPress={() => setFiltersOpen(true)}
                  accessibilityRole="button"
                  accessibilityLabel={t("discover:cta.openFilters")}
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
                    {t("common:labels.filters")}
                  </Text>
                </Pressable>
              </View>
            </View>

            <View className="px-5 pb-4">
              <Pressable
                onPress={() => router.push("/padel")}
                className="rounded-2xl border border-white/15 bg-white/8 px-4 py-3"
                accessibilityRole="button"
                accessibilityLabel={t("events:padel.hub.openLabel")}
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-2">
                    <Ionicons name="tennisball" size={16} color="rgba(255,255,255,0.9)" />
                    <Text style={{ color: "rgba(255,255,255,0.9)", fontWeight: "600", fontSize: 13 }}>
                      {t("events:padel.hub.title")}
                    </Text>
                  </View>
                  <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 12 }}>
                    {t("common:actions.explore")}
                  </Text>
                </View>
              </Pressable>
            </View>

            {hasActiveFilters ? (
              <View className="px-5 pb-4">
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 8, paddingVertical: 2 }}
                  onScrollBeginDrag={handleWorldScrollStart}
                  onScrollEndDrag={handleWorldScrollEnd}
                  onMomentumScrollEnd={handleWorldScrollEnd}
                >
                  {activeFilters.map((filter) => (
                    <Pressable
                      key={filter.key}
                      onPress={filter.onPress}
                      accessibilityRole="button"
                      accessibilityLabel={t("discover:cta.removeFilter", { label: filter.label })}
                      style={({ pressed }) => [
                        styles.activeChip,
                        pressed ? { opacity: 0.9 } : null,
                      ]}
                    >
                      <Text style={styles.activeChipText}>{filter.label}</Text>
                      <Ionicons name="close" size={12} color="rgba(240,246,255,0.7)" />
                    </Pressable>
                  ))}
                  <Pressable
                    onPress={resetFilters}
                    accessibilityRole="button"
                    accessibilityLabel={t("discover:cta.clearFilters")}
                    style={({ pressed }) => [
                      styles.clearChip,
                      pressed ? { opacity: 0.9 } : null,
                    ]}
                  >
                    <Ionicons name="refresh" size={14} color="rgba(240,246,255,0.7)" />
                    <Text style={styles.activeChipText}>{t("common:actions.clearFilters")}</Text>
                  </Pressable>
                </ScrollView>
              </View>
            ) : null}

            <View className="px-5">
              <SectionHeader title={t("discover:sections.forYou")} subtitle={activeKindMeta.subtitle} />
            </View>
          </View>
            )
        }
        renderItem={renderItem}
        ListFooterComponentStyle={styles.listFooter}
          ListFooterComponent={
            !showSkeleton ? (
              <View className="pt-2">
              {showSearchIdle ? (
                <GlassSurface intensity={50}>
                  <Text className="text-white/70 text-sm">{t("discover:empty.prompt")}</Text>
                </GlassSurface>
              ) : null}
              {isError ? (
                <GlassSurface intensity={50}>
                  <Text className="text-red-300 text-sm mb-3">{t("discover:empty.loadError")}</Text>
                  <Pressable
                    onPress={() => refetch()}
                    className="rounded-xl bg-white/10 px-4 py-3"
                    style={{ minHeight: tokens.layout.touchTarget }}
                    accessibilityRole="button"
                    accessibilityLabel={t("common:actions.retry")}
                  >
                    <Text className="text-white text-sm font-semibold text-center">{t("common:actions.retry")}</Text>
                  </Pressable>
                </GlassSurface>
              ) : null}
              {showEmpty ? (
                <View style={styles.emptyWrap}>
                  <GlassSurface intensity={45} padding={18} contentStyle={styles.emptyCard}>
                    <View style={styles.emptyIcon}>
                      <Ionicons name="sparkles-outline" size={20} color="rgba(240,246,255,0.85)" />
                    </View>
                    <Text style={styles.emptyTitle}>
                      {searchOpen ? t("discover:empty.noResults") : t("discover:empty.noContent")}
                    </Text>
                    <Text style={styles.emptySubtitle}>
                      {searchOpen
                        ? t("discover:empty.notFound", { query: trimmedSearchQuery })
                        : hasActiveFilters
                          ? t("discover:empty.noResultsFilters")
                          : t("discover:empty.noEventsNearby")}
                    </Text>
                    {showEmptyActions ? (
                      <View style={styles.emptyActions}>
                        {showEmptyClear ? (
                          <View style={styles.emptyActionSlot}>
                            <Pressable
                              onPress={() => resetFilters()}
                              style={({ pressed }) => [
                                styles.emptyCtaIcon,
                                styles.emptyCtaPrimary,
                                pressed ? { opacity: 0.92 } : null,
                              ]}
                              accessibilityRole="button"
                              accessibilityLabel={t("discover:cta.clearFilters")}
                            >
                              <Ionicons name="refresh" size={22} color="#ffffff" />
                            </Pressable>
                          </View>
                        ) : null}
                        {showEmptyMap ? (
                          <View style={showEmptyClear ? styles.emptyActionSlot : styles.emptyActionSingle}>
                            <Pressable
                              onPress={() => router.push("/map")}
                              style={({ pressed }) => [
                                styles.emptyCtaIcon,
                                styles.emptyCtaSecondary,
                                pressed ? { opacity: 0.92 } : null,
                              ]}
                              accessibilityRole="button"
                              accessibilityLabel={t("discover:cta.seeOnMap")}
                            >
                              <Ionicons name="map-outline" size={22} color="rgba(240,246,255,0.95)" />
                            </Pressable>
                          </View>
                        ) : null}
                      </View>
                    ) : null}
                  </GlassSurface>
                  <View style={styles.emptyGhostGrid}>
                    {Array.from({ length: GRID_COLUMNS * 3 }, (_, index) => (
                      <View
                        key={`empty-ghost-${index}`}
                        style={[styles.emptyGhostTile, { width: gridItemSize, height: gridItemSize }]}
                      />
                    ))}
                  </View>
                </View>
              ) : null}
              {!showSearchIdle && isFetchingNextPage ? (
                <View style={styles.gridFooterRow}>
                  {Array.from({ length: GRID_COLUMNS }, (_, index) => (
                    <DiscoverGridCardSkeleton
                      key={`discover-loading-${index}`}
                      size={gridItemSize}
                      style={styles.gridItem}
                    />
                  ))}
                </View>
              ) : null}
              {!showSearchIdle && !showEmpty && !isError && hasNextPage && !isFetchingNextPage ? (
                <Pressable
                  onPress={() => fetchNextPage()}
                  className="mt-3 rounded-xl border border-white/15 bg-white/5 px-4 py-3"
                  style={{ minHeight: tokens.layout.touchTarget }}
                  accessibilityRole="button"
                  accessibilityLabel={t("common:actions.loadMore")}
                >
                  <Text className="text-white text-sm font-semibold text-center">{t("common:actions.loadMore")}</Text>
                </Pressable>
              ) : null}
              {!showSearchIdle && !isLoading && isFetching && !isFetchingNextPage ? (
                <Text className="mt-3 text-white/50 text-center text-xs">{t("common:actions.loading")}</Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  listHeader: {
    width: "100%",
  },
  listFooter: {
    width: "100%",
  },
  gridRow: {
    justifyContent: "flex-start",
    gap: GRID_GAP,
  },
  gridItem: {
    marginBottom: GRID_GAP,
  },
  gridFooterRow: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  emptyWrap: {
    width: "100%",
    gap: 16,
  },
  emptyCard: {
    alignItems: "center",
    gap: 6,
  },
  emptyIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
  },
  emptySubtitle: {
    color: "rgba(230, 245, 255, 0.6)",
    fontSize: 11,
    textAlign: "center",
  },
  emptyActions: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginTop: 10,
  },
  emptyActionSlot: {
    flex: 1,
    alignItems: "center",
  },
  emptyActionSingle: {
    width: "100%",
    maxWidth: 140,
    alignItems: "center",
  },
  emptyCtaIcon: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyCtaPrimary: {
    borderColor: "rgba(170, 220, 255, 0.5)",
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  emptyCtaSecondary: {
    borderColor: "rgba(255,255,255,0.2)",
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  emptyGhostGrid: {
    width: "100%",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: GRID_GAP,
    justifyContent: "flex-start",
  },
  emptyGhostTile: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    backgroundColor: "rgba(255,255,255,0.12)",
    marginRight: 10,
  },
  searchInputWrap: {
    flex: 1,
    position: "relative",
  },
  searchOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  searchInput: {
    flex: 1,
    color: "white",
    fontSize: 14,
    fontWeight: "600",
    paddingVertical: 0,
  },
  searchClear: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  searchCancel: {
    height: 42,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  searchCancelText: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 14,
    fontWeight: "600",
  },
  searchPlaceholder: {
    color: "rgba(235, 244, 255, 0.72)",
    fontSize: 14,
    fontWeight: "600",
  },
  worldChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: "rgba(255,255,255,0.08)",
    minHeight: tokens.layout.touchTarget + 2,
  },
  worldChipActive: {
    borderColor: "rgba(170, 220, 255, 0.6)",
    backgroundColor: "rgba(255,255,255,0.2)",
    shadowColor: "rgba(120, 210, 255, 0.4)",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
  },
  worldChipText: {
    color: "rgba(235, 245, 255, 0.75)",
    fontSize: 14,
    fontWeight: "600",
  },
  worldChipTextActive: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.06)",
    minHeight: tokens.layout.touchTarget - 6,
  },
  filterChipActive: {
    borderColor: "rgba(170, 220, 255, 0.55)",
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  filterChipText: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 12,
    fontWeight: "600",
  },
  filterChipTextActive: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "600",
  },
  activeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: "rgba(255,255,255,0.1)",
    minHeight: tokens.layout.touchTarget - 8,
  },
  clearChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    backgroundColor: "rgba(255,255,255,0.06)",
    minHeight: tokens.layout.touchTarget - 8,
  },
  activeChipText: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 12,
    fontWeight: "600",
  },
});
