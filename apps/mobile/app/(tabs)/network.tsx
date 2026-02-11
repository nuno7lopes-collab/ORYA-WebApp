import { useCallback, useEffect, useMemo, useState } from "react";
import { Platform, Pressable, SectionList, Text, View } from "react-native";
import { tokens } from "@orya/shared";
import { LiquidBackground } from "../../components/liquid/LiquidBackground";
import { SectionHeader } from "../../components/liquid/SectionHeader";
import { GlassCard } from "../../components/liquid/GlassCard";
import { GlassSkeleton } from "../../components/glass/GlassSkeleton";
import { useNetworkActions, useNetworkSuggestions } from "../../features/network/hooks";
import { useSocialFeed } from "../../features/social/hooks";
import { SocialFeedCard } from "../../features/social/SocialFeedCard";
import { useIpLocation } from "../../features/onboarding/hooks";
import { SocialFeedItem } from "../../features/social/types";
import { useTabBarPadding } from "../../components/navigation/useTabBarPadding";
import { TopAppHeader } from "../../components/navigation/TopAppHeader";
import { TopTicketsButton } from "../../components/navigation/TopTicketsButton";
import { useTopHeaderPadding } from "../../components/navigation/useTopHeaderPadding";
import { useTopBarScroll } from "../../components/navigation/useTopBarScroll";
import { useRouter } from "expo-router";
import { useIsFocused } from "@react-navigation/native";
import { NetworkPeopleDeck } from "../../features/network/NetworkPeopleDeck";

const SECTION_SPACING = 24;

type NetworkSectionKey = "feed";

