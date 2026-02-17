import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "../../components/icons/Ionicons";
import { LiquidBackground } from "../../components/liquid/LiquidBackground";
import { TopAppHeader } from "../../components/navigation/TopAppHeader";
import { GlassCard } from "../../components/liquid/GlassCard";
import { GlassSkeleton } from "../../components/glass/GlassSkeleton";
import { SectionHeader } from "../../components/liquid/SectionHeader";
import {
  usePadelDiscover,
  usePadelMyMatches,
  usePadelRankings,
  usePadelSummary,
} from "../../features/tournaments/hooks";
import { formatCurrency, formatDate } from "../../lib/formatters";
import { tokens, useTranslation } from "@orya/shared";
import { safeBack } from "../../lib/navigation";
import { resolveMediaUri } from "../../lib/media";
import { useNavigation } from "@react-navigation/native";
import { useTabBarPadding } from "../../components/navigation/useTabBarPadding";
import * as Haptics from "expo-haptics";

type QuickActionItem = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
};

const formatTournamentDate = (
  startsAt?: string | null,
  endsAt?: string | null,
) => {
  if (!startsAt) return null;
  try {
    const start = formatDate(startsAt, { day: "2-digit", month: "short" });
    if (!endsAt) return start;
    const end = formatDate(endsAt, { day: "2-digit", month: "short" });
    return start === end ? start : `${start}–${end}`;
  } catch {
    return null;
  }
};

const formatStatusLabel = (value: string | null | undefined) => {
  const normalized = value?.trim();
  if (!normalized) return null;
  return normalized.replace(/_/g, " ");
};

type FeaturedTournamentMediaProps = {
  coverUri: string | null;
  children: ReactNode;
};

