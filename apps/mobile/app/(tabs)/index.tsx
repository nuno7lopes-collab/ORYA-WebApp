import { useMemo } from "react";
import {
  FlatList,
  Platform,
  Pressable,
  Text,
  TextInput,
  UIManager,
  View,
} from "react-native";
import { i18n, tokens } from "@orya/shared";
import { useDebouncedValue, useDiscoverFeed } from "../../features/discover/hooks";
import { useDiscoverStore } from "../../features/discover/store";
import { DiscoverEventCard } from "../../features/discover/DiscoverEventCard";
import { GlassSurface } from "../../components/glass/GlassSurface";
import { GlassSkeleton } from "../../components/glass/GlassSkeleton";
import { BlurView } from "expo-blur";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function DiscoverScreen() {
  const t = i18n.pt.discover;
  const query = useDiscoverStore((state) => state.query);
  const priceFilter = useDiscoverStore((state) => state.priceFilter);
  const setQuery = useDiscoverStore((state) => state.setQuery);
  const setPriceFilter = useDiscoverStore((state) => state.setPriceFilter);
  const debouncedQuery = useDebouncedValue(query, 280);

  const { data, isFetching, isLoading, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useDiscoverFeed({ q: debouncedQuery, type: priceFilter });

  const items = useMemo(
    () => data?.pages.flatMap((page) => page.items) ?? [],
    [data?.pages],
  );

  const showSkeleton = isLoading && items.length === 0;
  const showEmpty = !isLoading && !isError && items.length === 0;

  return (
    <View className="flex-1 bg-[#0b101a]">
      <View className="px-5 pt-14 pb-4">
        <Text className="text-white text-[30px] font-semibold">{t.title}</Text>
        <Text className="mt-1 text-white/60 text-sm">{t.subtitle}</Text>
      </View>

      <View className="px-5 pb-3">
        <GlassSurface intensity={55}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t.searchPlaceholder}
            placeholderTextColor={tokens.colors.textMuted}
            className="text-white text-base"
            style={{
              minHeight: tokens.layout.touchTarget,
            }}
          />
        </GlassSurface>
      </View>

      <View className="px-5 pb-3 flex-row gap-2">
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
              className="overflow-hidden rounded-xl border border-white/10"
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

      <FlatList
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}
        data={showSkeleton ? [1, 2, 3, 4, 5] : items}
        keyExtractor={(item, index) => (showSkeleton ? `skeleton-${index}` : `${item.id}-${item.slug}`)}
        renderItem={({ item }) =>
          showSkeleton ? (
            <GlassSkeleton className="mb-3" height={128} />
          ) : (
            <DiscoverEventCard item={item} />
          )
        }
        ListFooterComponent={
          !showSkeleton ? (
            <View className="pt-2">
              {isError ? (
                <GlassSurface intensity={50}>
                  <Text className="text-red-300 text-sm mb-3">Não foi possível carregar o feed.</Text>
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
              {!isError && hasNextPage ? (
                <Pressable
                  onPress={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                  className="mt-3 rounded-xl border border-white/15 bg-white/5 px-4 py-3"
                  style={{ minHeight: tokens.layout.touchTarget }}
                >
                  <Text className="text-white text-sm font-semibold text-center">
                    {isFetchingNextPage ? `${t.loading}` : t.loadMore}
                  </Text>
                </Pressable>
              ) : null}
              {!isLoading && isFetching && !isFetchingNextPage ? (
                <Text className="mt-3 text-white/50 text-center text-xs">{t.loading}</Text>
              ) : null}
            </View>
          ) : null
        }
      />
    </View>
  );
}
