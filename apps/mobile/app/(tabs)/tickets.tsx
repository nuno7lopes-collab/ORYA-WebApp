import { useMemo, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { i18n, tokens } from "@orya/shared";
import { GlassSurface } from "../../components/glass/GlassSurface";
import { GlassSkeleton } from "../../components/glass/GlassSkeleton";
import { LiquidBackground } from "../../components/liquid/LiquidBackground";
import { SectionHeader } from "../../components/liquid/SectionHeader";
import { BlurView } from "expo-blur";
import { useWalletFeed } from "../../features/wallet/hooks";
import { WalletEntitlementCard } from "../../features/wallet/WalletEntitlementCard";
import { WalletEntitlement } from "../../features/wallet/types";

type WalletListItem =
  | { kind: "skeleton"; key: string }
  | { kind: "entitlement"; entitlement: WalletEntitlement };

export default function TicketsScreen() {
  const t = i18n.pt.tickets;
  const [mode, setMode] = useState<"upcoming" | "history">("upcoming");
  const feed = useWalletFeed(mode);
  const items = useMemo(
    () => feed.data?.pages.flatMap((page) => page.items) ?? [],
    [feed.data?.pages],
  );
  const showSkeleton = feed.isLoading && items.length === 0;
  const listData: WalletListItem[] = showSkeleton
    ? Array.from({ length: 3 }, (_, index) => ({
        kind: "skeleton",
        key: `wallet-skeleton-${index}`,
      }))
    : items.map((entitlement) => ({ kind: "entitlement", entitlement }));
  const emptyLabel =
    mode === "upcoming"
      ? "Sem bilhetes ativos de momento."
      : "Ainda sem histórico no mobile.";

  return (
    <LiquidBackground>
      <FlatList
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 34 }}
        data={listData}
        keyExtractor={(item) => (item.kind === "skeleton" ? item.key : item.entitlement.entitlementId)}
        onRefresh={() => feed.refetch()}
        refreshing={feed.isFetching}
        ListHeaderComponent={
          <View className="pt-14 pb-2">
            <Text className="text-white text-[30px] font-semibold mb-2">{t.title}</Text>
            <Text className="text-white/60 text-sm mb-5">A tua carteira: bilhetes, inscrições e reservas.</Text>

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
        renderItem={({ item }) =>
          item.kind === "skeleton" ? (
            <GlassSkeleton className="mb-4" height={198} />
          ) : (
            <WalletEntitlementCard item={item.entitlement} />
          )
        }
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
