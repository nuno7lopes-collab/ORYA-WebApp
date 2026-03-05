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
import { tokens, useTranslation } from "@orya/shared";
import { LiquidBackground } from "../../components/liquid/LiquidBackground";
import { GlassSkeleton } from "../../components/glass/GlassSkeleton";
import { Ionicons } from "../../components/icons/Ionicons";
import { TopAppHeader } from "../../components/navigation/TopAppHeader";
import { useTopHeaderPadding } from "../../components/navigation/useTopHeaderPadding";
import { useTopBarScroll } from "../../components/navigation/useTopBarScroll";
import { useTabBarPadding } from "../../components/navigation/useTabBarPadding";
import { useAuth } from "../../lib/auth";
import { useMyBookings } from "../../features/bookings/hooks";
import { splitBookingsByTimeline } from "../../features/bookings/types";
import { useProfileSummary } from "../../features/profile/hooks";
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

type HomeStatChipProps = {
  label: string;
  value: string;
  tone?: "default" | "accent";
};

function HomeStatChip({ label, value, tone = "default" }: HomeStatChipProps) {
  const accent = tone === "accent";
  return (
    <View
      className="rounded-full px-3 py-1.5"
      style={{
        borderWidth: 1,
        borderColor: accent ? "rgba(145,236,255,0.4)" : "rgba(255,255,255,0.18)",
        backgroundColor: accent ? "rgba(101,215,255,0.16)" : "rgba(255,255,255,0.08)",
      }}
    >
      <Text className="text-[10px] uppercase tracking-[0.08em]" style={{ color: "rgba(230,241,255,0.74)" }}>
        {label}
      </Text>
      <Text className="text-xs font-semibold mt-0.5" style={{ color: "#ffffff" }}>
        {value}
      </Text>
    </View>
  );
}

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
        pressed ? { opacity: 0.84 } : null,
      ]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={label}
    >
      <View className="items-center justify-center gap-1.5">
        <Ionicons name={icon} size={16} color="rgba(238,247,255,0.92)" />
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

  const padelLevel =
    profileQuery.data?.padelLevel?.trim() || t("home:stats.levelUnset");

  const profileStatusLabel =
    !isAuthenticated
      ? t("home:profileStatus.guest")
      : typeof onboardingDone !== "boolean"
        ? t("home:profileStatus.checking")
        : shouldPromptProfile
          ? t("home:profileStatus.pending")
          : t("home:profileStatus.complete");

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
    Alert.alert(
      t("home:placeholder.title"),
      t("home:placeholder.body"),
    );
  }, [t]);

  const openAuthFromHome = useCallback(() => {
    safePush(router, {
      pathname: "/auth",
      params: { next: TAB_PATHNAMES.inicio },
    });
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
          gap: 14,
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
          <View className="flex-row items-center justify-between gap-3">
            <View style={{ flex: 1 }}>
              <Text className="text-white/80 text-sm">{greetingLabel}</Text>
              <Text className="mt-2 text-white text-[34px] leading-[38px] font-semibold">
                {t("home:hero.title")}
              </Text>
              <Text className="mt-2 text-white/65 text-xs">{t("home:hero.subtitle")}</Text>
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
            <Text className="mt-1 text-cyan-50/85 text-xs">{t("home:guest.body")}</Text>
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
        ) : (
          <>
            <View className="flex-row flex-wrap gap-2">
              <HomeStatChip
                label={t("home:stats.upcomingBookings")}
                value={String(bookingTimeline.active.length)}
                tone="accent"
              />
              <HomeStatChip label={t("home:stats.padelLevel")} value={padelLevel} />
              <HomeStatChip label={t("home:stats.profile")} value={profileStatusLabel} />
            </View>

            {bookingsQuery.isLoading && !bookingsQuery.data ? (
              <GlassSkeleton height={134} />
            ) : bookingsQuery.isError ? (
              <View className="rounded-3xl border border-rose-200/30 bg-rose-400/10 px-4 py-4">
                <Text className="text-rose-100 text-sm font-semibold">{t("home:agenda.errorTitle")}</Text>
                <Text className="mt-1 text-rose-100/85 text-xs">{t("home:agenda.errorBody")}</Text>
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
            ) : nextBooking ? (
              <View className="rounded-3xl border border-white/14 bg-white/6 px-4 py-4">
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
              </View>
            ) : (
              <View className="rounded-3xl border border-white/14 bg-white/6 px-4 py-4">
                <Text className="text-white text-sm font-semibold">{t("home:agenda.emptyTitle")}</Text>
                <Text className="mt-1 text-white/70 text-xs">{t("home:agenda.emptyBody")}</Text>
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
              </View>
            )}

            {shouldPromptProfile ? (
              <View className="rounded-3xl border border-amber-200/34 bg-amber-300/10 px-4 py-4">
                <Text className="text-amber-100 text-sm font-semibold">{t("home:profilePrompt.title")}</Text>
                <Text className="mt-1 text-amber-100/85 text-xs">{t("home:profilePrompt.body")}</Text>
                <Pressable
                  onPress={() => safePush(router, TAB_PATHNAMES.perfil)}
                  className="mt-3 self-start rounded-full border border-white/20 bg-white/15 px-3 py-2"
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
            ) : null}
          </>
        )}

        <View className="rounded-3xl border border-white/12 bg-white/5 px-4 py-4">
          <View className="flex-row items-center gap-2">
            <Ionicons name="fitness-outline" size={16} color="rgba(234,245,255,0.9)" />
            <Text className="text-white text-sm font-semibold">{t("home:classes.title")}</Text>
          </View>
          <Text className="mt-1 text-white/70 text-xs">{t("home:classes.subtitle")}</Text>
          <Pressable
            onPress={() => safePush(router, "/aulas")}
            className="mt-3 rounded-xl border border-white/20 bg-white/8 px-4 py-3"
            style={({ pressed }) => [
              { minHeight: tokens.layout.touchTarget },
              pressed ? { opacity: 0.88 } : null,
            ]}
            accessibilityRole="button"
            accessibilityLabel={t("home:classes.cta")}
          >
            <Text className="text-white text-xs font-semibold text-center">{t("home:classes.cta")}</Text>
          </Pressable>
        </View>

        <View>
          <Text className="mb-2 text-white/75 text-xs uppercase tracking-[0.08em]">{t("home:quickActions.title")}</Text>
          <View className="flex-row gap-2">
            <QuickAction
              label={t("home:quickActions.compete")}
              icon="trophy-outline"
              accessibilityLabel={t("home:quickActions.compete")}
              onPress={() => safePush(router, TAB_PATHNAMES.competir)}
            />
            <QuickAction
              label={t("home:quickActions.reservations")}
              icon="calendar-outline"
              accessibilityLabel={t("home:quickActions.reservations")}
              onPress={() => safePush(router, TAB_PATHNAMES.reservas)}
            />
            <QuickAction
              label={t("home:quickActions.community")}
              icon="people-outline"
              accessibilityLabel={t("home:quickActions.community")}
              onPress={() => safePush(router, TAB_PATHNAMES.comunidade)}
            />
          </View>
        </View>

        {isAuthenticated && (profileQuery.isFetching || bookingsQuery.isFetching) ? (
          <View className="py-1">
            <ActivityIndicator color="rgba(228,243,255,0.75)" />
          </View>
        ) : null}
      </ScrollView>
    </LiquidBackground>
  );
}
