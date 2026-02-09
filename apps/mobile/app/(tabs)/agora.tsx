import { useCallback, useEffect, useMemo, useState } from "react";
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
import { useRouter } from "expo-router";
import { Ionicons } from "../../components/icons/Ionicons";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";

export default function AgoraScreen() {
  const router = useRouter();
  const [dataReady, setDataReady] = useState(false);
  const { isLoading, isError, hasLive, liveItems, soonItems, personalizedItems, timelineError, personalizedError, refetch } =
    useAgoraFeed(dataReady);
  const { data: ipLocation } = useIpLocation(dataReady);
  const userLat = ipLocation?.approxLatLon?.lat ?? null;
  const userLon = ipLocation?.approxLatLon?.lon ?? null;
  const tabBarPadding = useTabBarPadding();
  const topPadding = useTopHeaderPadding(16);

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-24, 24])
        .failOffsetY([-12, 12])
        .onEnd((event) => {
          const shouldGo = event.translationX < -70 && Math.abs(event.velocityX) > 300;
          if (shouldGo) {
            runOnJS(router.push)("/(tabs)/index");
          }
        }),
    [router],
  );

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

  useEffect(() => {
    if (!isError) return;
    const formatError = (err: unknown) =>
      err instanceof Error
        ? { name: err.name, message: err.message, stack: err.stack }
        : { message: String(err ?? "") };
    console.warn("[agora] feed_error", {
      timeline: timelineError ? formatError(timelineError) : null,
      personalized: personalizedError ? formatError(personalizedError) : null,
    });
  }, [isError, timelineError, personalizedError]);

  return (
    <GestureDetector gesture={panGesture}>
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
                  accessibilityRole="button"
                  accessibilityLabel="Tentar novamente"
                >
                  <Text className="text-white text-sm font-semibold text-center">Tentar novamente</Text>
                </Pressable>
              </GlassCard>
            ) : null}

            <View className="flex-row items-center gap-3 mb-4">
              <Pressable
                onPress={() => router.push("/search")}
                accessibilityRole="button"
                accessibilityLabel="Pesquisar"
                style={({ pressed }) => [
                  {
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: "rgba(255,255,255,0.12)",
                    backgroundColor: "rgba(255,255,255,0.06)",
                    minHeight: tokens.layout.touchTarget,
                  },
                  pressed ? { opacity: 0.9 } : null,
                ]}
              >
                <Ionicons name="search" size={16} color="rgba(240,246,255,0.9)" />
                <Text style={{ color: "rgba(255,255,255,0.85)", fontWeight: "600", fontSize: 12 }}>
                  Pesquisar
                </Text>
              </Pressable>
              <Pressable
                onPress={() => router.push("/map")}
                accessibilityRole="button"
                accessibilityLabel="Abrir mapa"
                style={({ pressed }) => [
                  {
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: "rgba(255,255,255,0.12)",
                    backgroundColor: "rgba(255,255,255,0.06)",
                    minHeight: tokens.layout.touchTarget,
                  },
                  pressed ? { opacity: 0.9 } : null,
                ]}
              >
                <Ionicons name="map-outline" size={16} color="rgba(240,246,255,0.9)" />
                <Text style={{ color: "rgba(255,255,255,0.85)", fontWeight: "600", fontSize: 12 }}>
                  Mapa
                </Text>
              </Pressable>
            </View>

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
                    source="agora"
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
                    source="agora"
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
                    source="agora"
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
                Sem atividade agora. Puxa para atualizar ou explora o Descobrir.
              </Text>
              <Pressable
                onPress={() => router.push("/(tabs)/index")}
                className="mt-3 rounded-xl border border-white/15 bg-white/5 px-4 py-3"
                style={{ minHeight: tokens.layout.touchTarget }}
                accessibilityRole="button"
                accessibilityLabel="Ir para Descobrir"
              >
                <Text className="text-white text-sm font-semibold text-center">Ir para Descobrir</Text>
              </Pressable>
            </GlassCard>
          ) : null
        }
        />
      </LiquidBackground>
    </GestureDetector>
  );
}
