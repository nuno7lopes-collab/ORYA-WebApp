import { useCallback, useEffect, useMemo, useState } from "react";
import {
  LayoutAnimation,
  Platform,
  Pressable,
  SectionList,
  ScrollView,
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
import { useIsFocused, useNavigation } from "@react-navigation/native";
import { safeBack } from "../../lib/navigation";
import { useIpLocation } from "../../features/onboarding/hooks";
import { DiscoverOfferCard } from "../../features/discover/types";
import { SearchOrganization, SearchUser } from "../../features/search/types";
import { EventCardSquare, EventCardSquareSkeleton } from "../../components/events/EventCardSquare";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTabBarPadding } from "../../components/navigation/useTabBarPadding";

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

type SearchTabKey = "all" | "events" | "padel" | "services" | "people" | "orgs";

const SEARCH_TABS: Array<{ key: SearchTabKey; label: string }> = [
  { key: "all", label: "Tudo" },
  { key: "events", label: "Eventos" },
  { key: "padel", label: "Padel" },
  { key: "services", label: "Serviços" },
  { key: "people", label: "Pessoas" },
  { key: "orgs", label: "Organizações" },
];

const buildSkeletons = (variant: SearchSectionKey, count: number): SearchSectionItem[] =>
  Array.from({ length: count }, (_, index) => ({
    type: "skeleton",
    key: `${variant}-skeleton-${index}`,
    variant,
  }));

