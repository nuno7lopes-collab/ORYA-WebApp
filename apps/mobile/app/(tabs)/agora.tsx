import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Animated, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { tokens, useTranslation } from "@orya/shared";
import { GlassCard } from "../../components/liquid/GlassCard";
import { LiquidBackground } from "../../components/liquid/LiquidBackground";
import { useAgoraFeed } from "../../features/agora/hooks";
import { useIpLocation } from "../../features/onboarding/hooks";
import { EventCardSquare, EventCardSquareSkeleton } from "../../components/events/EventCardSquare";
import { useTabBarPadding } from "../../components/navigation/useTabBarPadding";
import { TAB_BAR_HEIGHT } from "../../components/navigation/FloatingTabBar";
import { TopAppHeader } from "../../components/navigation/TopAppHeader";
import { TopTicketsButton } from "../../components/navigation/TopTicketsButton";
import { useTopHeaderPadding } from "../../components/navigation/useTopHeaderPadding";
import { useTopBarScroll } from "../../components/navigation/useTopBarScroll";
import { useRouter } from "expo-router";
import { useIsFocused, useNavigation } from "@react-navigation/native";
import { Ionicons } from "../../components/icons/Ionicons";
import { resolveEventInterestTags } from "../../features/events/interestTags";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { SafeFlashList } from "../../components/lists/SafeFlashList";

const MAP_BUTTON_SIZE = 44;
const MAP_ICON_SIZE = 20;
const MAP_ICON_NUDGE_Y = -1;
const MAP_ICON_BOX = 26;

