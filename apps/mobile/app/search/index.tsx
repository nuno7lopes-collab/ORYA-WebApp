import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { safeBack, safePush } from "../../lib/navigation";
import { useIpLocation } from "../../features/onboarding/hooks";
import { DiscoverKind, DiscoverOfferCard } from "../../features/discover/types";
import { SearchOrganization, SearchUser } from "../../features/search/types";
import { EventCardSquare } from "../../components/events/EventCardSquare";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTabBarPadding } from "../../components/navigation/useTabBarPadding";
import AsyncStorage from "@react-native-async-storage/async-storage";

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

type SearchTabKey = "all" | "padel" | "events" | "services" | "people" | "orgs";

const SEARCH_TABS: Array<{ key: SearchTabKey; label: string }> = [
  { key: "all", label: "Tudo" },
  { key: "padel", label: "Padel" },
  { key: "events", label: "Eventos" },
  { key: "services", label: "Serviços" },
  { key: "people", label: "Pessoas" },
  { key: "orgs", label: "Organizações" },
];
const SEARCH_RECENTS_STORAGE_KEY = "orya:search:recents";
const SEARCH_RECENTS_LIMIT = 6;
const QUICK_SEARCH_SUGGESTIONS = [
  "Padel",
  "Torneio",
  "Aula",
  "Treino",
  "Serviços",
  "Parceiro de jogo",
] as const;

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
  const [recentQueries, setRecentQueries] = useState<string[]>([]);
  const previousResultCountRef = useRef(0);
  const lastSavedQueryRef = useRef("");
  const debounced = useDebouncedValue(query, 280);
  const offersKind: DiscoverKind =
    activeTab === "events"
      ? "events"
      : activeTab === "services"
        ? "services"
        : activeTab === "padel"
          ? "padel"
          : "all";
  const includeOffers = activeTab !== "people" && activeTab !== "orgs";
  const handleBack = useCallback(() => {
    safeBack(router, navigation, "/(tabs)/index");
  }, [navigation, router]);

  const {
    offers,
    users,
    organizations,
    enabled,
    minQueryLength,
    offersQuery,
    usersQuery,
    orgsQuery,
  } = useGlobalSearch(debounced, { offersKind, includeOffers });
  const userActions = useNetworkActions();
  const organizationActions = useOrganizationFollowActions();
  const { data: ipLocation } = useIpLocation(isFocused);
  const userLat = ipLocation?.approxLatLon?.lat ?? null;
  const userLon = ipLocation?.approxLatLon?.lon ?? null;
  const insets = useSafeAreaInsets();
  const tabBarPadding = useTabBarPadding();
  const bottomPadding = Math.max(tabBarPadding, insets.bottom + 24);
  const queryLength = debounced.trim().length;
  const showOffers = activeTab === "all" || activeTab === "padel" || activeTab === "events" || activeTab === "services";
  const showUsers = activeTab === "all" || activeTab === "people";
  const showOrgs = activeTab === "all" || activeTab === "orgs";
  const showRecentQueries = debounced.trim().length === 0 && recentQueries.length > 0;
  const showQuickSuggestions = debounced.trim().length === 0;

  const persistRecentQuery = useCallback((rawValue: string) => {
    const normalized = rawValue.trim().replace(/\s+/g, " ");
    if (normalized.length < 2) return;
    setRecentQueries((previous) => {
      const withoutCurrent = previous.filter(
        (item) => item.toLowerCase() !== normalized.toLowerCase(),
      );
      const next = [normalized, ...withoutCurrent].slice(0, SEARCH_RECENTS_LIMIT);
      AsyncStorage.setItem(SEARCH_RECENTS_STORAGE_KEY, JSON.stringify(next)).catch(() => undefined);
      return next;
    });
  }, []);

  const removeRecentQuery = useCallback((value: string) => {
    setRecentQueries((previous) => {
      const next = previous.filter((item) => item.toLowerCase() !== value.toLowerCase());
      AsyncStorage.setItem(SEARCH_RECENTS_STORAGE_KEY, JSON.stringify(next)).catch(() => undefined);
      return next;
    });
  }, []);

  const clearRecentQueries = useCallback(() => {
    setRecentQueries([]);
    AsyncStorage.removeItem(SEARCH_RECENTS_STORAGE_KEY).catch(() => undefined);
  }, []);

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(SEARCH_RECENTS_STORAGE_KEY)
      .then((raw) => {
        if (!mounted || !raw) return;
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return;
        const next = parsed
          .filter((item): item is string => typeof item === "string")
          .map((item) => item.trim())
          .filter((item) => item.length >= 2)
          .slice(0, SEARCH_RECENTS_LIMIT);
        setRecentQueries(next);
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, []);

  const filteredOffers = useMemo(() => {
    return offers.filter((offer) => {
      if (activeTab === "padel") {
        if (offer.type === "service") return offer.service.kind === "COURT";
        const event = offer.event;
        return event.templateType === "PADEL" || Boolean(event.tournament) || (event.categories ?? []).includes("PADEL");
      }
      if (activeTab === "events") return offer.type === "event";
      if (activeTab === "services") {
        if (offer.type !== "service") return false;
        if (!serviceKindFilter) return true;
        return offer.service.kind === serviceKindFilter;
      }
      return true;
    });
  }, [activeTab, offers, serviceKindFilter]);

  const offersLoading = showOffers && offersQuery.isLoading && filteredOffers.length === 0;
  const usersLoading = showUsers && usersQuery.isLoading && users.length === 0;
  const orgsLoading = showOrgs && orgsQuery.isLoading && organizations.length === 0;
  const hasVisibleLoading = offersLoading || usersLoading || orgsLoading;

  const hasVisibleResults =
    (showOffers && filteredOffers.length > 0) ||
    (showUsers && users.length > 0) ||
    (showOrgs && organizations.length > 0);

  const visibleErrorStates = [
    showOffers ? offersQuery.isError : false,
    showUsers ? usersQuery.isError : false,
    showOrgs ? orgsQuery.isError : false,
  ].filter(Boolean);
  const allVisibleErrored = visibleErrorStates.length > 0 && visibleErrorStates.every(Boolean);

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
    const previousTotal = previousResultCountRef.current;
    previousResultCountRef.current = total;
    if (Platform.OS !== "ios") return;
    if (previousTotal === 0 || total === 0) return;
    const delta = Math.abs(total - previousTotal);
    if (delta > 0 && delta <= 6) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
  }, [offers.length, users.length, organizations.length]);

  useEffect(() => {
    const normalized = debounced.trim().replace(/\s+/g, " ");
    if (!enabled || normalized.length < minQueryLength) return;
    if (normalized.toLowerCase() === lastSavedQueryRef.current.toLowerCase()) return;
    lastSavedQueryRef.current = normalized;
    persistRecentQuery(normalized);
  }, [debounced, enabled, minQueryLength, persistRecentQuery]);

  const emptyMessage = useMemo(() => {
    if (!debounced) {
      return recentQueries.length > 0 ? null : "Escreve algo para pesquisar ofertas, pessoas ou clubes.";
    }
    if (queryLength > 0 && queryLength < minQueryLength) {
      return `Escreve pelo menos ${minQueryLength} caracteres.`;
    }
    if (!hasVisibleLoading && !allVisibleErrored && !hasVisibleResults && enabled) {
      return "Sem resultados para esta pesquisa.";
    }
    return null;
  }, [allVisibleErrored, debounced, enabled, hasVisibleLoading, hasVisibleResults, minQueryLength, queryLength, recentQueries.length]);

  const sections = useMemo<SearchSection[]>(() => {
    if (!enabled) return [];
    const offersSubtitle =
      activeTab === "padel"
        ? "Torneios e campos de padel"
        : "Eventos, serviços e experiências";

    const built: SearchSection[] = [
      {
        key: "offers",
        title: "Ofertas",
        subtitle: offersSubtitle,
        data: showOffers
          ? offersLoading
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
          ? usersLoading
            ? buildSkeletons("users", 2)
            : users.map((user) => ({ type: "user" as const, user }))
          : [],
        isError: usersQuery.isError,
      },
      {
        key: "orgs",
        title: "Organizações",
        subtitle: "Clubes e marcas",
        data: showOrgs
          ? orgsLoading
            ? buildSkeletons("orgs", 2)
            : organizations.map((org) => ({ type: "org" as const, org }))
          : [],
        isError: orgsQuery.isError,
      },
    ];
    return built.filter((section) => section.data.length > 0 || section.isError);
  }, [
    enabled,
    filteredOffers,
    offersLoading,
    offersQuery.isError,
    organizations,
    orgsLoading,
    orgsQuery.isError,
    showOffers,
    showOrgs,
    showUsers,
    users,
    usersLoading,
    usersQuery.isError,
    activeTab,
  ]);

  const renderItem = useCallback(
    ({ item, index }: { item: SearchSectionItem; index: number }) => {
      if (item.type === "skeleton") {
        const height = item.variant === "offers" ? 180 : 72;
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
      if (!enabled || !section.isError || section.data.length > 0) return null;

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
    [enabled, offersQuery.refetch, orgsQuery.refetch, usersQuery.refetch],
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
                onSubmitEditing={() => persistRecentQuery(query)}
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
                  className="rounded-full bg-white/10"
                  style={{
                    width: tokens.layout.touchTarget,
                    height: tokens.layout.touchTarget,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                  hitSlop={8}
                >
                  <Ionicons name="close" size={14} color={tokens.colors.textMuted} />
                </Pressable>
              ) : null}
            </View>
          </GlassSurface>
        </View>

        {showRecentQueries ? (
          <View style={{ marginTop: tokens.spacing.md }}>
            <View className="mb-2 flex-row items-center justify-between">
              <Text className="text-white/65 text-xs font-semibold">Pesquisas recentes</Text>
              <Pressable
                onPress={clearRecentQueries}
                accessibilityRole="button"
                accessibilityLabel="Limpar pesquisas recentes"
                hitSlop={8}
              >
                <Text className="text-white/55 text-xs font-semibold">Limpar</Text>
              </Pressable>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {recentQueries.map((item) => (
                <View
                  key={`recent-${item}`}
                  className="flex-row items-center rounded-full border border-white/12 bg-white/8 pl-3 pr-1"
                  style={{ minHeight: tokens.layout.touchTarget }}
                >
                  <Pressable
                    onPress={() => setQuery(item)}
                    accessibilityRole="button"
                    accessibilityLabel={`Pesquisar ${item}`}
                    className="flex-row items-center"
                    style={{ gap: 6, paddingVertical: 8, maxWidth: 180 }}
                  >
                    <Ionicons name="time-outline" size={13} color="rgba(255,255,255,0.55)" />
                    <Text className="text-white/80 text-xs" numberOfLines={1}>
                      {item}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => removeRecentQuery(item)}
                    accessibilityRole="button"
                    accessibilityLabel={`Remover ${item}`}
                    hitSlop={6}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 14,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Ionicons name="close" size={12} color="rgba(255,255,255,0.5)" />
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          </View>
        ) : null}

        {showQuickSuggestions ? (
          <View style={{ marginTop: tokens.spacing.md }}>
            <Text className="mb-2 text-white/65 text-xs font-semibold">Explorar por tema</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {QUICK_SEARCH_SUGGESTIONS.map((item) => (
                <Pressable
                  key={`quick-${item}`}
                  onPress={() => {
                    setQuery(item);
                    persistRecentQuery(item);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Pesquisar ${item}`}
                  className="rounded-full border border-white/12 bg-white/8 px-3"
                  style={{ minHeight: tokens.layout.touchTarget, justifyContent: "center" }}
                >
                  <Text className="text-white/80 text-xs font-semibold">{item}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}

        {emptyMessage ? (
          <View className="pt-5">
            <GlassSurface intensity={50}>
              <Text className="text-white/70 text-sm">{emptyMessage}</Text>
              {enabled && !hasVisibleLoading && !allVisibleErrored && !hasVisibleResults ? (
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
                onPressIn={() => safePush(router, "/(tabs)/index")}
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
    [
      activeTab,
      allVisibleErrored,
      emptyMessage,
      enabled,
      handleBack,
      hasVisibleLoading,
      hasVisibleResults,
      insets.top,
      query,
      router,
    ],
  );

  const listFooter = useMemo(() => {
    if (!enabled || hasVisibleLoading || !allVisibleErrored) return null;
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
  }, [allVisibleErrored, enabled, hasVisibleLoading, offersQuery, orgsQuery, usersQuery]);

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
