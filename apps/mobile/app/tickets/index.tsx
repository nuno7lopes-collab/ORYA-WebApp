import { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, Platform, Pressable, Text, View } from "react-native";
import { tokens } from "@orya/shared";
import { GlassSurface } from "../../components/glass/GlassSurface";
import { GlassSkeleton } from "../../components/glass/GlassSkeleton";
import { LiquidBackground } from "../../components/liquid/LiquidBackground";
import { useWalletFeed } from "../../features/wallet/hooks";
import { WalletEntitlementCard } from "../../features/wallet/WalletEntitlementCard";
import { WalletEntitlement } from "../../features/wallet/types";
import { TopAppHeader } from "../../components/navigation/TopAppHeader";
import { useTopHeaderPadding } from "../../components/navigation/useTopHeaderPadding";
import { useTopBarScroll } from "../../components/navigation/useTopBarScroll";
import { useRouter } from "expo-router";
import { useIsFocused, useNavigation } from "@react-navigation/native";
import { Ionicons } from "../../components/icons/Ionicons";
import { safeBack } from "../../lib/navigation";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type TicketsScreenProps = {
  showBackButton?: boolean;
};

type WalletListItem =
  | { kind: "skeleton"; key: string }
  | { kind: "entitlement"; entitlement: WalletEntitlement }
  | { kind: "section"; key: string; label: string };

export default function TicketsScreen({ showBackButton = true }: TicketsScreenProps) {
  const router = useRouter();
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const [dataReady, setDataReady] = useState(false);
  const [mode, setMode] = useState<"upcoming" | "history">("upcoming");
  const feed = useWalletFeed(mode, dataReady);
  const topPadding = useTopHeaderPadding(12);
  const topBar = useTopBarScroll();
  const items = useMemo(
    () => feed.data?.pages.flatMap((page) => page.items) ?? [],
    [feed.data?.pages],
  );
  const showSkeleton = feed.isLoading && items.length === 0;
  const listData: WalletListItem[] = useMemo(() => {
    if (showSkeleton) {
      return Array.from({ length: 3 }, (_, index) => ({
        kind: "skeleton" as const,
        key: `wallet-skeleton-${index}`,
      }));
    }
    if (items.length === 0) return [];
    return items.map((entitlement) => ({ kind: "entitlement", entitlement }));
  }, [items, showSkeleton]);
  const emptyLabel =
    mode === "upcoming" ? "Sem bilhetes ativos neste momento." : "Sem bilhetes no histórico.";

  const handleRefresh = useCallback(() => {
    feed.refetch();
  }, [feed]);

  const renderItem = useCallback(
    ({ item }: { item: WalletListItem }) => {
      if (item.kind === "skeleton") {
        return <GlassSkeleton className="mb-4" height={198} />;
      }
      const entitlementId = item.entitlement.entitlementId;
      const openEntitlement = () => {
        router.push({ pathname: "/wallet/[entitlementId]", params: { entitlementId } });
      };
      return (
        <Pressable
          onPress={openEntitlement}
          accessibilityRole="button"
          accessibilityLabel="Ver bilhete"
        >
          <WalletEntitlementCard item={item.entitlement} />
        </Pressable>
      );
    },
    [router],
  );

  useEffect(() => {
    if (isFocused) setDataReady(true);
  }, [isFocused]);

  const keyExtractor = useCallback((item: WalletListItem) => {
    if (item.kind === "skeleton") return item.key;
    return item.entitlement.entitlementId;
  }, []);

  const backButton = (
    <Pressable
      onPress={() => safeBack(router, navigation, "/(tabs)/index")}
      accessibilityRole="button"
      accessibilityLabel="Voltar"
      style={({ pressed }) => [
        {
          width: tokens.layout.touchTarget,
          height: tokens.layout.touchTarget,
          alignItems: "center",
          justifyContent: "center",
          minHeight: tokens.layout.touchTarget,
        },
        pressed ? { opacity: 0.8 } : null,
      ]}
    >
      <Ionicons name="chevron-back" size={20} color="rgba(255,255,255,0.9)" />
    </Pressable>
  );

  return (
    <LiquidBackground>
      <TopAppHeader
        scrollState={topBar}
        variant="title"
        title="Bilhetes"
        titleAlign="center"
        leftSlot={showBackButton ? backButton : undefined}
        showNotifications={false}
        showMessages={false}
      />
      <FlatList
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: insets.bottom + 24,
          paddingTop: topPadding,
        }}
        data={listData}
        keyExtractor={keyExtractor}
        onRefresh={handleRefresh}
        refreshing={feed.isFetching}
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
          <View style={{ paddingBottom: 8 }}>
            <View className="mb-3 flex-row rounded-full border border-white/15 bg-white/5 p-1">
              {(["upcoming", "history"] as const).map((option) => (
                <Pressable
                  key={option}
                  onPress={() => setMode(option)}
                  className={`flex-1 rounded-full px-3 py-2 ${
                    mode === option ? "bg-white/90" : "bg-transparent"
                  }`}
                  accessibilityRole="button"
                  accessibilityLabel={option === "upcoming" ? "Ativos" : "Histórico"}
                >
                  <Text
                    className={`text-center text-xs font-semibold ${
                      mode === option ? "text-[#0b101a]" : "text-white/70"
                    }`}
                  >
                    {option === "upcoming" ? "Ativos" : "Histórico"}
                  </Text>
                </Pressable>
              ))}
            </View>
            {feed.isError ? (
              <GlassSurface intensity={52} padding={16}>
                <Text className="mb-3 text-sm text-red-300">Não foi possível carregar a carteira.</Text>
                <Pressable
                  className="rounded-xl bg-white/10 px-4 py-3"
                  onPress={() => feed.refetch()}
                  style={{ minHeight: tokens.layout.touchTarget }}
                  accessibilityRole="button"
                  accessibilityLabel="Tentar novamente"
                >
                  <Text className="text-center text-sm font-semibold text-white">Tentar novamente</Text>
                </Pressable>
              </GlassSurface>
            ) : null}
          </View>
        }
        renderItem={renderItem}
        ListFooterComponent={
          <View className="pt-1">
            {!showSkeleton && !feed.isError && items.length === 0 ? (
              <GlassSurface intensity={45} padding={16}>
                <Text className="text-sm text-white/65">{emptyLabel}</Text>
                <Pressable
                  className="mt-3 rounded-xl border border-white/15 bg-white/5 px-4 py-3"
                  onPress={() => {
                    router.push("/(tabs)/index");
                  }}
                  style={{ minHeight: tokens.layout.touchTarget }}
                  accessibilityRole="button"
                  accessibilityLabel="Explorar eventos"
                >
                  <Text className="text-center text-sm font-semibold text-white">Explorar eventos</Text>
                </Pressable>
              </GlassSurface>
            ) : null}
            {feed.hasNextPage ? (
              <Pressable
                className="mt-3 rounded-xl border border-white/15 bg-white/5 px-4 py-3"
                onPress={() => feed.fetchNextPage()}
                disabled={feed.isFetchingNextPage}
                style={{ minHeight: tokens.layout.touchTarget }}
                accessibilityRole="button"
                accessibilityLabel="Carregar mais"
                accessibilityState={{ disabled: feed.isFetchingNextPage }}
              >
                <Text className="text-center text-sm font-semibold text-white">
                  {feed.isFetchingNextPage ? "A carregar…" : "Carregar mais"}
                </Text>
              </Pressable>
            ) : null}
          </View>
        }
      />
    </LiquidBackground>
  );
}
