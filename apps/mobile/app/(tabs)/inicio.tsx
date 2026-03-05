import { useCallback, useMemo, useState, type ComponentProps } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useIsFocused } from "@react-navigation/native";
import { Image } from "expo-image";
import { tokens, useTranslation } from "@orya/shared";
import { LiquidBackground } from "../../components/liquid/LiquidBackground";
import { GlassSkeleton } from "../../components/glass/GlassSkeleton";
import { Ionicons } from "../../components/icons/Ionicons";
import { TopAppHeader } from "../../components/navigation/TopAppHeader";
import { useTopHeaderPadding } from "../../components/navigation/useTopHeaderPadding";
import { useTopBarScroll } from "../../components/navigation/useTopBarScroll";
import { useTabBarPadding } from "../../components/navigation/useTabBarPadding";
import { useAuth } from "../../lib/auth";
import { useMyBookings, useReservableClubs } from "../../features/bookings/hooks";
import { splitBookingsByTimeline } from "../../features/bookings/types";
import { useProfileSummary } from "../../features/profile/hooks";
import { resolveMediaUri } from "../../lib/media";
import { safePush } from "../../lib/navigation";
import { TAB_PATHNAMES } from "../../lib/tabRoutes";
import {
  formatBookingDateTime,
  resolveBookingOrganization,
  resolveBookingTitle,
  resolveFirstName,
  resolveGreetingPeriod,
  resolveRelativeDayMeta,
} from "../../features/home/formatters";

type QuickActionProps = {
  label: string;
  icon: ComponentProps<typeof Ionicons>["name"];
  accessibilityLabel: string;
  onPress: () => void;
};

function QuickAction({ label, icon, accessibilityLabel, onPress }: QuickActionProps) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-1 rounded-2xl border border-white/14 bg-white/6 px-3 py-3"
      style={({ pressed }) => [
        { minHeight: tokens.layout.touchTarget },
        pressed ? { opacity: 0.86 } : null,
      ]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <View className="items-center justify-center gap-1.5">
        <Ionicons name={icon} size={17} color="rgba(238,247,255,0.95)" />
        <Text className="text-white text-xs font-semibold text-center">{label}</Text>
      </View>
    </Pressable>
  );
}