type NetworkSectionItem =
  | { type: "skeleton"; key: string; variant: NetworkSectionKey }
  | { type: "feed"; feed: SocialFeedItem };

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
  const isFocused = useIsFocused();
  const [dataReady, setDataReady] = useState(false);
  const suggestions = useNetworkSuggestions(dataReady);
  const actions = useNetworkActions();
  const socialFeed = useSocialFeed(8, dataReady);
  const { data: ipLocation } = useIpLocation(dataReady);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const userLat = ipLocation?.approxLatLon?.lat ?? null;
  const userLon = ipLocation?.approxLatLon?.lon ?? null;
  const tabBarPadding = useTabBarPadding();
  const topPadding = useTopHeaderPadding(12);
  const topBar = useTopBarScroll();

  const feedItems = useMemo(
    () => socialFeed.data?.pages.flatMap((page) => page.items) ?? [],
    [socialFeed.data?.pages],
  );
  const feedSkeleton = socialFeed.isLoading && feedItems.length === 0;
  const feedEmpty = !socialFeed.isLoading && !socialFeed.isError && feedItems.length === 0;

  const data = suggestions.data ?? [];
  const showSkeleton = suggestions.isLoading && data.length === 0;

  const sections = useMemo<NetworkSection[]>(
    () => [
      {
        key: "feed",
        title: "Atualizações",
        subtitle: "Clubes e eventos que segues.",
        data: feedSkeleton
          ? buildSkeletons("feed", 2)
          : feedItems.map((feed) => ({ type: "feed" as const, feed })),
        isError: socialFeed.isError,
        isEmpty: feedEmpty,
      },
    ],
    [
      feedEmpty,
      feedItems,
      feedSkeleton,
      socialFeed.isError,
    ],
  );

  const handleRefresh = useCallback(() => {
    suggestions.refetch();
    socialFeed.refetch();
  }, [socialFeed, suggestions]);

  useEffect(() => {
    setDataReady(isFocused);
  }, [isFocused]);

  const renderItem = useCallback(
    ({ item, index }: { item: NetworkSectionItem; index: number }) => {
      if (item.type === "skeleton") {
        const height = 240;
        const spacingClass = "mb-4";
        return <GlassSkeleton className={spacingClass} height={height} />;
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
    [userLat, userLon],
  );

  const keyExtractor = useCallback((item: NetworkSectionItem) => {
    if (item.type === "skeleton") return item.key;
    return `feed-${item.feed.id}`;
  }, []);

  const renderSectionHeader = useCallback(
    ({ section }: { section: NetworkSection }) => (
      <View style={{ paddingTop: SECTION_SPACING }}>
        <SectionHeader title={section.title} subtitle={section.subtitle} />
      </View>
    ),
    [],
  );

  const renderSectionFooter = useCallback(
    ({ section }: { section: NetworkSection }) => {
      if (section.isError) {
        const onRetry = socialFeed.refetch;
        const message = "Não foi possível carregar as novidades.";
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
        const message = "Ainda sem novidades.";
        return (
          <GlassCard intensity={48} className="mb-4">
            <Text className="text-white/70 text-sm">{message}</Text>
            <Pressable
              onPress={() => router.push("/search")}
              className="mt-3 rounded-xl border border-white/15 bg-white/5 px-4 py-3"
              style={{ minHeight: tokens.layout.touchTarget }}
              accessibilityRole="button"
              accessibilityLabel="Pesquisar pessoas"
            >
              <Text className="text-white text-sm font-semibold text-center">Pesquisar pessoas</Text>
            </Pressable>
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
    [router, socialFeed],
  );

  const handleDismiss = useCallback((userId: string) => {
    setDismissedIds((prev) => (prev.includes(userId) ? prev : [...prev, userId]));
  }, []);

  const peopleQueue = useMemo(
    () => data.filter((item) => !dismissedIds.includes(item.id)),
    [data, dismissedIds],
  );

  const renderHeader = useCallback(() => {
    return (
      <View>
        <SectionHeader title="Conhecer pessoas" subtitle="Pessoas novas" />
        {showSkeleton ? (
          <GlassSkeleton className="mb-6" height={320} />
        ) : suggestions.isError ? (
          <GlassCard intensity={52} className="mb-6">
            <Text className="text-red-300 text-sm mb-3">
              Não foi possível carregar pessoas.
            </Text>
            <Pressable
              className="rounded-xl bg-white/10 px-4 py-3"
              onPress={() => suggestions.refetch()}
              style={{ minHeight: tokens.layout.touchTarget }}
              accessibilityRole="button"
              accessibilityLabel="Tentar novamente"
            >
              <Text className="text-white text-sm font-semibold text-center">Tentar novamente</Text>
            </Pressable>
          </GlassCard>
        ) : (
          <NetworkPeopleDeck
            items={peopleQueue}
            pendingUserId={actions.pendingUserId}
            onFollow={actions.follow}
            onDismiss={handleDismiss}
          />
        )}

        <SectionHeader title="Oportunidades" subtitle="Jogos e convites" />
        <GlassCard intensity={48} className="mb-2">
          <Text className="text-white/70 text-sm">
            Em breve: jogos de padel com 3 vagas.
          </Text>
          <Text className="text-white/50 text-xs mt-2">
            Vamos ligar-te a pessoas do mesmo evento.
          </Text>
        </GlassCard>
      </View>
    );
  }, [
    actions.follow,
    actions.pendingUserId,
    handleDismiss,
    peopleQueue,
    showSkeleton,
    suggestions,
  ]);

  return (
    <LiquidBackground>
      <TopAppHeader
        scrollState={topBar}
        variant="title"
        title="Rede"
        titleAlign="center"
        leftSlot={<TopTicketsButton />}
        showNotifications
        showMessages={false}
      />
      <SectionList
        sections={sections}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        renderSectionFooter={renderSectionFooter}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: tabBarPadding, paddingTop: topPadding }}
        onScroll={topBar.onScroll}
        onScrollEndDrag={topBar.onScrollEndDrag}
        onMomentumScrollEnd={topBar.onMomentumScrollEnd}
        scrollEventThrottle={16}
        refreshing={suggestions.isFetching || socialFeed.isFetching}
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