export default function SearchScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const params = useLocalSearchParams<{ q?: string; tab?: string; kind?: string }>();
  const initialQuery = typeof params.q === "string" ? params.q : "";
  const [query, setQuery] = useState(initialQuery);
  const [activeTab, setActiveTab] = useState<SearchTabKey>("all");
  const [serviceKindFilter, setServiceKindFilter] = useState<string | null>(null);
  const debounced = useDebouncedValue(query, 280);
  const handleBack = useCallback(() => {
    safeBack(router, navigation, "/(tabs)/index");
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
  const { data: ipLocation } = useIpLocation(isFocused);
  const userLat = ipLocation?.approxLatLon?.lat ?? null;
  const userLon = ipLocation?.approxLatLon?.lon ?? null;
  const insets = useSafeAreaInsets();
  const tabBarPadding = useTabBarPadding();
  const bottomPadding = Math.max(tabBarPadding, insets.bottom + 24);
  const queryLength = debounced.trim().length;
  const showSkeleton = enabled && isLoading;
  const allErrored = offersQuery.isError && usersQuery.isError && orgsQuery.isError;

  useEffect(() => {
    const tabParamRaw = typeof params.tab === "string" ? params.tab : null;
    const tabParam = tabParamRaw?.toLowerCase() ?? null;
    if (tabParam && SEARCH_TABS.some((tab) => tab.key === tabParam)) {
      setActiveTab(tabParam as SearchTabKey);
    }
    const kindParamRaw = typeof params.kind === "string" ? params.kind : null;
    const kindParam = kindParamRaw?.toUpperCase() ?? null;
    setServiceKindFilter(kindParam && ["COURT", "CLASS"].includes(kindParam) ? kindParam : null);
  }, [params.kind, params.tab]);

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
    const showOffers = activeTab === "all" || activeTab === "events" || activeTab === "padel" || activeTab === "services";
    const showUsers = activeTab === "all" || activeTab === "people";
    const showOrgs = activeTab === "all" || activeTab === "orgs";

    const filteredOffers = offers.filter((offer) => {
      if (activeTab === "events") return offer.type === "event";
      if (activeTab === "services") {
        if (offer.type !== "service") return false;
        if (!serviceKindFilter) return true;
        return offer.service.kind === serviceKindFilter;
      }
      if (activeTab === "padel") {
        if (offer.type === "service") return offer.service.kind === "COURT";
        return (offer.event.categories ?? []).includes("PADEL");
      }
      return true;
    });

    const built: SearchSection[] = [
      {
        key: "offers",
        title: "Ofertas",
        subtitle: "Eventos, serviços e experiências",
        data: showOffers
          ? showSkeleton
            ? buildSkeletons("offers", 2)
            : filteredOffers.map((offer) => ({ type: "offer" as const, offer }))
          : [],
        isError: offersQuery.isError,
      },
      {
        key: "users",
        title: "Pessoas",
        subtitle: "Utilizadores e perfis",
        data: showUsers
          ? showSkeleton
            ? buildSkeletons("users", 2)
            : users.map((user) => ({ type: "user" as const, user }))
          : [],
        isError: usersQuery.isError,
      },
      {
        key: "orgs",
        title: "Organizacoes",
        subtitle: "Clubes e marcas",
        data: showOrgs
          ? showSkeleton
            ? buildSkeletons("orgs", 2)
            : organizations.map((org) => ({ type: "org" as const, org }))
          : [],
        isError: orgsQuery.isError,
      },
    ];
    return built.filter((section) => section.data.length > 0);
  }, [activeTab, enabled, offers, offersQuery.isError, organizations, orgsQuery.isError, showSkeleton, users, usersQuery.isError]);

  const renderItem = useCallback(
    ({ item, index }: { item: SearchSectionItem; index: number }) => {
      if (item.type === "skeleton") {
        if (item.variant === "offers") {
          return <EventCardSquareSkeleton />;
        }
        const height = item.variant === "users" ? 72 : 72;
        const spacingClass = "mb-3";
        return <GlassSkeleton className={spacingClass} height={height} />;
      }

      if (item.type === "offer") {
        return item.offer.type === "event" ? (
          <EventCardSquare event={item.offer.event} index={index} userLat={userLat} userLon={userLon} source="search" />
        ) : (
          <DiscoverEventCard
            item={item.offer.service}
            itemType="service"
            index={index}
            userLat={userLat}
            userLon={userLon}
            source="search"
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
            ? "Não foi possível carregar as ofertas."
          : section.key === "users"
            ? "Não foi possível carregar utilizadores."
            : "Não foi possível carregar organizações.";

      return (
        <View className="pb-2">
          <GlassSurface intensity={45}>
            <Text className="text-red-300 text-sm mb-3">{message}</Text>
            <Pressable
              onPress={() => onRetry()}
              className="rounded-xl bg-white/10 px-4 py-3"
              style={{ minHeight: tokens.layout.touchTarget }}
              accessibilityRole="button"
              accessibilityLabel="Tentar novamente"
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
        <View style={{ height: insets.top }} />
        <View className="flex-row items-center justify-between">
          <Pressable
            onPress={handleBack}
            className="rounded-full border border-white/10 px-3 py-2"
            style={{ minHeight: tokens.layout.touchTarget }}
            accessibilityRole="button"
            accessibilityLabel="Voltar"
            hitSlop={10}
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
                accessibilityLabel="Pesquisar"
                accessibilityHint="Escreve para procurar eventos, pessoas ou organizações"
                returnKeyType="search"
              />
              {query.length > 0 ? (
                <Pressable
                  onPress={() => setQuery("")}
                  accessibilityRole="button"
                  accessibilityLabel="Limpar pesquisa"
                  className="rounded-full bg-white/10 px-2 py-1"
                >
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
              {enabled && !isLoading && !allErrored && !hasResults ? (
                <Pressable
                  onPress={() => setQuery("")}
                  className="mt-3 rounded-xl border border-white/15 bg-white/5 px-4 py-3"
                  style={{ minHeight: tokens.layout.touchTarget }}
                  accessibilityRole="button"
                  accessibilityLabel="Limpar pesquisa"
                >
                  <Text className="text-white text-sm font-semibold text-center">Limpar pesquisa</Text>
                </Pressable>
              ) : null}
              <Pressable
                onPress={() => router.push("/(tabs)/index")}
                className="mt-3 rounded-xl border border-white/15 bg-white/5 px-4 py-3"
                style={{ minHeight: tokens.layout.touchTarget }}
                accessibilityRole="button"
                accessibilityLabel="Ir para Descobrir"
              >
                <Text className="text-white text-sm font-semibold text-center">Ir para Descobrir</Text>
              </Pressable>
            </GlassSurface>
          </View>
        ) : null}

        <View style={{ marginTop: tokens.spacing.lg }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
            {SEARCH_TABS.map((tab) => {
              const active = activeTab === tab.key;
              return (
                <Pressable
                  key={tab.key}
                  onPress={() => setActiveTab(tab.key)}
                  accessibilityRole="button"
                  accessibilityLabel={`Filtrar por ${tab.label}`}
                  accessibilityState={{ selected: active }}
                  style={({ pressed }) => [
                    {
                      paddingHorizontal: 16,
                      paddingVertical: 10,
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: active ? "rgba(170, 220, 255, 0.55)" : "rgba(255,255,255,0.12)",
                      backgroundColor: active ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.06)",
                      minHeight: tokens.layout.touchTarget,
                    },
                    pressed ? { opacity: 0.9 } : null,
                  ]}
                >
                  <Text style={active ? { color: "#ffffff", fontWeight: "600" } : { color: "rgba(255,255,255,0.7)" }}>
                    {tab.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </View>
    ),
    [activeTab, allErrored, emptyMessage, enabled, handleBack, hasResults, insets.top, isLoading, query, router],
  );

  const listFooter = useMemo(() => {
    if (!enabled || showSkeleton || !allErrored) return null;
    return (
      <View className="pt-6">
        <GlassSurface intensity={45}>
          <Text className="text-red-300 text-sm mb-3">Não foi possível carregar os resultados.</Text>
          <Pressable
            onPress={() => {
              offersQuery.refetch();
              usersQuery.refetch();
              orgsQuery.refetch();
            }}
            className="rounded-xl bg-white/10 px-4 py-3"
            style={{ minHeight: tokens.layout.touchTarget }}
            accessibilityRole="button"
            accessibilityLabel="Tentar novamente"
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
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: bottomPadding }}
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