export default function InicioScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const isFocused = useIsFocused();
  const topPadding = useTopHeaderPadding(16);
  const topBar = useTopBarScroll({ hideOnScroll: false });
  const tabBarPadding = useTabBarPadding();
  const [refreshing, setRefreshing] = useState(false);
  const { session } = useAuth();

  const accessToken = session?.access_token ?? null;
  const userId = session?.user?.id ?? null;
  const isAuthenticated = Boolean(userId && accessToken);

  const profileQuery = useProfileSummary(
    isAuthenticated && isFocused,
    accessToken,
    userId,
  );
  const bookingsQuery = useMyBookings(isAuthenticated && isFocused);
  const clubsQuery = useReservableClubs(
    {
      userId,
      accessToken,
    },
    isFocused,
  );

  const firstName = useMemo(() => {
    const byProfile = resolveFirstName(profileQuery.data?.fullName);
    if (byProfile) return byProfile;
    const byEmail = resolveFirstName(session?.user?.email?.split("@")[0] ?? null);
    return byEmail ?? t("home:defaults.playerName");
  }, [profileQuery.data?.fullName, session?.user?.email, t]);

  const greetingLabel = useMemo(() => {
    const period = resolveGreetingPeriod(new Date());
    return `${t(`home:greeting.${period}`)}, ${firstName}`;
  }, [firstName, t]);

  const bookingTimeline = useMemo(
    () => splitBookingsByTimeline(bookingsQuery.data ?? []),
    [bookingsQuery.data],
  );

  const nextBooking = bookingTimeline.active[0] ?? null;
  const nextBookingRelativeMeta = useMemo(
    () => resolveRelativeDayMeta(nextBooking?.startsAt),
    [nextBooking?.startsAt],
  );

  const nextBookingRelativeLabel = useMemo(() => {
    if (!nextBookingRelativeMeta) return null;
    if (nextBookingRelativeMeta.kind === "today") return t("home:relative.today");
    if (nextBookingRelativeMeta.kind === "tomorrow") return t("home:relative.tomorrow");
    return t("home:relative.inDays", { count: nextBookingRelativeMeta.count });
  }, [nextBookingRelativeMeta, t]);

  const nextBookingTitle =
    resolveBookingTitle(nextBooking) ?? t("home:defaults.bookingTitle");
  const nextBookingOrganization =
    resolveBookingOrganization(nextBooking) ?? t("home:defaults.organization");
  const nextBookingDate =
    formatBookingDateTime(nextBooking?.startsAt, i18n.language || "pt-PT") ??
    t("home:defaults.dateUndefined");

  const onboardingDone = profileQuery.data?.onboardingDone;
  const shouldPromptProfile =
    isAuthenticated &&
    typeof onboardingDone === "boolean" &&
    onboardingDone === false;
  const nearbyClubs = clubsQuery.data?.items ?? [];
  const nearbyClubPreview = nearbyClubs.slice(0, 3);

  const onRefresh = useCallback(async () => {
    if (!isAuthenticated || refreshing) return;
    setRefreshing(true);
    try {
      await Promise.all([profileQuery.refetch(), bookingsQuery.refetch()]);
    } finally {
      setRefreshing(false);
    }
  }, [bookingsQuery, isAuthenticated, profileQuery, refreshing]);

  const openPlaceholderQueroJogar = useCallback(() => {
    Alert.alert(t("home:placeholder.title"), t("home:placeholder.body"));
  }, [t]);

  const openAuthFromHome = useCallback(() => {
    safePush(router, {
      pathname: "/auth",
      params: { next: TAB_PATHNAMES.inicio },
    });
  }, [router]);

  const openClubsMap = useCallback(() => {
    safePush(router, "/map");
  }, [router]);

  return (
    <LiquidBackground>
      <TopAppHeader
        scrollState={topBar}
        variant="title"
        title={t("home:title")}
        titleAlign="center"
        showNotifications
        showMessages={false}
      />

      <ScrollView
        contentContainerStyle={{
          paddingTop: topPadding,
          paddingBottom: tabBarPadding,
          paddingHorizontal: 20,
          gap: 12,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            enabled={isAuthenticated}
            tintColor="rgba(239,248,255,0.9)"
            colors={["#9DDFFF"]}
            progressBackgroundColor="rgba(9,17,28,0.85)"
          />
        }
        onScroll={topBar.onScroll}
        onScrollEndDrag={topBar.onScrollEndDrag}
        onMomentumScrollEnd={topBar.onMomentumScrollEnd}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        <View className="rounded-3xl border border-white/16 bg-white/8 px-5 py-5">
          <View className="flex-row items-start justify-between gap-3">
            <View style={{ flex: 1 }}>
              <Text className="text-white/80 text-sm">{greetingLabel}</Text>
              <Text className="mt-2 text-white text-[34px] leading-[38px] font-semibold">
                {t("home:hero.title")}
              </Text>
            </View>
            <View className="rounded-2xl border border-cyan-200/35 bg-cyan-300/14 px-2.5 py-2">
              <Ionicons name="flash-outline" size={20} color="rgba(228,248,255,0.96)" />
            </View>
          </View>
          <Pressable
            onPress={openPlaceholderQueroJogar}
            className="mt-4 rounded-2xl bg-white px-4 py-3"
            style={({ pressed }) => [
              { minHeight: tokens.layout.touchTarget },
              pressed ? { opacity: 0.9 } : null,
            ]}
            accessibilityRole="button"
            accessibilityLabel={t("home:hero.cta")}
            accessibilityHint={t("home:hero.hint")}
          >
            <Text className="text-[#0b1014] text-sm font-semibold text-center">{t("home:hero.cta")}</Text>
          </Pressable>
        </View>

        {!isAuthenticated ? (
          <View className="rounded-3xl border border-cyan-200/35 bg-cyan-300/10 px-4 py-4">
            <Text className="text-cyan-50 text-sm font-semibold">{t("home:guest.title")}</Text>
            <Pressable
              onPress={openAuthFromHome}
              className="mt-3 self-start rounded-full bg-white px-3 py-2"
              style={({ pressed }) => [
                { minHeight: tokens.layout.touchTarget },
                pressed ? { opacity: 0.9 } : null,
              ]}
              accessibilityRole="button"
              accessibilityLabel={t("home:guest.cta")}
            >
              <Text className="text-[#0b1014] text-xs font-semibold">{t("home:guest.cta")}</Text>
            </Pressable>
          </View>
        ) : bookingsQuery.isLoading && !bookingsQuery.data ? (
          <GlassSkeleton height={126} />
        ) : bookingsQuery.isError ? (
          <View className="rounded-3xl border border-rose-200/30 bg-rose-400/10 px-4 py-4">
            <Text className="text-rose-100 text-sm font-semibold">{t("home:agenda.errorTitle")}</Text>
            <Pressable
              onPress={() => bookingsQuery.refetch()}
              className="mt-3 self-start rounded-full border border-white/20 bg-white/10 px-3 py-2"
              style={({ pressed }) => [
                { minHeight: tokens.layout.touchTarget },
                pressed ? { opacity: 0.88 } : null,
              ]}
              accessibilityRole="button"
              accessibilityLabel={t("home:agenda.retry")}
            >
              <Text className="text-white text-xs font-semibold">{t("home:agenda.retry")}</Text>
            </Pressable>
          </View>
        ) : (
          <View className="rounded-3xl border border-white/14 bg-white/6 px-4 py-4">
            {nextBooking ? (
              <>
                <View className="flex-row items-start justify-between gap-2">
                  <View style={{ flex: 1 }}>
                    <Text className="text-white/75 text-[11px] uppercase tracking-[0.08em]">
                      {t("home:agenda.nextBooking")}
                    </Text>
                    <Text className="mt-1 text-white text-base font-semibold" numberOfLines={1}>
                      {nextBookingTitle}
                    </Text>
                    <Text className="mt-1 text-white/72 text-xs" numberOfLines={1}>
                      {nextBookingOrganization}
                    </Text>
                    <Text className="mt-1 text-cyan-100 text-xs">{nextBookingDate}</Text>
                  </View>
                  {nextBookingRelativeLabel ? (
                    <View className="rounded-full border border-cyan-200/40 bg-cyan-300/14 px-2.5 py-1">
                      <Text className="text-cyan-50 text-[10px] font-semibold">{nextBookingRelativeLabel}</Text>
                    </View>
                  ) : null}
                </View>
                <Pressable
                  onPress={() =>
                    safePush(router, {
                      pathname: TAB_PATHNAMES.reservas,
                      params: { bookingId: String(nextBooking.id) },
                    })
                  }
                  className="mt-3 rounded-xl border border-white/18 bg-white/8 px-4 py-3"
                  style={({ pressed }) => [
                    { minHeight: tokens.layout.touchTarget },
                    pressed ? { opacity: 0.88 } : null,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={t("home:agenda.nextBookingCta")}
                >
                  <Text className="text-white text-xs font-semibold text-center">{t("home:agenda.nextBookingCta")}</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text className="text-white text-sm font-semibold">{t("home:agenda.emptyTitle")}</Text>
                <Pressable
                  onPress={() => safePush(router, "/aulas")}
                  className="mt-3 rounded-xl border border-white/20 bg-white/8 px-4 py-3"
                  style={({ pressed }) => [
                    { minHeight: tokens.layout.touchTarget },
                    pressed ? { opacity: 0.88 } : null,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={t("home:agenda.emptyCta")}
                >
                  <Text className="text-white text-xs font-semibold text-center">{t("home:agenda.emptyCta")}</Text>
                </Pressable>
              </>
            )}
          </View>
        )}

        {isAuthenticated && shouldPromptProfile ? (
          <View className="rounded-3xl border border-amber-200/34 bg-amber-300/10 px-4 py-3.5">
            <View className="flex-row items-center justify-between gap-2">
              <Text className="text-amber-100 text-xs font-semibold" style={{ flex: 1 }}>
                {t("home:profilePrompt.title")}
              </Text>
              <Pressable
                onPress={() => safePush(router, TAB_PATHNAMES.perfil)}
                className="rounded-full border border-white/20 bg-white/15 px-3 py-1.5"
                style={({ pressed }) => [
                  { minHeight: tokens.layout.touchTarget },
                  pressed ? { opacity: 0.88 } : null,
                ]}
                accessibilityRole="button"
                accessibilityLabel={t("home:profilePrompt.cta")}
              >
                <Text className="text-white text-xs font-semibold">{t("home:profilePrompt.cta")}</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        <View className="rounded-3xl border border-cyan-200/28 bg-cyan-300/8 px-4 py-4">
          <View className="flex-row items-start justify-between gap-3">
            <View style={{ flex: 1 }}>
              <Text className="text-cyan-50 text-sm font-semibold">{t("home:map.title")}</Text>
              <Text className="mt-1 text-cyan-50/78 text-xs">{t("home:map.subtitle")}</Text>
            </View>
            <View className="rounded-2xl border border-cyan-200/38 bg-cyan-300/14 px-2.5 py-2">
              <Ionicons name="map-outline" size={18} color="rgba(226,246,255,0.94)" />
            </View>
          </View>

          {clubsQuery.isLoading && !clubsQuery.data ? (
            <View className="mt-3 rounded-2xl border border-white/16 bg-white/7 px-3 py-3">
              <ActivityIndicator color="rgba(228,243,255,0.74)" />
            </View>
          ) : nearbyClubPreview.length > 0 ? (
            <View className="mt-3 flex-row items-center gap-2">
              {nearbyClubPreview.map((club) => {
                const avatar = resolveMediaUri(club.avatarUrl ?? club.coverImageUrl ?? null);
                return (
                  <View
                    key={`home-map-club-${club.orgUsername}`}
                    className="h-11 w-11 overflow-hidden rounded-full border border-white/30 bg-white/10"
                  >
                    {avatar ? (
                      <Image source={{ uri: avatar }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                    ) : (
                      <View className="flex-1 items-center justify-center">
                        <Ionicons name="business-outline" size={16} color="rgba(228,243,255,0.9)" />
                      </View>
                    )}
                  </View>
                );
              })}
              <Text className="ml-1 text-cyan-50/78 text-xs" style={{ flex: 1 }} numberOfLines={2}>
                {nearbyClubs.length === 1
                  ? t("home:map.oneClub")
                  : t("home:map.manyClubs", { count: nearbyClubs.length })}
              </Text>
            </View>
          ) : (
            <Text className="mt-3 text-cyan-50/70 text-xs">{t("home:map.empty")}</Text>
          )}

          <Pressable
            onPress={openClubsMap}
            className="mt-3 rounded-xl border border-white/18 bg-white/12 px-4 py-3"
            style={({ pressed }) => [
              { minHeight: tokens.layout.touchTarget },
              pressed ? { opacity: 0.88 } : null,
            ]}
            accessibilityRole="button"
            accessibilityLabel={t("home:map.cta")}
          >
            <Text className="text-white text-xs font-semibold text-center">{t("home:map.cta")}</Text>
          </Pressable>
        </View>

        <View className="rounded-3xl border border-white/12 bg-white/5 px-4 py-4">
          <Text className="mb-2 text-white/72 text-xs uppercase tracking-[0.08em]">
            {t("home:quickActions.title")}
          </Text>

          <View className="flex-row gap-2">
            <QuickAction
              label={t("home:quickActions.classes")}
              icon="fitness-outline"
              accessibilityLabel={t("home:quickActions.classes")}
              onPress={() => safePush(router, "/aulas")}
            />
            <QuickAction
              label={t("home:quickActions.reservations")}
              icon="calendar-outline"
              accessibilityLabel={t("home:quickActions.reservations")}
              onPress={() => safePush(router, TAB_PATHNAMES.reservas)}
            />
          </View>

          <View className="flex-row gap-2 mt-2">
            <QuickAction
              label={t("home:quickActions.compete")}
              icon="trophy-outline"
              accessibilityLabel={t("home:quickActions.compete")}
              onPress={() => safePush(router, TAB_PATHNAMES.competir)}
            />
            <QuickAction
              label={t("home:quickActions.community")}
              icon="people-outline"
              accessibilityLabel={t("home:quickActions.community")}
              onPress={() => safePush(router, TAB_PATHNAMES.comunidade)}
            />
          </View>
        </View>

        {isAuthenticated && (profileQuery.isFetching || bookingsQuery.isFetching) && !refreshing ? (
          <View className="py-1">
            <ActivityIndicator color="rgba(228,243,255,0.75)" />
          </View>
        ) : null}
      </ScrollView>
    </LiquidBackground>
  );
}