function FeaturedTournamentMedia({ coverUri, children }: FeaturedTournamentMediaProps) {
  const [coverFailed, setCoverFailed] = useState(false);
  const hasCover = Boolean(coverUri) && !coverFailed;

  useEffect(() => {
    setCoverFailed(false);
  }, [coverUri]);

  return (
    <View style={styles.featuredMedia}>
      {hasCover ? (
        <Image
          source={{ uri: coverUri as string }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={180}
          cachePolicy="memory-disk"
          onError={() => setCoverFailed(true)}
        />
      ) : (
        <View style={styles.featuredFallback}>
          <Ionicons
            name="trophy-outline"
            size={20}
            color="rgba(255,255,255,0.86)"
          />
        </View>
      )}
      <LinearGradient
        colors={["rgba(6,10,20,0.1)", "rgba(6,10,20,0.76)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {children}
    </View>
  );
}

export default function PadelHubScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const tabBarPadding = useTabBarPadding();
  const { t } = useTranslation();
  const summaryQuery = usePadelSummary();
  const matchesQuery = usePadelMyMatches(
    { scope: "upcoming", limit: 3 },
    Boolean(summaryQuery.data),
  );
  const discoverQuery = usePadelDiscover({ date: "upcoming", limit: 6 }, true);
  const rankingsQuery = usePadelRankings({ scope: "global", limit: 5 }, true);

  const profile = summaryQuery.data?.profile ?? null;
  const stats = summaryQuery.data?.stats ?? null;
  const pairings = summaryQuery.data?.pairings ?? [];
  const waitlist = summaryQuery.data?.waitlist ?? [];
  const upcomingMatches = matchesQuery.data ?? [];
  const rankings = rankingsQuery.data ?? [];
  const featuredEvents = (discoverQuery.data?.items ?? []).slice(0, 6);
  const loading = summaryQuery.isLoading;
  const error =
    summaryQuery.isError ||
    matchesQuery.isError ||
    discoverQuery.isError ||
    rankingsQuery.isError;
  const empty =
    !loading &&
    !error &&
    pairings.length === 0 &&
    waitlist.length === 0 &&
    upcomingMatches.length === 0 &&
    featuredEvents.length === 0 &&
    rankings.length === 0;

  const hasPadelOnboarding = summaryQuery.data?.onboarding?.completed ?? false;
  const retryAllQueries = () => {
    void Promise.allSettled([
      summaryQuery.refetch(),
      matchesQuery.refetch(),
      discoverQuery.refetch(),
      rankingsQuery.refetch(),
    ]);
  };

  const quickActions = useMemo<QuickActionItem[]>(
    () => [
      {
        label: t("events:padel.hub.actionTournaments"),
        icon: "trophy",
        onPress: () =>
          router.push({ pathname: "/search", params: { tab: "padel" } }),
      },
      {
        label: t("events:padel.hub.actionReserveCourt"),
        icon: "tennisball",
        onPress: () =>
          router.push({
            pathname: "/search",
            params: { tab: "services", kind: "court" },
          }),
      },
      {
        label: t("events:padel.hub.actionBookClass"),
        icon: "school",
        onPress: () =>
          router.push({
            pathname: "/search",
            params: { tab: "services", kind: "class" },
          }),
      },
    ],
    [router, t],
  );
  const revealOpacity = useRef(new Animated.Value(0)).current;
  const revealTranslate = useRef(new Animated.Value(14)).current;

  useEffect(() => {
    if (loading) return;
    Animated.parallel([
      Animated.timing(revealOpacity, {
        toValue: 1,
        duration: tokens.motion.normal,
        useNativeDriver: true,
      }),
      Animated.timing(revealTranslate, {
        toValue: 0,
        duration: tokens.motion.normal + 60,
        useNativeDriver: true,
      }),
    ]).start();
  }, [loading, revealOpacity, revealTranslate]);

  const triggerLightHaptic = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
      () => undefined,
    );
  }, []);

  const handleActionPress = useCallback(
    (action: () => void) => {
      triggerLightHaptic();
      action();
    },
    [triggerLightHaptic],
  );

  return (
    <View style={{ flex: 1 }}>
      <LiquidBackground variant="deep">
        <TopAppHeader
          variant="title"
          title={t("events:padel.hub.title")}
          leftSlot={
            <Pressable
              onPress={() =>
                handleActionPress(() =>
                  safeBack(router, navigation, "/(tabs)/index"),
                )
              }
              accessibilityRole="button"
              accessibilityLabel={t("common:actions.back")}
              style={({ pressed }) => [
                {
                  width: tokens.layout.touchTarget,
                  height: tokens.layout.touchTarget,
                  minHeight: tokens.layout.touchTarget,
                  alignItems: "center",
                  justifyContent: "center",
                },
                pressed
                  ? { opacity: 0.85, transform: [{ scale: 0.96 }] }
                  : null,
              ]}
            >
              <Ionicons
                name="chevron-back"
                size={22}
                color="rgba(255,255,255,0.9)"
              />
            </Pressable>
          }
          showNotifications={false}
          showMessages={false}
        />
        <ScrollView
          contentContainerStyle={{
            paddingTop: insets.top + 12,
            paddingBottom: Math.max(tabBarPadding, insets.bottom + 24),
            paddingHorizontal: 20,
            gap: 16,
          }}
        >
          {loading ? (
            <View className="gap-3">
              <GlassSkeleton height={156} />
              <GlassSkeleton height={86} />
              {Array.from({ length: 5 }, (_, idx) => (
                <GlassSkeleton key={`padel-loading-${idx}`} height={88} />
              ))}
            </View>
          ) : null}

          {!loading && error ? (
            <GlassCard intensity={55}>
              <View className="gap-3">
                <View className="flex-row items-center gap-2">
                  <View className="h-8 w-8 items-center justify-center rounded-full border border-red-300/35 bg-red-300/10">
                    <Ionicons
                      name="warning-outline"
                      size={15}
                      color="rgba(252,165,165,0.92)"
                    />
                  </View>
                  <Text className="text-red-300 text-sm font-semibold">
                    Erro ao carregar o hub de padel.
                  </Text>
                </View>
                <Pressable
                  onPress={() => handleActionPress(retryAllQueries)}
                  className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3"
                  style={({ pressed }) => [
                    {
                      minHeight: tokens.layout.touchTarget,
                      alignItems: "center",
                      justifyContent: "center",
                    },
                    pressed
                      ? { opacity: 0.88, transform: [{ scale: 0.985 }] }
                      : null,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={t("common:actions.retry")}
                >
                  <Text className="text-white text-sm font-semibold">
                    {t("common:actions.retry")}
                  </Text>
                </Pressable>
              </View>
            </GlassCard>
          ) : null}

          {!loading && !error && empty ? (
            <GlassCard intensity={52}>
              <View className="gap-3">
                <View className="flex-row items-center gap-2">
                  <View className="h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-white/8">
                    <Ionicons
                      name="sparkles-outline"
                      size={14}
                      color="rgba(255,255,255,0.86)"
                    />
                  </View>
                  <Text className="text-white text-sm font-semibold">
                    Sem atividade de padel disponível.
                  </Text>
                </View>
                <Text className="text-white/65 text-xs">
                  Explora torneios, reservas e aulas para veres resultados aqui.
                </Text>
                <Pressable
                  onPress={() =>
                    handleActionPress(() =>
                      router.push({
                        pathname: "/search",
                        params: { tab: "padel" },
                      }),
                    )
                  }
                  className="self-start rounded-full border border-white/15 bg-white/8 px-4 py-2"
                  style={({ pressed }) => [
                    { minHeight: tokens.layout.touchTarget },
                    pressed
                      ? { opacity: 0.88, transform: [{ scale: 0.985 }] }
                      : null,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={t("common:actions.explore")}
                >
                  <View className="flex-row items-center gap-2">
                    <Ionicons
                      name="compass-outline"
                      size={14}
                      color="rgba(255,255,255,0.86)"
                    />
                    <Text className="text-white text-xs font-semibold">
                      {t("common:actions.explore")}
                    </Text>
                  </View>
                </Pressable>
              </View>
            </GlassCard>
          ) : null}

          {!loading && !error ? (
            <Animated.View
              style={{
                opacity: revealOpacity,
                transform: [{ translateY: revealTranslate }],
                gap: 16,
              }}
            >
              <SectionHeader
                title={t("events:padel.hub.profileTitle")}
                subtitle={t("events:padel.hub.profileSubtitle")}
              />
              <GlassCard intensity={66} highlight>
                <View className="gap-4">
                  <View className="flex-row items-start justify-between gap-3">
                    <View className="flex-1 gap-1">
                      <Text className="text-white text-base font-semibold">
                        {profile?.fullName ||
                          t("events:padel.hub.playerFallback")}
                      </Text>
                      <Text className="text-white/75 text-sm">
                        {profile?.padelLevel
                          ? t("events:padel.hub.levelLabel", {
                              level: profile.padelLevel,
                            })
                          : t("events:padel.hub.levelFallback")}
                      </Text>
                      <Text className="text-white/65 text-xs">
                        {profile?.padelPreferredSide
                          ? t("events:padel.hub.sideLabel", {
                              side: profile.padelPreferredSide,
                            })
                          : t("events:padel.hub.sideFallback")}
                      </Text>
                      {profile?.padelClubName ? (
                        <Text className="text-white/60 text-xs">
                          {t("events:padel.hub.clubLabel", {
                            club: profile.padelClubName,
                          })}
                        </Text>
                      ) : null}
                    </View>
                    <View className="h-12 w-12 items-center justify-center rounded-2xl border border-white/20 bg-white/10">
                      <Ionicons
                        name="tennisball-outline"
                        size={22}
                        color="rgba(255,255,255,0.9)"
                      />
                    </View>
                  </View>
                  {stats ? (
                    <View className="flex-row gap-2">
                      <View className="flex-1 rounded-2xl border border-white/12 bg-white/7 px-3 py-3">
                        <Text className="text-white/60 text-[11px] uppercase tracking-[0.08em]">
                          Torneios
                        </Text>
                        <Text className="text-white text-base font-semibold">
                          {stats.tournaments}
                        </Text>
                      </View>
                      <View className="flex-1 rounded-2xl border border-white/12 bg-white/7 px-3 py-3">
                        <Text className="text-white/60 text-[11px] uppercase tracking-[0.08em]">
                          Vitórias
                        </Text>
                        <Text className="text-white text-base font-semibold">
                          {stats.wins}
                        </Text>
                      </View>
                      <View className="flex-1 rounded-2xl border border-white/12 bg-white/7 px-3 py-3">
                        <Text className="text-white/60 text-[11px] uppercase tracking-[0.08em]">
                          Derrotas
                        </Text>
                        <Text className="text-white text-base font-semibold">
                          {stats.losses}
                        </Text>
                      </View>
                    </View>
                  ) : null}
                  {!hasPadelOnboarding ? (
                    <Pressable
                      onPress={() =>
                        handleActionPress(() =>
                          router.push({
                            pathname: "/onboarding",
                            params: { step: "padel" },
                          }),
                        )
                      }
                      className="rounded-xl border border-white/20 bg-white/12 px-4 py-3"
                      style={({ pressed }) => [
                        {
                          minHeight: tokens.layout.touchTarget,
                          alignItems: "center",
                          justifyContent: "center",
                        },
                        pressed
                          ? { opacity: 0.88, transform: [{ scale: 0.985 }] }
                          : null,
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={t("events:padel.hub.completeProfile")}
                    >
                      <Text className="text-white text-sm font-semibold text-center">
                        {t("events:padel.hub.completeProfile")}
                      </Text>
                    </Pressable>
                  ) : (
                    <View className="self-start rounded-full border border-emerald-200/35 bg-emerald-200/10 px-3 py-2">
                      <Text className="text-emerald-100 text-xs font-semibold">
                        Perfil completo
                      </Text>
                    </View>
                  )}
                </View>
              </GlassCard>

              <SectionHeader
                title={t("events:padel.hub.quickActionsTitle")}
                subtitle={t("events:padel.hub.quickActionsSubtitle")}
              />
              <View className="gap-3">
                {quickActions.map((action) => (
                  <Pressable
                    key={action.label}
                    onPress={() => handleActionPress(action.onPress)}
                    className="rounded-2xl border border-white/12 bg-white/8 px-4 py-4"
                    style={({ pressed }) => [
                      {
                        minHeight: tokens.layout.touchTarget,
                        justifyContent: "center",
                      },
                      pressed
                        ? { opacity: 0.9, transform: [{ scale: 0.985 }] }
                        : null,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={action.label}
                  >
                    <View className="flex-row items-center justify-between gap-3">
                      <View className="flex-row items-center gap-3 flex-1">
                        <View className="h-9 w-9 items-center justify-center rounded-xl border border-white/18 bg-white/10">
                          <Ionicons
                            name={action.icon}
                            size={16}
                            color="rgba(255,255,255,0.9)"
                          />
                        </View>
                        <Text className="text-white text-sm font-semibold flex-1">
                          {action.label}
                        </Text>
                      </View>
                      <Ionicons
                        name="chevron-forward"
                        size={16}
                        color="rgba(255,255,255,0.55)"
                      />
                    </View>
                  </Pressable>
                ))}
              </View>

              <SectionHeader
                title={t("events:padel.hub.registrationsTitle")}
                subtitle={t("events:padel.hub.registrationsSubtitle")}
              />
              <GlassCard intensity={54}>
                <View className="gap-2">
                  {pairings.length === 0 ? (
                    <Text className="text-white/60 text-sm">
                      {t("events:padel.hub.registrationsEmpty")}
                    </Text>
                  ) : (
                    pairings.slice(0, 4).map((pairing: any) => (
                      <Pressable
                        key={pairing.id}
                        onPress={() =>
                          handleActionPress(() => {
                            if (!pairing?.event?.slug) return;
                            router.push({
                              pathname: "/event/[slug]",
                              params: { slug: pairing.event.slug },
                            });
                          })
                        }
                        className="rounded-xl border border-white/12 bg-white/7 px-3 py-3"
                        style={({ pressed }) => [
                          {
                            minHeight: tokens.layout.touchTarget,
                            justifyContent: "center",
                          },
                          pressed
                            ? { opacity: 0.9, transform: [{ scale: 0.985 }] }
                            : null,
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={
                          pairing?.event?.title ??
                          t("events:padel.registrationTitle")
                        }
                      >
                        <View className="flex-row items-start justify-between gap-2">
                          <View className="flex-1 gap-1">
                            <Text className="text-white text-sm font-semibold">
                              {pairing?.event?.title ??
                                t("events:padel.tournamentFallback")}
                            </Text>
                            <Text className="text-white/60 text-xs">
                              {pairing?.category?.label ??
                                t("events:padel.categoryLabel", { label: "" })}
                              {" · "}
                              {formatStatusLabel(pairing?.lifecycleStatus) ??
                                t("events:padel.hub.statusPending")}
                            </Text>
                          </View>
                          <Ionicons
                            name="chevron-forward"
                            size={14}
                            color="rgba(255,255,255,0.45)"
                          />
                        </View>
                      </Pressable>
                    ))
                  )}
                </View>
              </GlassCard>

              {waitlist.length > 0 ? (
                <>
                  <SectionHeader
                    title={t("events:padel.hub.waitlistTitle")}
                    subtitle={t("events:padel.hub.waitlistSubtitle")}
                  />
                  <GlassCard intensity={52}>
                    <View className="gap-2">
                      {waitlist.slice(0, 3).map((entry: any) => (
                        <View
                          key={entry.id}
                          className="rounded-xl border border-white/10 bg-white/5 px-3 py-3"
                        >
                          <Text className="text-white text-sm font-semibold">
                            {entry?.event?.title ??
                              t("events:padel.tournamentFallback")}
                          </Text>
                          <Text className="text-white/60 text-xs">
                            {entry?.category?.label ??
                              t("events:padel.categoryLabel", { label: "" })}
                            {" · "}
                            {formatStatusLabel(entry?.status) ??
                              t("events:padel.hub.statusPending")}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </GlassCard>
                </>
              ) : null}

              <SectionHeader
                title={t("events:padel.hub.matchesTitle")}
                subtitle={t("events:padel.hub.matchesSubtitle")}
              />
              <GlassCard intensity={54}>
                <View className="gap-2">
                  {upcomingMatches.length === 0 ? (
                    <Text className="text-white/60 text-sm">
                      {t("events:padel.hub.matchesEmpty")}
                    </Text>
                  ) : (
                    upcomingMatches.map((match: any) => (
                      <Pressable
                        key={match.id}
                        onPress={() =>
                          handleActionPress(() => {
                            if (!match?.event?.slug) return;
                            router.push({
                              pathname: "/event/[slug]",
                              params: { slug: match.event.slug },
                            });
                          })
                        }
                        className="rounded-xl border border-white/12 bg-white/7 px-3 py-3"
                        style={({ pressed }) => [
                          {
                            minHeight: tokens.layout.touchTarget,
                            justifyContent: "center",
                          },
                          pressed
                            ? { opacity: 0.9, transform: [{ scale: 0.985 }] }
                            : null,
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={
                          match?.event?.title ?? t("events:padel.matchLabel")
                        }
                      >
                        <View className="flex-row items-start justify-between gap-2">
                          <View className="flex-1 gap-1">
                            <Text className="text-white text-sm font-semibold">
                              {match?.event?.title ??
                                t("events:padel.hub.matchFallback")}
                            </Text>
                            <Text className="text-white/60 text-xs">
                              {formatTournamentDate(
                                match?.startTime ??
                                  match?.plannedStartAt ??
                                  null,
                                null,
                              ) ?? t("events:padel.hub.timePending")}
                            </Text>
                          </View>
                          <Ionicons
                            name="chevron-forward"
                            size={14}
                            color="rgba(255,255,255,0.45)"
                          />
                        </View>
                      </Pressable>
                    ))
                  )}
                </View>
              </GlassCard>

              <SectionHeader
                title={t("events:padel.hub.featuredTitle")}
                subtitle={t("events:padel.hub.featuredSubtitle")}
              />
              <View className="gap-3">
                {featuredEvents.length === 0 ? (
                  <GlassCard intensity={50}>
                    <Text className="text-white/60 text-sm">
                      Sem torneios em destaque de momento.
                    </Text>
                  </GlassCard>
                ) : (
                  featuredEvents.map((event, index) => {
                    const dateLabel = formatTournamentDate(
                      event.startsAt ?? null,
                      event.endsAt ?? null,
                    );
                    const priceLabel =
                      typeof event.priceFrom === "number"
                        ? formatCurrency(event.priceFrom, "EUR")
                        : t("events:padel.hub.pricePending");
                    const coverUri = resolveMediaUri(event.coverImageUrl ?? null);
                    const formatLabel = formatStatusLabel(event.format);
                    const stateLabel = formatStatusLabel(event.competitionState);
                    const metadata = [dateLabel ?? t("events:padel.hub.datePending"), priceLabel]
                      .filter(Boolean)
                      .join(" · ");
                    return (
                      <Pressable
                        key={event.id}
                        onPress={() =>
                          handleActionPress(() => {
                            if (!event.slug) return;
                            router.push({
                              pathname: "/event/[slug]",
                              params: { slug: event.slug },
                            });
                          })
                        }
                        className={`rounded-2xl border px-4 py-4 ${
                          index === 0
                            ? "border-white/20 bg-white/12"
                            : "border-white/12 bg-white/7"
                        }`}
                        style={({ pressed }) => [
                          {
                            minHeight: tokens.layout.touchTarget,
                            justifyContent: "center",
                          },
                          pressed
                            ? { opacity: 0.9, transform: [{ scale: 0.985 }] }
                            : null,
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={
                          event.title ?? t("events:padel.tournamentFallback")
                        }
                      >
                        <FeaturedTournamentMedia coverUri={coverUri}>
                          <View style={styles.featuredTag}>
                            <Text style={styles.featuredTagText}>TORNEIO</Text>
                          </View>
                          <View style={styles.featuredOverlay}>
                            <View className="flex-row items-center justify-between gap-2">
                              <Text className="text-white text-base font-semibold flex-1" numberOfLines={2}>
                                {event.title ?? t("events:padel.tournamentFallback")}
                              </Text>
                              <Ionicons
                                name="chevron-forward"
                                size={14}
                                color="rgba(255,255,255,0.62)"
                              />
                            </View>
                            <Text className="text-white/75 text-xs" numberOfLines={1}>
                              {metadata}
                            </Text>
                            {formatLabel || stateLabel ? (
                              <View style={styles.featuredMetaPills}>
                                {formatLabel ? (
                                  <View style={styles.featuredMetaPill}>
                                    <Text style={styles.featuredMetaPillText} numberOfLines={1}>
                                      {formatLabel}
                                    </Text>
                                  </View>
                                ) : null}
                                {stateLabel ? (
                                  <View style={styles.featuredMetaPill}>
                                    <Text style={styles.featuredMetaPillText} numberOfLines={1}>
                                      {stateLabel}
                                    </Text>
                                  </View>
                                ) : null}
                              </View>
                            ) : null}
                          </View>
                        </FeaturedTournamentMedia>
                      </Pressable>
                    );
                  })
                )}
              </View>

              <SectionHeader
                title={t("events:padel.hub.rankingsTitle")}
                subtitle={t("events:padel.hub.rankingsSubtitle")}
              />
              <GlassCard intensity={54}>
                <View className="gap-2">
                  {rankings.length === 0 ? (
                    <Text className="text-white/60 text-sm">
                      {t("events:padel.hub.rankingsEmpty")}
                    </Text>
                  ) : (
                    rankings.map((row) => (
                      <View
                        key={`${row.position}-${row.player.id}`}
                        className="flex-row items-center justify-between rounded-xl border border-white/12 bg-white/7 px-3 py-3"
                        style={{ minHeight: tokens.layout.touchTarget }}
                      >
                        <View className="flex-row items-center gap-2 flex-1 pr-2">
                          <View className="h-7 w-7 items-center justify-center rounded-full border border-white/15 bg-white/10">
                            <Text className="text-white text-[11px] font-semibold">
                              {row.position}
                            </Text>
                          </View>
                          <Text className="text-white text-sm font-semibold flex-1">
                            {row.player.fullName ??
                              t("events:padel.hub.playerFallback")}
                          </Text>
                        </View>
                        <Text className="text-white/65 text-xs">
                          {t("events:padel.hub.pointsShort", {
                            count: row.points,
                          })}
                        </Text>
                      </View>
                    ))
                  )}
                </View>
              </GlassCard>
            </Animated.View>
          ) : null}
        </ScrollView>
      </LiquidBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  featuredMedia: {
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    minHeight: 124,
    justifyContent: "flex-end",
  },
  featuredFallback: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  featuredTag: {
    position: "absolute",
    top: 10,
    left: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
    backgroundColor: "rgba(8,12,20,0.64)",
  },
  featuredTagText: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 10,
    fontWeight: "700",
  },
  featuredOverlay: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  featuredMetaPills: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 2,
  },
  featuredMetaPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    backgroundColor: "rgba(8,12,20,0.5)",
  },
  featuredMetaPillText: {
    color: "rgba(255,255,255,0.86)",
    fontSize: 10,
    fontWeight: "600",
  },
});
