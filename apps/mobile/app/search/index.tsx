import { useCallback, useEffect, useMemo, useState } from "react";
import {
  LayoutAnimation,
  Platform,
  Pressable,
  SectionList,
  Text,
  TextInput,
  UIManager,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "../../components/icons/Ionicons";
import { tokens } from "@orya/shared";
import { LiquidBackground } from "../../components/liquid/LiquidBackground";
import { SectionHeader } from "../../components/liquid/SectionHeader";
import { GlassSurface } from "../../components/glass/GlassSurface";
import { GlassSkeleton } from "../../components/glass/GlassSkeleton";
import { DiscoverEventCard } from "../../features/discover/DiscoverEventCard";
import { useDebouncedValue } from "../../features/discover/hooks";
import { useGlobalSearch } from "../../features/search/hooks";
import { SearchUserRow } from "../../features/search/SearchUserRow";
import { SearchOrganizationRow } from "../../features/search/SearchOrganizationRow";
import { useNetworkActions, useOrganizationFollowActions } from "../../features/network/hooks";
import { useNavigation } from "@react-navigation/native";
import { safeBack } from "../../lib/navigation";
import { useIpLocation } from "../../features/onboarding/hooks";
import { DiscoverOfferCard } from "../../features/discover/types";
import { SearchOrganization, SearchUser } from "../../features/search/types";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type SearchSectionKey = "offers" | "users" | "orgs";

type SearchSectionItem =
  | { type: "skeleton"; key: string; variant: SearchSectionKey }
  | { type: "offer"; offer: DiscoverOfferCard }
  | { type: "user"; user: SearchUser }
  | { type: "org"; org: SearchOrganization };

type SearchSection = {
  key: SearchSectionKey;
  title: string;
  subtitle: string;
  data: SearchSectionItem[];
  isError: boolean;
};

const buildSkeletons = (variant: SearchSectionKey, count: number): SearchSectionItem[] =>
  Array.from({ length: count }, (_, index) => ({
    type: "skeleton",
    key: `${variant}-skeleton-${index}`,
    variant,
  }));

export default function SearchScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const params = useLocalSearchParams<{ q?: string }>();
  const initialQuery = typeof params.q === "string" ? params.q : "";
  const [query, setQuery] = useState(initialQuery);
  const debounced = useDebouncedValue(query, 280);
  const handleBack = useCallback(() => {
    safeBack(router, navigation);
  }, [navigation, router]);

  const {
    offers,
    users,
    organizations,
    hasResults,
    isLoading,
    enabled,
    minQueryLength,
    offersQuery,
    usersQuery,
    orgsQuery,
  } = useGlobalSearch(debounced);
  const userActions = useNetworkActions();
  const organizationActions = useOrganizationFollowActions();
  const { data: ipLocation } = useIpLocation();
  const userLat = ipLocation?.approxLatLon?.lat ?? null;
  const userLon = ipLocation?.approxLatLon?.lon ?? null;
  const queryLength = debounced.trim().length;
  const showSkeleton = enabled && isLoading;
  const allErrored = offersQuery.isError && usersQuery.isError && orgsQuery.isError;

  useEffect(() => {
    const total = offers.length + users.length + organizations.length;
    if (total <= 24) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
  }, [offers.length, users.length, organizations.length]);

  const emptyMessage = useMemo(() => {
    if (!debounced) return "Escreve algo para pesquisar ofertas, pessoas ou clubes.";
    if (queryLength > 0 && queryLength < minQueryLength) {
      return `Escreve pelo menos ${minQueryLength} caracteres.`;
    }
    if (!isLoading && !allErrored && !hasResults && enabled) return "Sem resultados para esta pesquisa.";
    return null;
  }, [debounced, enabled, hasResults, isLoading, minQueryLength, queryLength, allErrored]);

  const sections = useMemo<SearchSection[]>(() => {
    if (!enabled) return [];
    return [
      {
        key: "offers",
        title: "Ofertas",
        subtitle: "Eventos, servicos e experiencias",
        data: showSkeleton
          ? buildSkeletons("offers", 2)
          : offers.map((offer) => ({ type: "offer" as const, offer })),
        isError: offersQuery.isError,
      },
      {
        key: "users",
        title: "Pessoas",
        subtitle: "Utilizadores e perfis",
        data: showSkeleton
          ? buildSkeletons("users", 2)
          : users.map((user) => ({ type: "user" as const, user })),
        isError: usersQuery.isError,
      },
      {
        key: "orgs",
        title: "Organizacoes",
        subtitle: "Clubes e marcas",
        data: showSkeleton
          ? buildSkeletons("orgs", 2)
          : organizations.map((org) => ({ type: "org" as const, org })),
        isError: orgsQuery.isError,
      },
    ];
  }, [enabled, offers, organizations, showSkeleton, offersQuery.isError, orgsQuery.isError, users, usersQuery.isError]);

  const renderItem = useCallback(
    ({ item, index }: { item: SearchSectionItem; index: number }) => {
      if (item.type === "skeleton") {
        const height = item.variant === "offers" ? 150 : 72;
        const spacingClass = item.variant === "offers" ? "mb-4" : "mb-3";
        return <GlassSkeleton className={spacingClass} height={height} />;
      }

      if (item.type === "offer") {
        return item.offer.type === "event" ? (
          <DiscoverEventCard
            item={item.offer.event}
            itemType="event"
            index={index}
            userLat={userLat}
            userLon={userLon}
          />
        ) : (
          <DiscoverEventCard
            item={item.offer.service}
            itemType="service"
            index={index}
            userLat={userLat}
            userLon={userLon}
          />
        );
      }

      if (item.type === "user") {
        return (
          <SearchUserRow
            item={item.user}
            pending={userActions.pendingUserId === item.user.id}
            onFollow={userActions.follow}
            onUnfollow={userActions.unfollow}
          />
        );
      }

      if (item.type === "org") {
        return (
          <SearchOrganizationRow
            item={item.org}
            pending={organizationActions.pendingOrgId === item.org.id}
            onFollow={organizationActions.follow}
            onUnfollow={organizationActions.unfollow}
          />
        );
      }

      return null;
    },
    [organizationActions.follow, organizationActions.pendingOrgId, organizationActions.unfollow, userActions.follow, userActions.pendingUserId, userActions.unfollow, userLat, userLon],
  );

  const keyExtractor = useCallback((item: SearchSectionItem) => {
    if (item.type === "skeleton") return item.key;
    if (item.type === "offer") return item.offer.key;
    if (item.type === "user") return `user-${item.user.id}`;
    return `org-${item.org.id}`;
  }, []);

  const renderSectionHeader = useCallback(
    ({ section }: { section: SearchSection }) => (
      <View style={{ paddingTop: section.key === "offers" ? 12 : 24 }}>
        <SectionHeader title={section.title} subtitle={section.subtitle} />
      </View>
    ),
    [],
  );

  const renderSectionFooter = useCallback(
    ({ section }: { section: SearchSection }) => {
      if (showSkeleton || !enabled || !section.isError) return null;

      const onRetry =
        section.key === "offers"
          ? offersQuery.refetch
          : section.key === "users"
            ? usersQuery.refetch
            : orgsQuery.refetch;
      const message =
        section.key === "offers"
          ? "Nao foi possivel carregar as ofertas."
          : section.key === "users"
            ? "Nao foi possivel carregar utilizadores."
            : "Nao foi possivel carregar organizacoes.";

      return (
        <View className="pb-2">
          <GlassSurface intensity={45}>
            <Text className="text-red-300 text-sm mb-3">{message}</Text>
            <Pressable
              onPress={() => onRetry()}
              className="rounded-xl bg-white/10 px-4 py-3"
              style={{ minHeight: tokens.layout.touchTarget }}
            >
              <Text className="text-white text-sm font-semibold text-center">Tentar novamente</Text>
            </Pressable>
          </GlassSurface>
        </View>
      );
    },
    [enabled, offersQuery.refetch, orgsQuery.refetch, showSkeleton, usersQuery.refetch],
  );

  const listHeader = useMemo(
    () => (
      <View className="pt-14 pb-5">
        <View className="flex-row items-center justify-between">
          <Pressable
            onPress={handleBack}
            className="rounded-full border border-white/10 px-3 py-2"
            style={{ minHeight: tokens.layout.touchTarget }}
          >
            <Ionicons name="chevron-back" size={18} color={tokens.colors.text} />
          </Pressable>
          <Text className="text-white text-lg font-semibold">Pesquisa</Text>
          <View style={{ width: tokens.layout.touchTarget }} />
        </View>

        <View style={{ marginTop: tokens.spacing.lg }}>
          <GlassSurface intensity={68} padding={12}>
            <View className="flex-row items-center gap-3">
              <Ionicons name="search" size={18} color={tokens.colors.textMuted} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Eventos, clubes, amigos..."
                placeholderTextColor={tokens.colors.textMuted}
                className="text-white text-base flex-1"
                returnKeyType="search"
              />
              {query.length > 0 ? (
                <Pressable onPress={() => setQuery("")} className="rounded-full bg-white/10 px-2 py-1">
                  <Ionicons name="close" size={14} color={tokens.colors.textMuted} />
                </Pressable>
              ) : null}
            </View>
          </GlassSurface>
        </View>

        {emptyMessage ? (
          <View className="pt-5">
            <GlassSurface intensity={50}>
              <Text className="text-white/70 text-sm">{emptyMessage}</Text>
            </GlassSurface>
          </View>
        ) : null}
      </View>
    ),
    [emptyMessage, handleBack, query],
  );

  const listFooter = useMemo(() => {
    if (!enabled || showSkeleton || !allErrored) return null;
    return (
      <View className="pt-6">
        <GlassSurface intensity={45}>
          <Text className="text-red-300 text-sm mb-3">Nao foi possivel carregar os resultados.</Text>
          <Pressable
            onPress={() => {
              offersQuery.refetch();
              usersQuery.refetch();
              orgsQuery.refetch();
            }}
            className="rounded-xl bg-white/10 px-4 py-3"
            style={{ minHeight: tokens.layout.touchTarget }}
          >
            <Text className="text-white text-sm font-semibold text-center">Tentar novamente</Text>
          </Pressable>
        </GlassSurface>
      </View>
    );
  }, [allErrored, enabled, offersQuery, orgsQuery, showSkeleton, usersQuery]);

  return (
    <LiquidBackground>
      <SectionList
        sections={sections}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        renderSectionFooter={renderSectionFooter}
        ListHeaderComponent={listHeader}
        ListFooterComponent={listFooter}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 48 }}
        keyboardShouldPersistTaps="handled"
        removeClippedSubviews={Platform.OS === "android"}
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        updateCellsBatchingPeriod={40}
        windowSize={7}
        stickySectionHeadersEnabled={false}
      />
    </LiquidBackground>
  );
}
