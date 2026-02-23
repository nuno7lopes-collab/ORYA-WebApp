import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  StyleSheet,
  Platform,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  UIManager,
  LayoutAnimation,
  View,
} from "react-native";
import { SafeFlashList } from "../../components/lists/SafeFlashList";
import { tokens, useTranslation } from "@orya/shared";
import {
  useDebouncedValue,
  useDiscoverFeed,
} from "../../features/discover/hooks";
import { useDiscoverStore } from "../../features/discover/store";
import { useIpLocation } from "../../features/onboarding/hooks";
import { resolveCityToAddress } from "../../features/discover/location";
import { GlassSurface } from "../../components/glass/GlassSurface";
import { Ionicons } from "../../components/icons/Ionicons";
import { LiquidBackground } from "../../components/liquid/LiquidBackground";
import { SectionHeader } from "../../components/liquid/SectionHeader";
import {
  DiscoverDateFilter,
  DiscoverKind,
  DiscoverOfferCard,
  DiscoverPriceFilter,
} from "../../features/discover/types";
import { FiltersBottomSheet } from "../../components/discover/FiltersBottomSheet";
import {
  DiscoverGridCard,
  DiscoverGridCardSkeleton,
} from "../../components/discover/DiscoverGridCard";
import { useTabBarPadding } from "../../components/navigation/useTabBarPadding";
import { getDistanceKm } from "../../lib/geo";
import { TopAppHeader } from "../../components/navigation/TopAppHeader";
import { useTopHeaderPadding } from "../../components/navigation/useTopHeaderPadding";
import { useTopBarScroll } from "../../components/navigation/useTopBarScroll";
import { useGlobalSearchParams, useRouter } from "expo-router";
import { useScopedTabSwipeBlocker } from "../../components/navigation/TabSwipeProvider";
import { useIsFocused } from "@react-navigation/native";
import { safePush } from "../../lib/navigation";
import { useFocusFrameMonitor } from "../../components/perf/useFocusFrameMonitor";

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const animateLayout = () => {
  if (Platform.OS !== "ios") return;
  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
};

type DiscoverListItem =
  | { kind: "skeleton"; key: string }
  | { kind: "offer"; offer: DiscoverOfferCard };

type WorldOption = {
  key: "padel" | "events" | "services";
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
};
type WorldFilterKey = "all" | WorldOption["key"];
type WorldFilterOption = {
  key: WorldFilterKey;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
};

const GRID_COLUMNS_PHONE = 2;
const GRID_COLUMNS_MEDIUM = 3;
const GRID_COLUMNS_LARGE = 4;
const GRID_BREAKPOINT_MEDIUM = 600;
const GRID_BREAKPOINT_LARGE = 920;
const GRID_GAP = 10;
const GRID_PADDING = 20;
const GRID_SKELETON_ROWS = 4;
const SERVICE_ROW_MIN_HEIGHT = 136;

