import { useCallback } from "react";
import { FlatList, Platform, Pressable, Text, View } from "react-native";
import { tokens } from "@orya/shared";
import { GlassCard } from "../../components/liquid/GlassCard";
import { LiquidBackground } from "../../components/liquid/LiquidBackground";
import { SectionHeader } from "../../components/liquid/SectionHeader";
import { useAgoraFeed } from "../../features/agora/hooks";
import { useIpLocation } from "../../features/onboarding/hooks";
import { EventCardSquare, EventCardSquareSkeleton } from "../../components/events/EventCardSquare";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTabBarPadding } from "../../components/navigation/useTabBarPadding";

export default function AgoraScreen() {
  const { isLoading, isError, hasLive, liveItems, soonItems, personalizedItems, refetch } =
    useAgoraFeed();
  const { data: ipLocation } = useIpLocation();
  const userLat = ipLocation?.approxLatLon?.lat ?? null;
  const userLon = ipLocation?.approxLatLon?.lon ?? null;
  const insets = useSafeAreaInsets();
  const tabBarPadding = useTabBarPadding();

  const showSkeleton = isLoading && liveItems.length + soonItems.length + personalizedItems.length === 0;
  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const keyExtractor = useCallback((_: number, index: number) => `agora-${index}`, []);

  return (
    <LiquidBackground variant="solid">
      <FlatList
        data={showSkeleton ? [1, 2, 3] : []}
        keyExtractor={keyExtractor}
        onRefresh={handleRefresh}
        refreshing={isLoading}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: tabBarPadding }}
        removeClippedSubviews={Platform.OS === "android"}
        initialNumToRender={4}
        maxToRenderPerBatch={4}
        updateCellsBatchingPeriod={40}
        windowSize={5}
        ListHeaderComponent={
          <View style={{ paddingTop: insets.top + 12 }}>
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
                <SectionHeader title="A acontecer" subtitle="Eventos a decorrer agora." />
                {liveItems.map((item, index) => (
                  <EventCardSquare
                    key={`live-${item.id}-${item.slug}`}
                    event={item}
                    statusTag="A acontecer"
                    index={index}
                    userLat={userLat}
                    userLon={userLon}
                  />
                ))}
              </View>
            ) : null}

            {!showSkeleton && soonItems.length > 0 ? (
              <View className="pb-2">
                <SectionHeader title="A seguir" subtitle="Próximas 72h." />
                {soonItems.slice(0, 6).map((item, index) => (
                  <EventCardSquare
                    key={`soon-${item.id}-${item.slug}`}
                    event={item}
                    statusTag="A seguir"
                    index={index}
                    userLat={userLat}
                    userLon={userLon}
                  />
                ))}
              </View>
            ) : null}

            {!showSkeleton ? (
              <View>
                <SectionHeader title="Na tua cidade" subtitle="Curadoria perto de ti." />
                {personalizedItems.slice(0, 6).map((item, index) => (
                  <EventCardSquare
                    key={`city-${item.id}-${item.slug}`}
                    event={item}
                    index={index}
                    userLat={userLat}
                    userLon={userLon}
                  />
                ))}
              </View>
            ) : null}
          </View>
        }
        renderItem={() =>
          showSkeleton ? <EventCardSquareSkeleton /> : null
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