export default function AgoraScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const [dataReady, setDataReady] = useState(true);
  const {
    items,
    isLoading,
    isError,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    feedError,
    refetch,
  } = useAgoraFeed(dataReady);
  const { data: ipLocation } = useIpLocation(dataReady);
  const userLat = ipLocation?.approxLatLon?.lat ?? null;
  const userLon = ipLocation?.approxLatLon?.lon ?? null;
  const tabBarPadding = useTabBarPadding();
  const topPadding = useTopHeaderPadding(16);
  const topBar = useTopBarScroll({ hideOffset: 16, showOffset: 50});
  const insets = useSafeAreaInsets();
  const floatingMapBottom = TAB_BAR_HEIGHT + Math.max(insets.bottom, 8) + 32;
  const [hiddenEventIds, setHiddenEventIds] = useState<number[]>([]);
  const hiddenSet = useMemo(() => new Set(hiddenEventIds), [hiddenEventIds]);
  const [hiddenTags, setHiddenTags] = useState<string[]>([]);
  const hiddenTagSet = useMemo(() => new Set(hiddenTags), [hiddenTags]);
  const [manualRefreshing, setManualRefreshing] = useState(false);

  const showSkeleton = isLoading && items.length === 0;
  const handleRefresh = useCallback(() => {
    if (manualRefreshing) return;
    setManualRefreshing(true);
    refetch().finally(() => {
      setManualRefreshing(false);
    });
  }, [manualRefreshing, refetch]);

  const filteredItems = useMemo(() => {
    const deduped = new Map<number, (typeof items)[number]>();
    items.forEach((item) => {
      if (!deduped.has(item.id)) {
        deduped.set(item.id, item);
      }
    });
    return Array.from(deduped.values()).filter((item) => {
      if (hiddenSet.has(item.id)) return false;
      if (hiddenTagSet.size > 0) {
        const tags = resolveEventInterestTags(item);
        if (tags.some((tag) => hiddenTagSet.has(tag))) return false;
      }
      return true;
    });
  }, [hiddenSet, hiddenTagSet, items]);

  const listData = useMemo(
    () =>
      showSkeleton
        ? Array.from({ length: 5 }, (_, index) => ({ kind: "skeleton" as const, key: `agora-skeleton-${index}` }))
        : filteredItems.map((event) => ({ kind: "event" as const, event })),
    [filteredItems, showSkeleton],
  );

  const keyExtractor = useCallback(
    (item: (typeof listData)[number]) =>
      item.kind === "skeleton" ? item.key : `agora-${item.event.id}-${item.event.slug ?? "event"}`,
    [],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: (typeof listData)[number]; index: number }) => {
      if (item.kind === "skeleton") return <EventCardSquareSkeleton />;
      return (
        <EventCardSquare
          event={item.event}
          index={index}
          userLat={userLat}
          userLon={userLon}
          source="agora"
          showCountdown
          onHide={(payload) => {
            setHiddenEventIds((prev) =>
              prev.includes(payload.eventId) ? prev : [...prev, payload.eventId],
            );
            if (payload.scope === "category" && payload.tag) {
              setHiddenTags((prev) => (prev.includes(payload.tag!) ? prev : [...prev, payload.tag!]));
            }
          }}
        />
      );
    },
    [userLat, userLon],
  );


  useEffect(() => {
    if (isFocused) setDataReady(true);
  }, [isFocused]);

  useEffect(() => {
    if (isFocused) {
      refetch();
    }
  }, [isFocused, refetch]);

  useEffect(() => {
    if (!isError) return;
    const formatError = (err: unknown) =>
      err instanceof Error
        ? { name: err.name, message: err.message, stack: err.stack }
        : { message: String(err ?? "") };
    console.warn("[agora] feed_error", {
      feed: feedError ? formatError(feedError) : null,
    });
  }, [feedError, isError]);

  return (
    <View collapsable={false} style={{ flex: 1 }}>
      <LiquidBackground variant="solid">
        <TopAppHeader
          scrollState={topBar}
          variant="title"
          title={t("agora:title")}
          titleAlign="center"
          leftSlot={<TopTicketsButton />}
          showNotifications
          showMessages={false}
        />
        <SafeFlashList
          data={listData}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          onRefresh={handleRefresh}
          refreshing={manualRefreshing}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: tabBarPadding, paddingTop: topPadding }}
          onScroll={topBar.onScroll}
          onScrollEndDrag={topBar.onScrollEndDrag}
          onMomentumScrollEnd={topBar.onMomentumScrollEnd}
          scrollEventThrottle={16}
          removeClippedSubviews={Platform.OS === "android"}
          initialNumToRender={4}
          maxToRenderPerBatch={4}
          updateCellsBatchingPeriod={40}
          windowSize={5}
          ListHeaderComponent={
            <View>
              {isError ? (
                <GlassCard className="mb-5" intensity={52}>
                  <Text className="text-red-300 text-sm mb-3">{t("agora:error")}</Text>
                  <Pressable
                    className="rounded-xl bg-white/10 px-4 py-3"
                    onPress={() => refetch()}
                    style={{ minHeight: tokens.layout.touchTarget }}
                    accessibilityRole="button"
                    accessibilityLabel={t("common:actions.retry")}
                  >
                    <Text className="text-white text-sm font-semibold text-center">
                      {t("common:actions.retry")}
                    </Text>
                  </Pressable>
                </GlassCard>
              ) : null}
              <View style={{ height: 8 }} />
            </View>
          }
          ListEmptyComponent={
            !showSkeleton && !isError ? (
              <GlassCard intensity={50}>
                <Text className="text-white/70 text-sm">{t("agora:empty")}</Text>
                <Pressable
                  onPress={() => navigation.navigate("index" as never)}
                  className="mt-3 rounded-xl border border-white/15 bg-white/5 px-4 py-3"
                  style={{ minHeight: tokens.layout.touchTarget }}
                  accessibilityRole="button"
                  accessibilityLabel={t("agora:ctaDiscover")}
                >
                  <Text className="text-white text-sm font-semibold text-center">
                    {t("agora:ctaDiscover")}
                  </Text>
                </Pressable>
              </GlassCard>
            ) : null
          }
          ListFooterComponent={
            isFetchingNextPage ? (
              <View style={{ paddingVertical: 16 }}>
                <ActivityIndicator color="rgba(255,255,255,0.75)" />
              </View>
            ) : null
          }
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) {
              fetchNextPage();
            }
          }}
          onEndReachedThreshold={0.4}
          estimatedItemSize={300}
        />
          <Animated.View
            pointerEvents={topBar.isHidden ? "none" : "box-none"}
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: floatingMapBottom,
              alignItems: "center",
              opacity: topBar.translateY.interpolate({
                inputRange: [-topBar.height, 0],
                outputRange: [0, 1],
                extrapolate: "clamp",
              }),
              transform: [
                {
                  translateY: topBar.translateY.interpolate({
                    inputRange: [-topBar.height, 0],
                    outputRange: [24, 0],
                    extrapolate: "clamp",
                  }),
                },
              ],
            }}
          >
            <Pressable
              onPress={() => router.push("/map")}
              accessibilityRole="button"
              accessibilityLabel={t("agora:openMap")}
              style={({ pressed }) => [styles.mapPill, pressed && styles.mapPressed]}
            >
              <View style={styles.mapCircle}>
                <View pointerEvents="none" style={styles.mapFillWrap}>
                  <BlurView tint="dark" intensity={50} style={StyleSheet.absoluteFill} />
                  <LinearGradient
                    colors={["rgba(255,255,255,0.02)", "rgba(0,0,0,0.08)"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
                </View>
                <View pointerEvents="none" style={styles.mapBorder} />
                <View style={styles.mapIconBox}>
                  <Ionicons
                    name="map-outline"
                    size={MAP_ICON_SIZE}
                    color="rgba(220,230,245,0.68)"
                    style={styles.mapIcon}
                  />
                </View>
              </View>
            </Pressable>
          </Animated.View>
      </LiquidBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  mapPill: {
    height: MAP_BUTTON_SIZE,
    width: MAP_BUTTON_SIZE,
    minWidth: MAP_BUTTON_SIZE,
    maxWidth: MAP_BUTTON_SIZE,
    aspectRatio: 1,
    borderRadius: MAP_BUTTON_SIZE / 2,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  mapCircle: {
    width: MAP_BUTTON_SIZE,
    height: MAP_BUTTON_SIZE,
    borderRadius: MAP_BUTTON_SIZE / 2,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  mapFillWrap: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: MAP_BUTTON_SIZE / 2,
    overflow: "hidden",
  },
  mapBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: MAP_BUTTON_SIZE / 2,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  mapIconBox: {
    width: MAP_ICON_BOX,
    height: MAP_ICON_BOX,
    alignItems: "center",
    justifyContent: "center",
  },
  mapIcon: {
    transform: [{ translateY: MAP_ICON_NUDGE_Y }],
  },
  mapPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
});
