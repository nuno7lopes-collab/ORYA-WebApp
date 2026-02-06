import { useCallback, useMemo, useState } from "react";
import { FlatList, Platform, Pressable, Text, View, InteractionManager } from "react-native";
import { i18n, tokens } from "@orya/shared";
import { GlassSurface } from "../../components/glass/GlassSurface";
import { GlassSkeleton } from "../../components/glass/GlassSkeleton";
import { LiquidBackground } from "../../components/liquid/LiquidBackground";
import { SectionHeader } from "../../components/liquid/SectionHeader";
import { BlurView } from "expo-blur";
import { useWalletFeed } from "../../features/wallet/hooks";
import { WalletEntitlementCard } from "../../features/wallet/WalletEntitlementCard";
import { WalletEntitlement } from "../../features/wallet/types";
import { useTabBarPadding } from "../../components/navigation/useTabBarPadding";
import { TopAppHeader } from "../../components/navigation/TopAppHeader";
import { useTopHeaderPadding } from "../../components/navigation/useTopHeaderPadding";
import { useFocusEffect } from "@react-navigation/native";

type WalletListItem =
  | { kind: "skeleton"; key: string }
  | { kind: "entitlement"; entitlement: WalletEntitlement };

export default function TicketsScreen() {
  const t = i18n.pt.tickets;
  const [mode, setMode] = useState<"upcoming" | "history">("upcoming");
  const [dataReady, setDataReady] = useState(false);
  const feed = useWalletFeed(mode, dataReady);
  const tabBarPadding = useTabBarPadding();
  const topPadding = useTopHeaderPadding(12);
  const items = useMemo(
    () => feed.data?.pages.flatMap((page) => page.items) ?? [],
    [feed.data?.pages],
  );
  const showSkeleton = feed.isLoading && items.length === 0;
  const listData: WalletListItem[] = useMemo(
    () =>
      showSkeleton
        ? Array.from({ length: 3 }, (_, index) => ({
            kind: "skeleton",
            key: `wallet-skeleton-${index}`,
          }))
        : items.map((entitlement) => ({ kind: "entitlement", entitlement })),
    [items, showSkeleton],
  );
  const emptyLabel =
    mode === "upcoming"
      ? "Sem bilhetes ativos de momento."
      : "Ainda sem histórico no mobile.";

  const handleRefresh = useCallback(() => {
    feed.refetch();
  }, [feed]);

  const renderItem = useCallback(
    ({ item }: { item: WalletListItem }) =>
      item.kind === "skeleton" ? (
        <GlassSkeleton className="mb-4" height={198} />
      ) : (
        <WalletEntitlementCard item={item.entitlement} />
      ),
    [],
  );

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

  const keyExtractor = useCallback(
    (item: WalletListItem) => (item.kind === "skeleton" ? item.key : item.entitlement.entitlementId),
    [],
  );

  return (
    <LiquidBackground>
      <TopAppHeader />
      <FlatList
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: tabBarPadding, paddingTop: topPadding }}
        data={listData}
        keyExtractor={keyExtractor}
        onRefresh={handleRefresh}
        refreshing={feed.isFetching}
        removeClippedSubviews={Platform.OS === "android"}
        initialNumToRender={4}
        maxToRenderPerBatch={4}
        updateCellsBatchingPeriod={40}
        windowSize={5}
        ListHeaderComponent={
          <View style={{ paddingBottom: 8 }}>
            <View className="flex-row gap-2 pb-4">
              {[
                { key: "upcoming", label: "Ativos" },
                { key: "history", label: "Histórico" },
              ].map((option) => {
                const active = option.key === mode;
                return (
                  <Pressable
                    key={option.key}
                    onPress={() => setMode(option.key as "upcoming" | "history")}
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
                        {option.label}
                      </Text>
                    </BlurView>
                  </Pressable>
                );
              })}
            </View>

            <SectionHeader
              title={mode === "upcoming" ? "Ativos" : "Histórico"}
              subtitle={mode === "upcoming" ? "Prontos para usar e mostrar QR." : "Bilhetes já usados ou expirados."}
            />

            {feed.isError ? (
              <GlassSurface intensity={52} padding={16}>
                <Text className="text-red-300 text-sm mb-3">Não foi possível carregar a carteira.</Text>
                <Pressable
                  className="rounded-xl bg-white/10 px-4 py-3"
                  onPress={() => feed.refetch()}
                  style={{ minHeight: tokens.layout.touchTarget }}
                >
                  <Text className="text-white text-sm font-semibold text-center">Tentar novamente</Text>
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
                <Text className="text-white/65 text-sm">{emptyLabel}</Text>
              </GlassSurface>
            ) : null}
            {feed.hasNextPage ? (
              <Pressable
                className="mt-3 rounded-xl border border-white/15 bg-white/5 px-4 py-3"
                onPress={() => feed.fetchNextPage()}
                disabled={feed.isFetchingNextPage}
                style={{ minHeight: tokens.layout.touchTarget }}
              >
                <Text className="text-white text-sm font-semibold text-center">
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
