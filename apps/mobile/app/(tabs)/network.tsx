import { useCallback, useMemo, useState } from "react";
import { Platform, Pressable, SectionList, Text, View, InteractionManager } from "react-native";
import { tokens } from "@orya/shared";
import { LiquidBackground } from "../../components/liquid/LiquidBackground";
import { SectionHeader } from "../../components/liquid/SectionHeader";
import { GlassCard } from "../../components/liquid/GlassCard";
import { GlassSkeleton } from "../../components/glass/GlassSkeleton";
import {
  useFollowRequestActions,
  useFollowRequests,
  useNetworkActions,
  useNetworkSuggestions,
} from "../../features/network/hooks";
import { NetworkSuggestionCard } from "../../features/network/NetworkSuggestionCard";
import { FollowRequestCard } from "../../features/network/FollowRequestCard";
import { FollowRequest, SocialSuggestion } from "../../features/network/types";
import { useSocialFeed } from "../../features/social/hooks";
import { SocialFeedCard } from "../../features/social/SocialFeedCard";
import { useIpLocation } from "../../features/onboarding/hooks";
import { SocialFeedItem } from "../../features/social/types";
import { useTabBarPadding } from "../../components/navigation/useTabBarPadding";
import { TopAppHeader } from "../../components/navigation/TopAppHeader";
import { useTopHeaderPadding } from "../../components/navigation/useTopHeaderPadding";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { Swipeable } from "react-native-gesture-handler";
import { Ionicons } from "../../components/icons/Ionicons";

const SECTION_SPACING = 24;

type NetworkSectionKey = "requests" | "feed" | "suggestions";

type NetworkSectionItem =
  | { type: "skeleton"; key: string; variant: NetworkSectionKey }
  | { type: "request"; request: FollowRequest }
  | { type: "feed"; feed: SocialFeedItem }
  | { type: "suggestion"; suggestion: SocialSuggestion };

type NetworkSection = {
  key: NetworkSectionKey;
  title: string;
  subtitle: string;
  data: NetworkSectionItem[];
  isError: boolean;
  isEmpty: boolean;
};

const buildSkeletons = (variant: NetworkSectionKey, count: number): NetworkSectionItem[] =>
  Array.from({ length: count }, (_, index) => ({
    type: "skeleton",
    key: `${variant}-skeleton-${index}`,
    variant,
  }));

