import { FlatList, Pressable, Text, View } from "react-native";
import { tokens } from "@orya/shared";
import { LiquidBackground } from "../../components/liquid/LiquidBackground";
import { SectionHeader } from "../../components/liquid/SectionHeader";
import { GlassCard } from "../../components/liquid/GlassCard";
import { GlassSkeleton } from "../../components/glass/GlassSkeleton";
import { useNetworkActions, useNetworkSuggestions } from "../../features/network/hooks";
import { NetworkSuggestionCard } from "../../features/network/NetworkSuggestionCard";
import { SocialSuggestion } from "../../features/network/types";

type NetworkListItem =
  | { kind: "skeleton"; key: string }
  | { kind: "suggestion"; suggestion: SocialSuggestion };

export default function NetworkScreen() {
  const suggestions = useNetworkSuggestions();
  const actions = useNetworkActions();

  const data = suggestions.data ?? [];
  const showSkeleton = suggestions.isLoading && data.length === 0;
  const listData: NetworkListItem[] = showSkeleton
    ? Array.from({ length: 4 }, (_, index) => ({
        kind: "skeleton",
        key: `network-skeleton-${index}`,
      }))
    : data.map((suggestion) => ({ kind: "suggestion", suggestion }));

  return (
    <LiquidBackground>
      <FlatList
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 34 }}
        data={listData}
        keyExtractor={(item) => (item.kind === "skeleton" ? item.key : item.suggestion.id)}
        refreshing={suggestions.isFetching}
        onRefresh={() => suggestions.refetch()}
        ListHeaderComponent={
          <View className="pt-14 pb-2">
            <Text className="text-white text-[30px] font-semibold">Rede</Text>
            <Text className="mt-1 text-white/60 text-sm">
              Segue pessoas e clubes para personalizar o teu feed.
            </Text>

            <View className="pt-4">
              <SectionHeader
                title="Sugestões para ti"
                subtitle="Perfis com afinidade no teu contexto atual."
              />
            </View>

            {suggestions.isError ? (
              <GlassCard intensity={52} className="mb-3">
                <Text className="text-red-300 text-sm mb-3">Não foi possível carregar sugestões.</Text>
                <Pressable
                  className="rounded-xl bg-white/10 px-4 py-3"
                  onPress={() => suggestions.refetch()}
                  style={{ minHeight: tokens.layout.touchTarget }}
                >
                  <Text className="text-white text-sm font-semibold text-center">Tentar novamente</Text>
                </Pressable>
              </GlassCard>
            ) : null}
          </View>
        }
        renderItem={({ item }) =>
          item.kind === "skeleton" ? (
            <GlassSkeleton className="mb-3" height={86} />
          ) : (
            <NetworkSuggestionCard
              item={item.suggestion}
              pending={actions.pendingUserId === item.suggestion.id}
              onFollow={() => actions.follow(item.suggestion.id)}
              onUnfollow={() => actions.unfollow(item.suggestion.id)}
            />
          )
        }
        ListFooterComponent={
          !showSkeleton && !suggestions.isError && data.length === 0 ? (
            <GlassCard intensity={48}>
              <Text className="text-white/70 text-sm">
                Ainda sem sugestões. Volta mais tarde para ver novas pessoas e clubes.
              </Text>
            </GlassCard>
          ) : null
        }
      />
    </LiquidBackground>
  );
}
