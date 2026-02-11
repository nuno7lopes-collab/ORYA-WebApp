import { useMemo } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "../../components/icons/Ionicons";
import { LiquidBackground } from "../../components/liquid/LiquidBackground";
import { TopAppHeader } from "../../components/navigation/TopAppHeader";
import { GlassCard } from "../../components/liquid/GlassCard";
import { SectionHeader } from "../../components/liquid/SectionHeader";
import { usePadelDiscover, usePadelMyMatches, usePadelRankings, usePadelSummary } from "../../features/tournaments/hooks";
import { formatCurrency, formatDate } from "../../lib/formatters";
import { useTranslation } from "@orya/shared";
import { safeBack } from "../../lib/navigation";
import { useNavigation } from "@react-navigation/native";
import { useTabBarPadding } from "../../components/navigation/useTabBarPadding";

const formatTournamentDate = (startsAt?: string | null, endsAt?: string | null) => {
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

export default function PadelHubScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const tabBarPadding = useTabBarPadding();
  const { t } = useTranslation();
  const summaryQuery = usePadelSummary();
  const matchesQuery = usePadelMyMatches({ scope: "upcoming", limit: 3 }, Boolean(summaryQuery.data));
  const discoverQuery = usePadelDiscover({ date: "upcoming", limit: 6 }, true);
  const rankingsQuery = usePadelRankings({ scope: "global", limit: 5 }, true);

  const profile = summaryQuery.data?.profile ?? null;
  const stats = summaryQuery.data?.stats ?? null;
  const pairings = summaryQuery.data?.pairings ?? [];
  const waitlist = summaryQuery.data?.waitlist ?? [];
  const upcomingMatches = matchesQuery.data ?? [];
  const rankings = rankingsQuery.data ?? [];

  const hasPadelOnboarding = summaryQuery.data?.onboarding?.completed ?? false;

  const quickActions = useMemo(
    () => [
      {
        label: t("events:padel.hub.actionTournaments"),
        icon: "trophy",
        onPress: () => router.push({ pathname: "/search", params: { tab: "padel" } }),
      },
      {
        label: t("events:padel.hub.actionReserveCourt"),
        icon: "tennisball",
        onPress: () => router.push({ pathname: "/search", params: { tab: "services", kind: "court" } }),
      },
      {
        label: t("events:padel.hub.actionBookClass"),
        icon: "school",
        onPress: () => router.push({ pathname: "/search", params: { tab: "services", kind: "class" } }),
      },
    ],
    [router, t],
  );

  return (
    <View style={{ flex: 1 }}>
      <LiquidBackground variant="deep">
        <TopAppHeader
          variant="title"
          title={t("events:padel.hub.title")}
          leftSlot={
            <Pressable
              onPress={() => safeBack(router, navigation, "/(tabs)/index")}
              accessibilityRole="button"
              accessibilityLabel={t("common:actions.back")}
              hitSlop={10}
              style={{ paddingRight: 12 }}
            >
              <Ionicons name="chevron-back" size={22} color="rgba(255,255,255,0.9)" />
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
          <SectionHeader
            title={t("events:padel.hub.profileTitle")}
            subtitle={t("events:padel.hub.profileSubtitle")}
          />
          <GlassCard intensity={60}>
            <View className="gap-2">
              <Text className="text-white text-base font-semibold">
                {profile?.fullName || t("events:padel.hub.playerFallback")}
              </Text>
              <Text className="text-white/70 text-sm">
                {profile?.padelLevel
                  ? t("events:padel.hub.levelLabel", { level: profile.padelLevel })
                  : t("events:padel.hub.levelFallback")}
              </Text>
              <Text className="text-white/60 text-xs">
                {profile?.padelPreferredSide
                  ? t("events:padel.hub.sideLabel", { side: profile.padelPreferredSide })
                  : t("events:padel.hub.sideFallback")}
              </Text>
              {profile?.padelClubName ? (
                <Text className="text-white/60 text-xs">
                  {t("events:padel.hub.clubLabel", { club: profile.padelClubName })}
                </Text>
              ) : null}
              {!hasPadelOnboarding ? (
                <Pressable
                  onPress={() => router.push({ pathname: "/onboarding", params: { step: "padel" } })}
                  className="mt-3 rounded-xl border border-white/15 bg-white/5 px-4 py-3"
                  accessibilityRole="button"
                  accessibilityLabel={t("events:padel.hub.completeProfile")}
                >
                  <Text className="text-white text-sm font-semibold text-center">
                    {t("events:padel.hub.completeProfile")}
                  </Text>
                </Pressable>
              ) : null}
              {stats ? (
                <View className="flex-row flex-wrap gap-3 pt-2">
                  <View className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                    <Text className="text-white text-xs font-semibold">
                      {t("events:padel.hub.tournamentsCount", { count: stats.tournaments })}
                    </Text>
                  </View>
                  <View className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                    <Text className="text-white text-xs font-semibold">
                      {t("events:padel.hub.winsCount", { count: stats.wins })}
                    </Text>
                  </View>
                  <View className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                    <Text className="text-white text-xs font-semibold">
                      {t("events:padel.hub.lossesCount", { count: stats.losses })}
                    </Text>
                  </View>
                </View>
              ) : null}
            </View>
          </GlassCard>

          <SectionHeader
            title={t("events:padel.hub.quickActionsTitle")}
            subtitle={t("events:padel.hub.quickActionsSubtitle")}
          />
          <View className="flex-row flex-wrap gap-3">
            {quickActions.map((action) => (
              <Pressable
                key={action.label}
                onPress={action.onPress}
                className="flex-1 min-w-[120px] rounded-2xl border border-white/12 bg-white/6 px-4 py-3"
                accessibilityRole="button"
                accessibilityLabel={action.label}
              >
                <View className="flex-row items-center gap-2">
                  <Ionicons name={action.icon as any} size={16} color="rgba(255,255,255,0.9)" />
                  <Text className="text-white text-sm font-semibold">{action.label}</Text>
                </View>
              </Pressable>
            ))}
          </View>

          <SectionHeader
            title={t("events:padel.hub.registrationsTitle")}
            subtitle={t("events:padel.hub.registrationsSubtitle")}
          />
          <GlassCard intensity={52}>
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
                      pairing?.event?.slug
                        ? router.push({ pathname: "/event/[slug]", params: { slug: pairing.event.slug } })
                        : null
                    }
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-3"
                    accessibilityRole="button"
                    accessibilityLabel={pairing?.event?.title ?? t("events:padel.registrationTitle")}
                  >
                    <Text className="text-white text-sm font-semibold">
                      {pairing?.event?.title ?? t("events:padel.tournamentFallback")}
                    </Text>
                    <Text className="text-white/60 text-xs">
                      {pairing?.category?.label ?? t("events:padel.categoryLabel", { label: "" })}
                      {" · "}
                      {pairing?.lifecycleStatus ?? t("events:padel.hub.statusPending")}
                    </Text>
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
                        {entry?.event?.title ?? t("events:padel.tournamentFallback")}
                      </Text>
                      <Text className="text-white/60 text-xs">
                        {entry?.category?.label ?? t("events:padel.categoryLabel", { label: "" })}
                        {" · "}
                        {entry?.status ?? t("events:padel.hub.statusPending")}
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
          <GlassCard intensity={52}>
            <View className="gap-2">
              {upcomingMatches.length === 0 ? (
                <Text className="text-white/60 text-sm">{t("events:padel.hub.matchesEmpty")}</Text>
              ) : (
                upcomingMatches.map((match: any) => (
                  <Pressable
                    key={match.id}
                    onPress={() =>
                      match?.event?.slug
                        ? router.push({ pathname: "/event/[slug]", params: { slug: match.event.slug } })
                        : null
                    }
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-3"
                    accessibilityRole="button"
                    accessibilityLabel={match?.event?.title ?? t("events:padel.matchLabel")}
                  >
                    <Text className="text-white text-sm font-semibold">
                      {match?.event?.title ?? t("events:padel.hub.matchFallback")}
                    </Text>
                    <Text className="text-white/60 text-xs">
                      {formatTournamentDate(match?.startTime ?? match?.plannedStartAt ?? null, null) ??
                        t("events:padel.hub.timePending")}
                    </Text>
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
            {(discoverQuery.data?.items ?? []).slice(0, 6).map((event) => {
              const dateLabel = formatTournamentDate(event.startsAt ?? null, event.endsAt ?? null);
              const priceLabel =
                typeof event.priceFrom === "number"
                  ? formatCurrency(event.priceFrom, "EUR")
                  : t("events:padel.hub.pricePending");
              return (
                <Pressable
                  key={event.id}
                  onPress={() =>
                    event.slug ? router.push({ pathname: "/event/[slug]", params: { slug: event.slug } }) : null
                  }
                  className="rounded-2xl border border-white/12 bg-white/6 px-4 py-4"
                  accessibilityRole="button"
                  accessibilityLabel={event.title ?? t("events:padel.tournamentFallback")}
                >
                  <Text className="text-white text-base font-semibold">
                    {event.title ?? t("events:padel.tournamentFallback")}
                  </Text>
                  <Text className="text-white/60 text-xs">
                    {dateLabel ?? t("events:padel.hub.datePending")}
                  </Text>
                  <Text className="text-white/70 text-xs">{priceLabel}</Text>
                </Pressable>
              );
            })}
          </View>

          <SectionHeader
            title={t("events:padel.hub.rankingsTitle")}
            subtitle={t("events:padel.hub.rankingsSubtitle")}
          />
          <GlassCard intensity={52}>
            <View className="gap-2">
              {rankings.length === 0 ? (
                <Text className="text-white/60 text-sm">
                  {t("events:padel.hub.rankingsEmpty")}
                </Text>
              ) : (
                rankings.map((row) => (
                  <View
                    key={`${row.position}-${row.player.id}`}
                    className="flex-row items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-3"
                  >
                    <Text className="text-white text-sm font-semibold">
                      {row.position}. {row.player.fullName ?? t("events:padel.hub.playerFallback")}
                    </Text>
                    <Text className="text-white/60 text-xs">
                      {t("events:padel.hub.pointsShort", { count: row.points })}
                    </Text>
                  </View>
                ))
              )}
            </View>
          </GlassCard>
        </ScrollView>
      </LiquidBackground>
    </View>
  );
}
