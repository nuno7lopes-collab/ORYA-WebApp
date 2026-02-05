import { useCallback, useMemo } from "react";
import { Platform, Pressable, SectionList, Text, View } from "react-native";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTabBarPadding } from "../../components/navigation/useTabBarPadding";

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
  const suggestions = useNetworkSuggestions();
  const actions = useNetworkActions();
  const followRequests = useFollowRequests();
  const followRequestActions = useFollowRequestActions();
  const socialFeed = useSocialFeed(8);
  const { data: ipLocation } = useIpLocation();
  const userLat = ipLocation?.approxLatLon?.lat ?? null;
  const userLon = ipLocation?.approxLatLon?.lon ?? null;
  const insets = useSafeAreaInsets();
  const tabBarPadding = useTabBarPadding();

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

  const renderItem = useCallback(
    ({ item, index }: { item: NetworkSectionItem; index: number }) => {
      if (item.type === "skeleton") {
        const height =
          item.variant === "feed" ? 240 : item.variant === "requests" ? 110 : 86;
        const spacingClass = item.variant === "feed" ? "mb-4" : "mb-3";
        return <GlassSkeleton className={spacingClass} height={height} />;
      }

      if (item.type === "suggestion") {
        return (
          <NetworkSuggestionCard
            item={item.suggestion}
            pending={actions.pendingUserId === item.suggestion.id}
            onFollow={actions.follow}
            onUnfollow={actions.unfollow}
          />
        );
      }

      if (item.type === "request") {
        return (
          <FollowRequestCard
            item={item.request}
            pending={followRequestActions.pendingRequestId === item.request.id}
            onAccept={followRequestActions.accept}
            onDecline={followRequestActions.decline}
          />
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
          >
            <Text className="text-white text-sm font-semibold text-center">
              {socialFeed.isFetchingNextPage ? "A carregar..." : "Carregar mais"}
            </Text>
          </Pressable>
        );
      }

      return null;
    },
    [followRequests.refetch, socialFeed, suggestions.refetch],
  );

  return (
    <LiquidBackground>
      <SectionList
        sections={sections}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        renderSectionFooter={renderSectionFooter}
        ListHeaderComponent={
          <View style={{ paddingTop: insets.top + 12, paddingBottom: 8 }}>
            <Text className="text-white text-[30px] font-semibold">Rede</Text>
            <Text className="mt-1 text-white/60 text-sm">
              Segue pessoas e clubes para personalizar o teu feed.
            </Text>
          </View>
        }
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: tabBarPadding }}
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
