import { useEffect, useMemo, useState } from "react";
import { LayoutAnimation, Platform, Pressable, ScrollView, Text, TextInput, UIManager, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
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

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function SearchScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ q?: string }>();
  const initialQuery = typeof params.q === "string" ? params.q : "";
  const [query, setQuery] = useState(initialQuery);
  const debounced = useDebouncedValue(query, 280);

  const { offers, users, organizations, hasResults, isLoading, isError } = useGlobalSearch(debounced);
  const showSkeleton = isLoading && debounced.trim().length > 0;

  useEffect(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  }, [offers.length, users.length, organizations.length]);

  const emptyMessage = useMemo(() => {
    if (!debounced) return "Escreve algo para pesquisar ofertas, pessoas ou clubes.";
    if (!isLoading && !isError && !hasResults) return "Sem resultados para esta pesquisa.";
    return null;
  }, [debounced, hasResults, isError, isLoading]);

  return (
    <LiquidBackground>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
        <View className="pt-14 pb-5 flex-row items-center justify-between">
          <Pressable
            onPress={() => router.back()}
            className="rounded-full border border-white/10 px-3 py-2"
            style={{ minHeight: tokens.layout.touchTarget }}
          >
            <Ionicons name="chevron-back" size={18} color={tokens.colors.text} />
          </Pressable>
          <Text className="text-white text-lg font-semibold">Pesquisa</Text>
          <View style={{ width: tokens.layout.touchTarget }} />
        </View>

        <GlassSurface intensity={68} padding={12} style={{ marginBottom: tokens.spacing.lg }}>
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

        {emptyMessage ? (
          <GlassSurface intensity={50}>
            <Text className="text-white/70 text-sm">{emptyMessage}</Text>
          </GlassSurface>
        ) : null}

        {showSkeleton ? (
          <View className="pt-6">
            <SectionHeader title="Ofertas" subtitle="A carregar resultados" />
            <View className="mt-3">
              {Array.from({ length: 2 }).map((_, index) => (
                <GlassSkeleton key={`search-offer-${index}`} className="mb-4" height={150} />
              ))}
            </View>
            <SectionHeader title="Pessoas" subtitle="A carregar utilizadores" />
            <View className="mt-3">
              {Array.from({ length: 2 }).map((_, index) => (
                <GlassSkeleton key={`search-user-${index}`} className="mb-3" height={72} />
              ))}
            </View>
            <SectionHeader title="Organizações" subtitle="A carregar clubes" />
            <View className="mt-3">
              {Array.from({ length: 2 }).map((_, index) => (
                <GlassSkeleton key={`search-org-${index}`} className="mb-3" height={72} />
              ))}
            </View>
          </View>
        ) : null}

        {!showSkeleton && offers.length > 0 ? (
          <View className="pt-6">
            <SectionHeader title="Ofertas" subtitle="Eventos, servicos e experiencias" />
            <View className="mt-3">
              {offers.map((item, index) =>
                item.type === "event" ? (
                  <DiscoverEventCard key={item.key} item={item.event} itemType="event" index={index} />
                ) : (
                  <DiscoverEventCard key={item.key} item={item.service} itemType="service" index={index} />
                ),
              )}
            </View>
          </View>
        ) : null}

        {!showSkeleton && users.length > 0 ? (
          <View className="pt-6">
            <SectionHeader title="Pessoas" subtitle="Utilizadores e perfis" />
            <View className="mt-3">
              {users.map((item) => (
                <SearchUserRow key={`user-${item.id}`} item={item} />
              ))}
            </View>
          </View>
        ) : null}

        {!showSkeleton && organizations.length > 0 ? (
          <View className="pt-6">
            <SectionHeader title="Organizacoes" subtitle="Clubes e marcas" />
            <View className="mt-3">
              {organizations.map((item) => (
                <SearchOrganizationRow key={`org-${item.id}`} item={item} />
              ))}
            </View>
          </View>
        ) : null}

        {isError ? (
          <View className="pt-6">
            <GlassSurface intensity={45}>
              <Text className="text-red-300 text-sm">Nao foi possivel carregar os resultados.</Text>
            </GlassSurface>
          </View>
        ) : null}
      </ScrollView>
    </LiquidBackground>
  );
}