export default function DiscoverScreen() {
  const router = useRouter();
  const isFocused = useIsFocused();
  const params = useGlobalSearchParams<{ search?: string; q?: string; world?: string }>();
  const { t } = useTranslation();
  const priceFilter = useDiscoverStore((state) => state.priceFilter);
  const worlds = useDiscoverStore((state) => state.worlds);
  const dateFilter = useDiscoverStore((state) => state.dateFilter);
  const city = useDiscoverStore((state) => state.city);
  const locationLabel = useDiscoverStore((state) => state.locationLabel);
  const locationAddressId = useDiscoverStore(
    (state) => state.locationAddressId,
  );
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
  const [dataReady, setDataReady] = useState(false);
  const searchParamsAppliedRef = useRef(false);
  const previousItemsLengthRef = useRef(0);
  const debouncedCity = useDebouncedValue(city, 320);
  const shouldFetchLocation = dataReady && locationSource === "NONE";
  const { data: ipLocation } = useIpLocation(shouldFetchLocation);
  const userLat = locationLat ?? ipLocation?.approxLatLon?.lat ?? null;
  const userLon = locationLng ?? ipLocation?.approxLatLon?.lon ?? null;
  const tabBarPadding = useTabBarPadding();
  const topPadding = useTopHeaderPadding(12);
  const topBar = useTopBarScroll();
  useFocusFrameMonitor("screen_discover");
  const locationResolveRef = useRef(false);
  const { width: screenWidth } = useWindowDimensions();

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
      {
        key: "services",
        label: t("discover:worlds.services"),
        icon: "briefcase",
      },
    ],
    [t],
  );
  const WORLD_FILTER_OPTIONS: WorldFilterOption[] = useMemo(
    () => [{ key: "all", label: t("discover:priceFilters.all"), icon: "sparkles" }, ...WORLD_OPTIONS],
    [WORLD_OPTIONS, t],
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

  const isAllWorlds =
    worlds.length === 0 || worlds.length === WORLD_OPTIONS.length;
  const isServicesOnlyWorld =
    !isAllWorlds && worlds.length === 1 && worlds[0] === "services";
  const shouldUseRowLayout =
    Platform.OS === "web" || Platform.OS === "ios" || isServicesOnlyWorld;
  const resolvedKind: DiscoverKind = isAllWorlds
    ? "all"
    : worlds.length === 1
      ? worlds[0] === "services"
        ? "services"
        : worlds[0] === "padel"
          ? "padel"
          : "events"
      : "all";
  const listColumns = useMemo(() => {
    if (shouldUseRowLayout) return 1;
    if (screenWidth >= GRID_BREAKPOINT_LARGE) return GRID_COLUMNS_LARGE;
    if (screenWidth >= GRID_BREAKPOINT_MEDIUM) return GRID_COLUMNS_MEDIUM;
    return GRID_COLUMNS_PHONE;
  }, [screenWidth, shouldUseRowLayout]);
  const cardLayout: "grid" | "row" = shouldUseRowLayout ? "row" : "grid";
  const gridItemWidth = useMemo(() => {
    const available =
      screenWidth - GRID_PADDING * 2 - GRID_GAP * (listColumns - 1);
    const rawWidth = Math.floor(available / listColumns);

    if (shouldUseRowLayout) {
      return Math.max(240, rawWidth);
    }

    const minSize =
      listColumns === GRID_COLUMNS_PHONE
        ? 140
        : listColumns === GRID_COLUMNS_MEDIUM
          ? 116
          : 102;
    return Math.max(minSize, rawWidth);
  }, [listColumns, screenWidth, shouldUseRowLayout]);
  const gridItemHeight = useMemo(() => {
    if (shouldUseRowLayout) {
      return Math.max(
        SERVICE_ROW_MIN_HEIGHT,
        Math.round(gridItemWidth * 0.46),
      );
    }
    const ratio = listColumns === GRID_COLUMNS_PHONE ? 1.18 : 1.12;
    return Math.round(gridItemWidth * ratio);
  }, [gridItemWidth, listColumns, shouldUseRowLayout]);

  const feedEnabled = dataReady;
  const canShowMapCta = resolvedKind !== "services";

  const toggleWorld = useCallback(
    (key: "padel" | "events" | "services") => {
      const exists = worlds.includes(key);
      const next = exists
        ? worlds.filter((item) => item !== key)
        : [...worlds, key];
      setWorlds(next.length === WORLD_OPTIONS.length ? [] : next);
    },
    [setWorlds, worlds],
  );
  const handleSelectWorld = useCallback(
    (key: WorldFilterKey) => {
      if (key === "all") {
        setWorlds([]);
        return;
      }
      toggleWorld(key);
    },
    [setWorlds, toggleWorld],
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
  } = useDiscoverFeed(
    {
      q: "",
      type: priceFilter,
      kind: resolvedKind,
      date: dateFilter,
      city: debouncedCity,
    },
    feedEnabled,
  );

  const items = useMemo<DiscoverOfferCard[]>(
    () => data?.pages.flatMap((page) => page.items) ?? [],
    [data?.pages],
  );

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
          const matchesServices =
            worlds.includes("services") && !isPadelService;
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
  }, [
    distanceKm,
    isAllWorlds,
    items,
    userLat,
    userLon,
    worlds,
  ]);

  const showSkeleton = isLoading && items.length === 0;
  const showEmpty =
    !isLoading &&
    !isError &&
    feedItems.length === 0;
  const activeFilters = useMemo(() => {
    const chips: Array<{ key: string; label: string; onPress: () => void }> =
      [];
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
        label: t("discover:filters.appliedDistance", { distance: distanceKm }),
        onPress: () => setDistanceKm(5),
      });
    }
    const appliedLocation = locationLabel.trim() || city.trim();
    const shouldCountLocation =
      locationSource === "APPLE_MAPS" && appliedLocation.length > 0;
    if (shouldCountLocation) {
      chips.push({
        key: "location",
        label: t("discover:filters.appliedLocation", { location: appliedLocation }),
        onPress: () => clearLocation(),
      });
    }
    return chips;
  }, [
    city,
    dateFilter,
    distanceKm,
    clearLocation,
    locationLabel,
    locationSource,
    priceFilter,
    setDateFilter,
    setDistanceKm,
    setPriceFilter,
    t,
  ]);

  const hasActiveFilters = activeFilters.length > 0;
  const activeFiltersCount = activeFilters.length;
  const showEmptyActions = hasActiveFilters || canShowMapCta;
  const showEmptyClear = hasActiveFilters;
  const showEmptyMap = canShowMapCta;

  const listData = useMemo<DiscoverListItem[]>(
    () =>
      showSkeleton
        ? Array.from({
            length: shouldUseRowLayout
              ? 6
              : listColumns * GRID_SKELETON_ROWS,
          }, (_, index) => ({
            kind: "skeleton" as const,
            key: `discover-skeleton-${index}`,
          }))
        : feedItems.map((offer) => ({ kind: "offer" as const, offer })),
    [feedItems, listColumns, shouldUseRowLayout, showSkeleton],
  );

  const activeKindMeta = useMemo(() => {
    const subtitleParts: string[] = [];
    if (dateFilter !== "all") subtitleParts.push(DATE_FILTER_LABELS[dateFilter]);
    if (!isAllWorlds && worlds.length === 1) {
      const singleWorld = WORLD_OPTIONS.find((option) => option.key === worlds[0]);
      if (singleWorld?.label) subtitleParts.push(singleWorld.label);
    }
    const subtitle =
      subtitleParts.length > 0
        ? subtitleParts.join(" · ")
        : t("discover:subtitle");
    return { subtitle };
  }, [DATE_FILTER_LABELS, WORLD_OPTIONS, dateFilter, isAllWorlds, t, worlds]);

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
      setLocation({
        city: ipLocation.city,
        label: ipLocation.city,
        source: "IP",
      });
    }
    if (locationResolveRef.current) return;
    if (locationAddressId) return;
    locationResolveRef.current = true;
    resolveCityToAddress(ipLocation.city)
      .then((details) => {
        if (!details?.addressId) return;
        const canonical =
          (details.canonical as Record<string, unknown> | null) ?? null;
        const cityFromCanonical =
          (canonical &&
          typeof canonical.city === "string" &&
          canonical.city.trim()
            ? canonical.city.trim()
            : null) ??
          details.city ??
          ipLocation.city;
        setLocation({
          city: cityFromCanonical ?? "",
          label: details.formattedAddress ?? ipLocation.city ?? "",
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
    const worldParamRaw = typeof params.world === "string" ? params.world.trim().toLowerCase() : "";
    const worldParam =
      worldParamRaw === "padel" || worldParamRaw === "events" || worldParamRaw === "services"
        ? worldParamRaw
        : null;
    if (shouldOpen || query || worldParam) {
      searchParamsAppliedRef.current = true;
      if (worldParam) {
        setWorlds([worldParam]);
      }
      router.setParams({ search: undefined, q: undefined, world: undefined });
      if (!shouldOpen && !query) return;
      const nextRoute = query
        ? ({ pathname: "/search", params: { q: query } } as const)
        : ({ pathname: "/search" } as const);
      safePush(router, nextRoute);
    }
  }, [params.q, params.search, params.world, router, setWorlds]);

  const handleOpenSearch = useCallback(() => {
    safePush(router, "/search");
  }, [router]);

  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const endReachedGuard = useRef(true);
  const handleEndReached = useCallback(() => {
    if (!hasNextPage || isFetchingNextPage || isLoading) return;
    if (!endReachedGuard.current) return;
    endReachedGuard.current = false;
    fetchNextPage();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage, isLoading]);

  const handleScrollBeginDrag = useCallback(() => {
    endReachedGuard.current = true;
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: DiscoverListItem }) => {
      if (item.kind === "skeleton") {
        return (
          <DiscoverGridCardSkeleton
            size={gridItemWidth}
            height={gridItemHeight}
            style={styles.gridItem}
          />
        );
      }
      return (
        <DiscoverGridCard
          offer={item.offer}
          size={gridItemWidth}
          height={gridItemHeight}
          layout={cardLayout}
          source="discover"
          style={styles.gridItem}
        />
      );
    },
    [cardLayout, gridItemHeight, gridItemWidth],
  );
  const getItemLayout = useCallback(
    (_data: ArrayLike<DiscoverListItem> | null | undefined, index: number) => ({
      length: gridItemHeight + GRID_GAP,
      offset: (gridItemHeight + GRID_GAP) * index,
      index,
    }),
    [gridItemHeight],
  );

  const keyExtractor = useCallback(
    (item: DiscoverListItem) =>
      item.kind === "skeleton" ? item.key : item.offer.key,
    [],
  );

  return (
    <View collapsable={false} style={{ flex: 1 }}>
      <LiquidBackground variant="deep">
        <TopAppHeader
          scrollState={topBar}
          variant="custom"
          centerSlot={
            <Pressable
              onPress={handleOpenSearch}
              accessibilityRole="button"
              accessibilityLabel={t("common:actions.search")}
              accessibilityHint={t("discover:cta.openSearch")}
              style={({ pressed }) => [
                styles.searchBar,
                pressed ? styles.searchBarPressed : null,
              ]}
            >
              <Ionicons
                name="search"
                size={20}
                color="rgba(236,246,255,0.78)"
              />
              <Text style={styles.searchPlaceholder}>
                {t("discover:searchPlaceholder")}
              </Text>
            </Pressable>
          }
          showNotifications={false}
          showMessages={false}
        />
        <SafeFlashList
          key={`discover-grid-${cardLayout}-${listColumns}`}
          contentContainerStyle={{
            paddingHorizontal: GRID_PADDING,
            paddingBottom: tabBarPadding,
            paddingTop: topPadding,
          }}
          data={listData}
          keyExtractor={keyExtractor}
          keyboardShouldPersistTaps="handled"
          numColumns={listColumns}
          columnWrapperStyle={listColumns > 1 ? styles.gridRow : undefined}
          estimatedItemSize={gridItemHeight + GRID_GAP}
          refreshing={isRefetching}
          onRefresh={handleRefresh}
          removeClippedSubviews
          initialNumToRender={6}
          maxToRenderPerBatch={6}
          updateCellsBatchingPeriod={16}
          windowSize={5}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.35}
          onScrollBeginDrag={handleScrollBeginDrag}
          onScroll={topBar.onScroll}
          onScrollEndDrag={topBar.onScrollEndDrag}
          onMomentumScrollEnd={topBar.onMomentumScrollEnd}
          scrollEventThrottle={16}
          disableVirtualization={Platform.OS === "web"}
          getItemLayout={getItemLayout}
          ListHeaderComponentStyle={styles.listHeader}
          ListHeaderComponent={
            <View style={{ width: "100%" }}>
              <View style={styles.controlsRow}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.worldsRow}
                  onScrollBeginDrag={handleWorldScrollStart}
                  onScrollEndDrag={handleWorldScrollEnd}
                  onMomentumScrollEnd={handleWorldScrollEnd}
                >
                  {WORLD_FILTER_OPTIONS.map((world) => {
                    const active = world.key === "all" ? isAllWorlds : worlds.includes(world.key);
                    return (
                      <Pressable
                        key={world.key}
                        onPress={() => handleSelectWorld(world.key)}
                        accessibilityRole="button"
                        accessibilityLabel={t("discover:cta.filterBy", {
                          label: world.label,
                        })}
                        accessibilityState={{ selected: active }}
                        style={({ pressed }) => [
                          styles.worldPill,
                          active ? styles.worldPillActive : null,
                          pressed ? { opacity: 0.9 } : null,
                        ]}
                      >
                        <View
                          style={[
                            styles.worldPillIconWrap,
                            active ? styles.worldPillIconWrapActive : null,
                          ]}
                        >
                          <Ionicons
                            name={world.icon}
                            size={18}
                            color={
                              active ? "#ffffff" : "rgba(205, 225, 255, 0.82)"
                            }
                          />
                        </View>
                        <Text
                          style={
                            active
                              ? styles.worldPillTextActive
                              : styles.worldPillText
                          }
                          numberOfLines={1}
                          allowFontScaling={false}
                        >
                          {world.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.quickFiltersScroll}
                  onScrollBeginDrag={handleWorldScrollStart}
                  onScrollEndDrag={handleWorldScrollEnd}
                  onMomentumScrollEnd={handleWorldScrollEnd}
                >
                  <Pressable
                    onPress={() => setFiltersOpen(true)}
                    accessibilityRole="button"
                    accessibilityLabel={t("discover:cta.openFilters")}
                    style={({ pressed }) => [
                      styles.filtersButton,
                      hasActiveFilters ? styles.filtersButtonActive : null,
                      pressed ? { opacity: 0.85 } : null,
                    ]}
                  >
                    <Ionicons
                      name="options-outline"
                      size={16}
                      color="rgba(255,255,255,0.9)"
                    />
                    <Text style={styles.filtersButtonText} allowFontScaling={false}>
                      {t("common:labels.filters")}
                    </Text>
                    {activeFiltersCount > 0 ? (
                      <View style={styles.filtersBadge}>
                        <Text style={styles.filtersBadgeText} allowFontScaling={false}>
                          {activeFiltersCount}
                        </Text>
                      </View>
                    ) : null}
                  </Pressable>
                </ScrollView>
              </View>

              <View style={styles.headerSectionWrap}>
                <SectionHeader
                  title={t("discover:sections.forYou")}
                  subtitle={activeKindMeta.subtitle}
                />
                {hasActiveFilters ? (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.activeFiltersRow}
                    onScrollBeginDrag={handleWorldScrollStart}
                    onScrollEndDrag={handleWorldScrollEnd}
                    onMomentumScrollEnd={handleWorldScrollEnd}
                  >
                    {activeFilters.map((chip) => (
                      <Pressable
                        key={chip.key}
                        onPress={chip.onPress}
                        accessibilityRole="button"
                        accessibilityLabel={chip.label}
                        style={({ pressed }) => [
                          styles.activeFilterChip,
                          pressed ? styles.activeFilterChipPressed : null,
                        ]}
                      >
                        <Text style={styles.activeFilterChipText} numberOfLines={1}>
                          {chip.label}
                        </Text>
                        <Ionicons
                          name="close"
                          size={14}
                          color="rgba(236,246,255,0.94)"
                        />
                      </Pressable>
                    ))}
                  </ScrollView>
                ) : null}
              </View>
            </View>
          }
          renderItem={renderItem}
          ListFooterComponentStyle={styles.listFooter}
          ListFooterComponent={
            !showSkeleton ? (
              <View className="pt-2">
                {isError ? (
                  <GlassSurface intensity={50}>
                    <Text className="text-red-300 text-sm mb-3">
                      {t("discover:empty.loadError")}
                    </Text>
                    <Pressable
                      onPress={() => refetch()}
                      className="rounded-xl bg-white/10 px-4 py-3"
                      style={{ minHeight: tokens.layout.touchTarget }}
                      accessibilityRole="button"
                      accessibilityLabel={t("common:actions.retry")}
                    >
                      <Text className="text-white text-sm font-semibold text-center">
                        {t("common:actions.retry")}
                      </Text>
                    </Pressable>
                  </GlassSurface>
                ) : null}
                {showEmpty ? (
                  <View style={styles.emptyWrap}>
                    <GlassSurface
                      intensity={45}
                      padding={18}
                      contentStyle={styles.emptyCard}
                    >
                      <View style={styles.emptyIcon}>
                        <Ionicons
                          name="sparkles-outline"
                          size={20}
                          color="rgba(240,246,255,0.85)"
                        />
                      </View>
                      <Text style={styles.emptyTitle}>
                        {t("discover:empty.noContent")}
                      </Text>
                      <Text style={styles.emptySubtitle}>
                        {hasActiveFilters
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
                                accessibilityLabel={t(
                                  "discover:cta.clearFilters",
                                )}
                              >
                                <Ionicons
                                  name="refresh"
                                  size={22}
                                  color="#ffffff"
                                />
                              </Pressable>
                            </View>
                          ) : null}
                          {showEmptyMap ? (
                            <View
                              style={
                                showEmptyClear
                                  ? styles.emptyActionSlot
                                  : styles.emptyActionSingle
                              }
                            >
                              <Pressable
                                onPress={() => safePush(router, "/map")}
                                style={({ pressed }) => [
                                  styles.emptyCtaIcon,
                                  styles.emptyCtaSecondary,
                                  pressed ? { opacity: 0.92 } : null,
                                ]}
                                accessibilityRole="button"
                                accessibilityLabel={t("discover:cta.seeOnMap")}
                              >
                                <Ionicons
                                  name="map-outline"
                                  size={22}
                                  color="rgba(240,246,255,0.95)"
                                />
                              </Pressable>
                            </View>
                          ) : null}
                        </View>
                      ) : null}
                    </GlassSurface>
                    <View style={styles.emptyGhostGrid}>
                      {Array.from({ length: listColumns * 3 }, (_, index) => (
                        <View
                          key={`empty-ghost-${index}`}
                          style={[
                            styles.emptyGhostTile,
                            { width: gridItemWidth, height: gridItemHeight },
                          ]}
                        />
                      ))}
                    </View>
                  </View>
                ) : null}
                {isFetchingNextPage ? (
                  <View style={styles.gridFooterRow}>
                    {Array.from({ length: listColumns }, (_, index) => (
                      <DiscoverGridCardSkeleton
                        key={`discover-loading-${index}`}
                        size={gridItemWidth}
                        height={gridItemHeight}
                        style={styles.gridItem}
                      />
                    ))}
                  </View>
                ) : null}
                {!showEmpty &&
                !isError &&
                hasNextPage &&
                !isFetchingNextPage ? (
                  <Pressable
                    onPress={() => fetchNextPage()}
                    className="mt-3 rounded-xl border border-white/15 bg-white/5 px-4 py-3"
                    style={{ minHeight: tokens.layout.touchTarget }}
                    accessibilityRole="button"
                    accessibilityLabel={t("common:actions.loadMore")}
                  >
                    <Text className="text-white text-sm font-semibold text-center">
                      {t("common:actions.loadMore")}
                    </Text>
                  </Pressable>
                ) : null}
                {!isLoading &&
                isFetching &&
                !isFetchingNextPage ? (
                  <Text className="mt-3 text-white/50 text-center text-xs">
                    {t("common:actions.loading")}
                  </Text>
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
  controlsRow: {
    paddingBottom: 14,
    gap: 12,
  },
  worldsRow: {
    gap: 10,
    paddingBottom: 6,
    paddingRight: 2,
  },
  worldPill: {
    minWidth: 108,
    minHeight: 84,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(204,233,255,0.24)",
    backgroundColor: "rgba(255,255,255,0.12)",
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  worldPillActive: {
    borderColor: "rgba(175, 226, 255, 0.82)",
    backgroundColor: "rgba(255,255,255,0.28)",
    shadowColor: "rgba(118, 206, 255, 0.58)",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.34,
    shadowRadius: 16,
    elevation: 4,
  },
  worldPillIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "rgba(216,238,255,0.3)",
    backgroundColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  worldPillIconWrapActive: {
    borderColor: "rgba(206,236,255,0.76)",
    backgroundColor: "rgba(164,221,255,0.28)",
  },
  worldPillText: {
    color: "rgba(232, 244, 255, 0.86)",
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
  worldPillTextActive: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
  },
  quickFiltersScroll: {
    paddingBottom: 4,
    gap: 8,
  },
  filtersButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10.5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(209,235,255,0.24)",
    backgroundColor: "rgba(255,255,255,0.13)",
    minHeight: tokens.layout.touchTarget,
    justifyContent: "center",
  },
  filtersButtonActive: {
    borderColor: "rgba(177, 226, 255, 0.75)",
    backgroundColor: "rgba(255,255,255,0.25)",
  },
  filtersButtonText: {
    color: "rgba(248,252,255,0.96)",
    fontWeight: "600",
    fontSize: 12.5,
  },
  filtersBadge: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: 999,
    backgroundColor: "rgba(171, 225, 255, 0.94)",
    alignItems: "center",
    justifyContent: "center",
  },
  filtersBadgeText: {
    color: "#08111c",
    fontSize: 10,
    fontWeight: "700",
  },
  headerSectionWrap: {
    paddingBottom: 6,
    gap: 10,
  },
  activeFiltersRow: {
    gap: 8,
    paddingRight: 8,
  },
  activeFilterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "rgba(196,231,255,0.3)",
    backgroundColor: "rgba(16, 27, 41, 0.66)",
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  activeFilterChipPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.98 }],
  },
  activeFilterChipText: {
    color: "rgba(236,246,255,0.94)",
    fontSize: 11.5,
    fontWeight: "600",
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
    flexShrink: 0,
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
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    height: 48,
    minHeight: 48,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(208,234,255,0.2)",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  searchBarPressed: {
    backgroundColor: "rgba(255,255,255,0.14)",
    borderColor: "rgba(208,234,255,0.3)",
  },
  searchPlaceholder: {
    flex: 1,
    color: "rgba(238,246,255,0.8)",
    fontSize: 16,
    fontWeight: "500",
  },
});