export default function NetworkScreen() {
  const router = useRouter();
  const [dataReady, setDataReady] = useState(false);
  const suggestions = useNetworkSuggestions(dataReady);
  const actions = useNetworkActions();
  const followRequests = useFollowRequests(dataReady);
  const followRequestActions = useFollowRequestActions();
  const socialFeed = useSocialFeed(8, dataReady);
  const { data: ipLocation } = useIpLocation(dataReady);
  const userLat = ipLocation?.approxLatLon?.lat ?? null;
  const userLon = ipLocation?.approxLatLon?.lon ?? null;
  const tabBarPadding = useTabBarPadding();
  const topPadding = useTopHeaderPadding(12);

  const feedItems = useMemo(
    () => socialFeed.data?.pages.flatMap((page) => page.items) ?? [],
    [socialFeed.data?.pages],
  );
  const feedSkeleton = socialFeed.isLoading && feedItems.length === 0;
  const feedEmpty = !socialFeed.isLoading && !socialFeed.isError && feedItems.length === 0;

  const requestItems = followRequests.data ?? [];
  const requestSkeleton = followRequests.isLoading && requestItems.length === 0;
  const requestEmpty = !followRequests.isLoading && !followRequests.isError && requestItems.length === 0;

  const data = suggestions.data ?? [];
  const showSkeleton = suggestions.isLoading && data.length === 0;
  const suggestionsEmpty = !suggestions.isLoading && !suggestions.isError && data.length === 0;

  const sections = useMemo<NetworkSection[]>(
    () => [
      {
        key: "requests",
        title: "Pedidos de follow",
        subtitle: "Convites pendentes.",
        data: requestSkeleton
          ? buildSkeletons("requests", 2)
          : requestItems.map((request) => ({ type: "request" as const, request })),
        isError: followRequests.isError,
        isEmpty: requestEmpty,
      },
      {
        key: "feed",
        title: "O teu feed",
        subtitle: "Atualizações das organizações que segues.",
        data: feedSkeleton
          ? buildSkeletons("feed", 2)
          : feedItems.map((feed) => ({ type: "feed" as const, feed })),
        isError: socialFeed.isError,
        isEmpty: feedEmpty,
      },
      {
        key: "suggestions",
        title: "Sugestões para ti",
        subtitle: "Perfis com afinidade no teu contexto atual.",
        data: showSkeleton
          ? buildSkeletons("suggestions", 4)
          : data.map((suggestion) => ({ type: "suggestion" as const, suggestion })),
        isError: suggestions.isError,
        isEmpty: suggestionsEmpty,
      },
    ],
    [
      data,
      feedEmpty,
      feedItems,
      feedSkeleton,
      followRequests.isError,
      requestEmpty,
      requestItems,
      requestSkeleton,
      showSkeleton,
      socialFeed.isError,
      suggestions.isError,
      suggestionsEmpty,
    ],
  );

  const handleRefresh = useCallback(() => {
    suggestions.refetch();
    socialFeed.refetch();
    followRequests.refetch();
  }, [followRequests, socialFeed, suggestions]);

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

  const renderItem = useCallback(
    ({ item, index }: { item: NetworkSectionItem; index: number }) => {
      if (item.type === "skeleton") {
        const height =
          item.variant === "feed" ? 240 : item.variant === "requests" ? 110 : 86;
        const spacingClass = item.variant === "feed" ? "mb-4" : "mb-3";
        return <GlassSkeleton className={spacingClass} height={height} />;
      }

      if (item.type === "suggestion") {
        const isActive = item.suggestion.isFollowing || item.suggestion.isRequested;
        return (
          <Swipeable
            renderRightActions={() => (
              <View style={{ flexDirection: "row", gap: 8, paddingRight: 8, alignItems: "center" }}>
                <Pressable
                  onPress={() => (isActive ? actions.unfollow(item.suggestion.id) : actions.follow(item.suggestion.id))}
                  accessibilityRole="button"
                  accessibilityLabel={isActive ? "Remover" : "Seguir"}
                  accessibilityState={{ disabled: actions.pendingUserId === item.suggestion.id }}
                  style={({ pressed }) => [
                    {
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                      borderRadius: 16,
                      backgroundColor: isActive ? "rgba(255,255,255,0.16)" : "#ffffff",
                      borderWidth: isActive ? 1 : 0,
                      borderColor: isActive ? "rgba(255,255,255,0.2)" : "transparent",
                      minWidth: 96,
                      justifyContent: "center",
                    },
                    pressed ? { opacity: 0.85, transform: [{ scale: 0.98 }] } : null,
                  ]}
                >
                  <Ionicons name={isActive ? "person-remove" : "person-add"} size={16} color={isActive ? "white" : "#0b101a"} />
                  <Text style={{ color: isActive ? "white" : "#0b101a", fontSize: 12, fontWeight: "700" }}>
                    {isActive ? "Remover" : "Seguir"}
                  </Text>
                </Pressable>
              </View>
            )}
            rightThreshold={36}
            friction={2}
            overshootRight={false}
          >
            <NetworkSuggestionCard
              item={item.suggestion}
              pending={actions.pendingUserId === item.suggestion.id}
              onFollow={actions.follow}
              onUnfollow={actions.unfollow}
            />
          </Swipeable>
        );
      }

      if (item.type === "request") {
        return (
          <Swipeable
            renderRightActions={() => (
              <View style={{ flexDirection: "row", gap: 8, paddingRight: 8, alignItems: "center" }}>
                <Pressable
                  onPress={() => followRequestActions.accept(item.request.id)}
                  accessibilityRole="button"
                  accessibilityLabel="Aceitar pedido"
                  accessibilityState={{ disabled: followRequestActions.pendingRequestId === item.request.id }}
                  style={({ pressed }) => [
                    {
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                      borderRadius: 16,
                      backgroundColor: "#ffffff",
                      minWidth: 96,
                      justifyContent: "center",
                    },
                    pressed ? { opacity: 0.85, transform: [{ scale: 0.98 }] } : null,
                  ]}
                >
                  <Ionicons name="checkmark" size={16} color="#0b101a" />
                  <Text style={{ color: "#0b101a", fontSize: 12, fontWeight: "700" }}>Aceitar</Text>
                </Pressable>
                <Pressable
                  onPress={() => followRequestActions.decline(item.request.id)}
                  accessibilityRole="button"
                  accessibilityLabel="Recusar pedido"
                  accessibilityState={{ disabled: followRequestActions.pendingRequestId === item.request.id }}
                  style={({ pressed }) => [
                    {
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                      borderRadius: 16,
                      backgroundColor: "rgba(255,255,255,0.16)",
                      borderWidth: 1,
                      borderColor: "rgba(255,255,255,0.2)",
                      minWidth: 96,
                      justifyContent: "center",
                    },
                    pressed ? { opacity: 0.85, transform: [{ scale: 0.98 }] } : null,
                  ]}
                >
                  <Ionicons name="close" size={16} color="white" />
                  <Text style={{ color: "white", fontSize: 12, fontWeight: "700" }}>Recusar</Text>
                </Pressable>
              </View>
            )}
            rightThreshold={36}
            friction={2}
            overshootRight={false}
          >
            <FollowRequestCard
              item={item.request}
              pending={followRequestActions.pendingRequestId === item.request.id}
              onAccept={followRequestActions.accept}
              onDecline={followRequestActions.decline}
            />
          </Swipeable>
        );
      }

      if (item.type === "feed") {
        return (
          <SocialFeedCard
            item={item.feed}
            index={index}
            userLat={userLat}
            userLon={userLon}
          />
        );
      }

      return null;
    },
    [actions.follow, actions.pendingUserId, actions.unfollow, followRequestActions.accept, followRequestActions.decline, followRequestActions.pendingRequestId, userLat, userLon],
  );

  const keyExtractor = useCallback((item: NetworkSectionItem) => {
    if (item.type === "skeleton") return item.key;
    if (item.type === "suggestion") return item.suggestion.id;
    if (item.type === "request") return `request-${item.request.id}`;
    return `feed-${item.feed.id}`;
  }, []);

  const renderSectionHeader = useCallback(
    ({ section }: { section: NetworkSection }) => (
      <View style={{ paddingTop: section.key === "requests" ? 12 : SECTION_SPACING }}>
        <SectionHeader title={section.title} subtitle={section.subtitle} />
      </View>
    ),
    [],
  );

  const renderSectionFooter = useCallback(
    ({ section }: { section: NetworkSection }) => {
      if (section.isError) {
        const onRetry =
          section.key === "requests"
            ? followRequests.refetch
            : section.key === "feed"
              ? socialFeed.refetch
              : suggestions.refetch;
        const message =
          section.key === "requests"
            ? "Não foi possível carregar os pedidos."
            : section.key === "feed"
              ? "Não foi possível carregar o feed."
              : "Não foi possível carregar sugestões.";
        return (
          <GlassCard intensity={52} className="mb-4">
            <Text className="text-red-300 text-sm mb-3">{message}</Text>
            <Pressable
              className="rounded-xl bg-white/10 px-4 py-3"
              onPress={() => onRetry()}
              style={{ minHeight: tokens.layout.touchTarget }}
              accessibilityRole="button"
              accessibilityLabel="Tentar novamente"
            >
              <Text className="text-white text-sm font-semibold text-center">Tentar novamente</Text>
            </Pressable>
          </GlassCard>
        );
      }

      if (section.isEmpty) {
        const message =
          section.key === "requests"
            ? "Sem pedidos pendentes."
            : section.key === "feed"
              ? "Ainda sem novidades. Segue clubes e amigos para veres atualizações."
              : "Ainda sem sugestões. Volta mais tarde para ver novas pessoas e clubes.";
        return (
          <GlassCard intensity={48} className="mb-4">
            <Text className="text-white/70 text-sm">{message}</Text>
            {section.key === "feed" || section.key === "suggestions" ? (
              <Pressable
                onPress={() => router.push("/search")}
                className="mt-3 rounded-xl border border-white/15 bg-white/5 px-4 py-3"
                style={{ minHeight: tokens.layout.touchTarget }}
                accessibilityRole="button"
                accessibilityLabel="Pesquisar pessoas"
              >
                <Text className="text-white text-sm font-semibold text-center">Pesquisar pessoas</Text>
              </Pressable>
            ) : null}
          </GlassCard>
        );
      }

      if (section.key === "feed" && socialFeed.hasNextPage) {
        return (
          <Pressable
            onPress={() => socialFeed.fetchNextPage()}
            disabled={socialFeed.isFetchingNextPage}
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 mb-6"
            style={{ minHeight: tokens.layout.touchTarget }}
            accessibilityRole="button"
            accessibilityLabel="Carregar mais"
            accessibilityState={{ disabled: socialFeed.isFetchingNextPage }}
          >
            <Text className="text-white text-sm font-semibold text-center">
              {socialFeed.isFetchingNextPage ? "A carregar..." : "Carregar mais"}
            </Text>
          </Pressable>
        );
      }

      return null;
    },
    [followRequests.refetch, router, socialFeed, suggestions.refetch],
  );

  return (
    <LiquidBackground>
      <TopAppHeader />
      <SectionList
        sections={sections}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        renderSectionFooter={renderSectionFooter}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: tabBarPadding, paddingTop: topPadding }}
        refreshing={suggestions.isFetching || socialFeed.isFetching || followRequests.isFetching}
        onRefresh={handleRefresh}
        removeClippedSubviews={Platform.OS === "android"}
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        updateCellsBatchingPeriod={40}
        windowSize={6}
        stickySectionHeadersEnabled={false}
      />
    </LiquidBackground>
  );
}
