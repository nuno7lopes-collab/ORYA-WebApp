import { useCallback, useState } from "react";
import { FlatList, Platform, Pressable, Text, View, InteractionManager } from "react-native";
import { tokens } from "@orya/shared";
import { GlassCard } from "../../components/liquid/GlassCard";
import { LiquidBackground } from "../../components/liquid/LiquidBackground";
import { SectionHeader } from "../../components/liquid/SectionHeader";
import { useAgoraFeed } from "../../features/agora/hooks";
import { useIpLocation } from "../../features/onboarding/hooks";
import { EventCardSquare, EventCardSquareSkeleton } from "../../components/events/EventCardSquare";
import { useTabBarPadding } from "../../components/navigation/useTabBarPadding";
import { TopAppHeader } from "../../components/navigation/TopAppHeader";
import { useTopHeaderPadding } from "../../components/navigation/useTopHeaderPadding";
import { useFocusEffect } from "@react-navigation/native";

export default function AgoraScreen() {
  const [dataReady, setDataReady] = useState(false);
  const { isLoading, isError, hasLive, liveItems, soonItems, personalizedItems, refetch } =
    useAgoraFeed(dataReady);
  const { data: ipLocation } = useIpLocation(dataReady);
  const userLat = ipLocation?.approxLatLon?.lat ?? null;
  const userLon = ipLocation?.approxLatLon?.lon ?? null;
  const tabBarPadding = useTabBarPadding();
  const topPadding = useTopHeaderPadding(16);

  const showSkeleton = isLoading && liveItems.length + soonItems.length + personalizedItems.length === 0;
  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const keyExtractor = useCallback((_: number, index: number) => `agora-${index}`, []);

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

  return (
    <LiquidBackground variant="solid">
      <TopAppHeader />
      <FlatList
        data={showSkeleton ? [1, 2, 3] : []}
        keyExtractor={keyExtractor}
        onRefresh={handleRefresh}
        refreshing={isLoading}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: tabBarPadding, paddingTop: topPadding }}
        removeClippedSubviews={Platform.OS === "android"}
        initialNumToRender={4}
        maxToRenderPerBatch={4}
        updateCellsBatchingPeriod={40}
        windowSize={5}
        ListHeaderComponent={
          <View>
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
                <SectionHeader title="A seguir" subtitle="Próximas 24-72h." />
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
