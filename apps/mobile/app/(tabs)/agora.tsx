import { FlatList, Platform, Pressable, Text, View } from "react-native";
import { tokens } from "@orya/shared";
import { GlassCard } from "../../components/liquid/GlassCard";
import { LiquidBackground } from "../../components/liquid/LiquidBackground";
import { SectionHeader } from "../../components/liquid/SectionHeader";
import { DiscoverEventCard } from "../../features/discover/DiscoverEventCard";
import { useAgoraFeed } from "../../features/agora/hooks";
import { GlassSkeleton } from "../../components/glass/GlassSkeleton";

export default function AgoraScreen() {
  const { isLoading, isError, hasLive, liveItems, soonItems, upcomingItems, personalizedItems, refetch } =
    useAgoraFeed();

  const showSkeleton = isLoading && liveItems.length + soonItems.length + personalizedItems.length === 0;

  return (
    <LiquidBackground variant="solid">
      <FlatList
        data={showSkeleton ? [1, 2, 3] : []}
        keyExtractor={(_, index) => `agora-${index}`}
        onRefresh={() => refetch()}
        refreshing={isLoading}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 34 }}
        removeClippedSubviews={Platform.OS === "android"}
        initialNumToRender={4}
        maxToRenderPerBatch={4}
        updateCellsBatchingPeriod={40}
        windowSize={5}
        ListHeaderComponent={
          <View className="pt-14">
            <View className="pb-3">
              <Text className="text-white text-[30px] font-semibold">Agora</Text>
              <Text className="mt-1 text-white/60 text-sm">
                O que está a acontecer neste momento e o que vem já a seguir.
              </Text>
            </View>

            {isError ? (
              <GlassCard className="mb-5" intensity={52}>
                <Text className="text-red-300 text-sm mb-3">Não foi possível carregar o Agora.</Text>
                <Pressable
                  className="rounded-xl bg-white/10 px-4 py-3"
                  onPress={() => refetch()}
                  style={{ minHeight: tokens.layout.touchTarget }}
                >
                  <Text className="text-white text-sm font-semibold text-center">Tentar novamente</Text>
                </Pressable>
              </GlassCard>
            ) : null}

            {!showSkeleton && hasLive ? (
              <View className="pb-2">
                <SectionHeader title="Live hubs" subtitle="Eventos a acontecer ou a começar já." />
                {liveItems.map((item) => (
                  <DiscoverEventCard key={`live-${item.id}-${item.slug}`} item={item} />
                ))}
                {soonItems.map((item) => (
                  <DiscoverEventCard key={`soon-${item.id}-${item.slug}`} item={item} />
                ))}
              </View>
            ) : null}

            {!showSkeleton && upcomingItems.length > 0 ? (
              <View className="pb-2">
                <SectionHeader title="A seguir" subtitle="Próximos eventos na tua cidade." />
                {upcomingItems.slice(0, 3).map((item) => (
                  <DiscoverEventCard key={`upcoming-${item.id}-${item.slug}`} item={item} />
                ))}
              </View>
            ) : null}

            {!showSkeleton ? (
              <View>
                <SectionHeader title="Para ti" subtitle="Seleção personalizada para continuar a explorar." />
                {personalizedItems.slice(0, 6).map((item) => (
                  <DiscoverEventCard key={`personalized-${item.id}-${item.slug}`} item={item} />
                ))}
              </View>
            ) : null}
          </View>
        }
        renderItem={() =>
          showSkeleton ? <GlassSkeleton className="mb-4" height={140} /> : null
        }
        ListFooterComponent={
          !showSkeleton && !isError && !hasLive && personalizedItems.length === 0 ? (
            <GlassCard intensity={50}>
              <Text className="text-white/70 text-sm">
                Sem atividade agora. Puxa para atualizar ou explora o feed Discover.
              </Text>
            </GlassCard>
          ) : null
        }
      />
    </LiquidBackground>
  );
}
