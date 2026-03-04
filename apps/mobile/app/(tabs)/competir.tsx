import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { tokens } from "@orya/shared";
import { LiquidBackground } from "../../components/liquid/LiquidBackground";
import { TopAppHeader } from "../../components/navigation/TopAppHeader";
import { useTopHeaderPadding } from "../../components/navigation/useTopHeaderPadding";
import { useTopBarScroll } from "../../components/navigation/useTopBarScroll";
import { useTabBarPadding } from "../../components/navigation/useTabBarPadding";
import { safePush } from "../../lib/navigation";
import { useIsFocused } from "@react-navigation/native";
import { usePadelDiscover, usePadelRankings, usePadelSummary } from "../../features/tournaments/hooks";
import { TAB_PATHNAMES } from "../../lib/tabRoutes";
import { getMobileEnv } from "../../lib/env";

type CompeteSegment = "torneios" | "rankings" | "jogos";

const formatDateLabel = (value?: string | null) => {
  if (!value) return "Data por definir";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Data por definir";
  return parsed.toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const normalizeImageUrl = (value?: string | null) => {
  if (!value) return null;
  if (/^https?:\/\//i.test(value) || value.startsWith("data:")) return value;
  const base = getMobileEnv().apiBaseUrl.replace(/\/+$/, "");
  return `${base}${value.startsWith("/") ? "" : "/"}${value}`;
};

export default function CompetirScreen() {
  const router = useRouter();
  const isFocused = useIsFocused();
  const [ready, setReady] = useState(false);
  const [segment, setSegment] = useState<CompeteSegment>("torneios");
  const [search, setSearch] = useState("");
  const topPadding = useTopHeaderPadding(16);
  const topBar = useTopBarScroll({ hideOnScroll: false });
  const bottomPadding = useTabBarPadding();

  useEffect(() => {
    setReady(isFocused);
  }, [isFocused]);

  const discoverQuery = usePadelDiscover({ limit: 40 }, ready && segment === "torneios");
  const rankingsQuery = usePadelRankings(
    { scope: "global", limit: 20, periodDays: 30 },
    ready && segment === "rankings",
  );
  const summaryQuery = usePadelSummary(ready);

  const tournaments = useMemo(() => discoverQuery.data?.items ?? [], [discoverQuery.data?.items]);
  const filteredTournaments = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    if (!normalizedSearch) return tournaments;
    return tournaments.filter((item) => {
      const title = String(item.title ?? "").toLowerCase();
      const location = String(item.locationFormattedAddress ?? "").toLowerCase();
      const organization = String(item.organizationName ?? "").toLowerCase();
      return (
        title.includes(normalizedSearch) ||
        location.includes(normalizedSearch) ||
        organization.includes(normalizedSearch)
      );
    });
  }, [search, tournaments]);

  const rankings = useMemo(() => rankingsQuery.data ?? [], [rankingsQuery.data]);
  const onboardingMissing = summaryQuery.data?.onboarding?.completed === false;

  return (
    <LiquidBackground>
      <TopAppHeader
        scrollState={topBar}
        variant="title"
        title="Competir"
        titleAlign="center"
        showNotifications
        showMessages={false}
      />
      <ScrollView
        contentContainerStyle={{
          paddingTop: topPadding,
          paddingBottom: bottomPadding,
          paddingHorizontal: 20,
          gap: 12,
        }}
        onScroll={topBar.onScroll}
        onScrollEndDrag={topBar.onScrollEndDrag}
        onMomentumScrollEnd={topBar.onMomentumScrollEnd}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        {onboardingMissing ? (
          <View className="rounded-2xl border border-amber-300/35 bg-amber-400/10 px-4 py-3">
            <Text className="text-amber-100 text-sm font-semibold">Completa o teu perfil de padel</Text>
            <Text className="mt-1 text-amber-100/85 text-xs">
              Precisas do perfil competitivo completo para entrares em todas as provas.
            </Text>
            <Pressable
              onPress={() => safePush(router, TAB_PATHNAMES.perfil)}
              className="mt-3 self-start rounded-full border border-white/25 bg-white/15 px-3 py-2"
              style={{ minHeight: tokens.layout.touchTarget }}
              accessibilityRole="button"
              accessibilityLabel="Completar perfil"
            >
              <Text className="text-white text-xs font-semibold">Completar perfil</Text>
            </Pressable>
          </View>
        ) : null}

        <View className="flex-row gap-2">
          {([
            ["torneios", "Torneios"],
            ["rankings", "Rankings"],
            ["jogos", "Jogos"],
          ] as Array<[CompeteSegment, string]>).map(([key, label]) => {
            const active = segment === key;
            return (
              <Pressable
                key={key}
                onPress={() => setSegment(key)}
                className="flex-1 rounded-2xl px-3 py-2.5"
                style={{
                  minHeight: tokens.layout.touchTarget,
                  borderWidth: 1,
                  borderColor: active ? "rgba(190,235,255,0.6)" : "rgba(255,255,255,0.18)",
                  backgroundColor: active ? "rgba(120,210,255,0.2)" : "rgba(255,255,255,0.06)",
                }}
                accessibilityRole="button"
                accessibilityLabel={label}
                accessibilityState={{ selected: active }}
              >
                <Text className="text-xs font-semibold text-center" style={{ color: "white" }}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {segment === "torneios" ? (
          <View className="gap-3">
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Procurar torneios, cidade ou clube"
              placeholderTextColor="rgba(255,255,255,0.45)"
              accessibilityLabel="Pesquisar torneios"
              style={{
                color: "#fff",
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.16)",
                backgroundColor: "rgba(255,255,255,0.08)",
                borderRadius: 14,
                minHeight: 44,
                paddingHorizontal: 12,
                paddingVertical: 10,
              }}
            />
            {discoverQuery.isLoading ? (
              <View className="py-6">
                <ActivityIndicator color="rgba(255,255,255,0.9)" />
              </View>
            ) : filteredTournaments.length === 0 ? (
              <View className="rounded-2xl border border-white/14 bg-white/6 px-4 py-4">
                <Text className="text-white/75 text-sm">
                  {search.trim()
                    ? "Sem resultados para esta pesquisa."
                    : "Sem torneios disponíveis neste momento."}
                </Text>
              </View>
            ) : (
              filteredTournaments.map((item) => {
                const canOpen = Boolean(item.slug);
                const cover = normalizeImageUrl(item.coverImageUrl);
                return (
                  <Pressable
                    key={`tournament-${item.id}`}
                    onPress={() => {
                      if (!item.slug) return;
                      safePush(router, { pathname: "/event/[slug]", params: { slug: item.slug } });
                    }}
                    disabled={!canOpen}
                    className="overflow-hidden rounded-2xl border border-white/14 bg-white/6"
                    accessibilityRole="button"
                    accessibilityLabel={item.title ?? "Torneio"}
                    accessibilityState={!canOpen ? { disabled: true } : undefined}
                  >
                    <View style={{ height: 112, backgroundColor: "rgba(255,255,255,0.06)" }}>
                      {cover ? (
                        <Image source={{ uri: cover }} contentFit="cover" style={{ width: "100%", height: "100%" }} />
                      ) : null}
                      <View
                        style={{
                          position: "absolute",
                          left: 0,
                          right: 0,
                          bottom: 0,
                          height: 54,
                          backgroundColor: "rgba(6,10,16,0.55)",
                        }}
                      />
                      <View style={{ position: "absolute", left: 12, right: 12, bottom: 10 }}>
                        <Text className="text-white text-base font-semibold" numberOfLines={1}>
                          {item.title ?? "Torneio"}
                        </Text>
                      </View>
                    </View>

                    <View className="px-4 py-3 gap-1.5">
                      <Text className="text-white/80 text-xs">{formatDateLabel(item.startsAt)}</Text>
                      <Text className="text-white/70 text-xs" numberOfLines={1}>
                        {item.locationFormattedAddress ?? "Localização por definir"}
                      </Text>
                      <View className="flex-row items-center gap-2 mt-1">
                        {item.organizationName ? (
                          <View className="rounded-full border border-white/18 bg-white/8 px-2 py-1">
                            <Text className="text-white/85 text-[10px]">{item.organizationName}</Text>
                          </View>
                        ) : null}
                        {typeof item.priceFrom === "number" ? (
                          <View className="rounded-full border border-cyan-200/35 bg-cyan-300/12 px-2 py-1">
                            <Text className="text-cyan-50 text-[10px] font-semibold">
                              Desde {new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(item.priceFrom / 100)}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                      {!canOpen ? (
                        <Text className="mt-1 text-amber-100/90 text-xs">Detalhe em preparação.</Text>
                      ) : null}
                    </View>
                  </Pressable>
                );
              })
            )}
          </View>
        ) : null}

        {segment === "rankings" ? (
          <View className="gap-2">
            {rankingsQuery.isLoading ? (
              <View className="py-6">
                <ActivityIndicator color="rgba(255,255,255,0.9)" />
              </View>
            ) : rankings.length === 0 ? (
              <View className="rounded-2xl border border-white/14 bg-white/6 px-4 py-4">
                <Text className="text-white/75 text-sm">Sem rankings disponíveis neste momento.</Text>
              </View>
            ) : (
              rankings.map((row) => (
                <View
                  key={`ranking-${row.player.id}-${row.position}`}
                  className="flex-row items-center justify-between rounded-2xl border border-white/12 bg-white/6 px-4 py-3"
                >
                  <View>
                    <Text className="text-white text-sm font-semibold">
                      #{row.position} {row.player.fullName ?? "Jogador"}
                    </Text>
                    <Text className="mt-0.5 text-white/65 text-xs">Nível: {row.player.level ?? "-"}</Text>
                  </View>
                  <Text className="text-cyan-100 text-sm font-semibold">{row.points} pts</Text>
                </View>
              ))
            )}
          </View>
        ) : null}

        {segment === "jogos" ? (
          <View className="rounded-2xl border border-white/14 bg-white/6 px-4 py-4">
            <Text className="text-white text-sm font-semibold">Jogos abertos</Text>
            <Text className="mt-2 text-white/75 text-sm">
              Estamos a finalizar o matchmaking para jogos abertos. Em breve ficará disponível.
            </Text>
            <Pressable
              onPress={() => safePush(router, TAB_PATHNAMES.comunidade)}
              className="mt-3 self-start rounded-full border border-white/20 bg-white/10 px-3 py-2"
              style={{ minHeight: tokens.layout.touchTarget }}
              accessibilityRole="button"
              accessibilityLabel="Abrir comunidade"
            >
              <Text className="text-white text-xs font-semibold">Abrir comunidade</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </LiquidBackground>
  );
}
