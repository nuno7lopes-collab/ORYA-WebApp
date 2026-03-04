import { Redirect, withLayoutContext } from "expo-router";
import { useAuth } from "../../lib/auth";
import { useProfileSummary } from "../../features/profile/hooks";
import { ActivityIndicator, Animated, InteractionManager, Linking, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useCallback, useEffect, useState } from "react";
import { FloatingTabBar } from "../../components/navigation/FloatingTabBar";
import { getOnboardingDone } from "../../lib/onboardingState";
import { isAuthError, resolveOnboardingGate } from "../../lib/onboardingGate";
import { supabase } from "../../lib/supabase";
import { getOnboardingDraft } from "../../lib/onboardingDraft";
import { useFavoritesSync } from "../../features/favorites/hooks";
import { CachedProfile, getProfileCache, setProfileCache } from "../../lib/profileCache";
import { type TabKey } from "../../components/navigation/tabOrder";
import { useTabSwipeBlocker } from "../../components/navigation/TabSwipeProvider";
import { LocationPermissionModal } from "../../components/location/LocationPermissionModal";
import { getLocationPermissionState, requestLocationConsent } from "../../lib/locationConsent";
import { hasSeenLocationPrompt, markLocationPromptSeen } from "../../lib/locationPromptState";
import { tokens, useTranslation } from "@orya/shared";
import {
  createMaterialTopTabNavigator,
  type MaterialTopTabBarProps,
  type MaterialTopTabNavigationEventMap,
  type MaterialTopTabNavigationOptions,
} from "@react-navigation/material-top-tabs";
import type { ParamListBase, TabNavigationState } from "@react-navigation/native";

const MaterialTopTabs = createMaterialTopTabNavigator();
const ExpoTopTabs = withLayoutContext<
  MaterialTopTabNavigationOptions,
  typeof MaterialTopTabs.Navigator,
  TabNavigationState<ParamListBase>,
  MaterialTopTabNavigationEventMap
>(MaterialTopTabs.Navigator);
const APP_BACKGROUND = tokens.colors.background;
const VISIBLE_TAB_KEYS: ReadonlyArray<TabKey> = ["inicio", "competir", "reservas", "comunidade", "perfil"];

export default function TabsLayout() {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const { loading, session } = useAuth();
  const [localOnboardingDone, setLocalOnboardingDone] = useState<boolean | null>(null);
  const [hasDraft, setHasDraft] = useState<boolean | null>(null);
  const [cachedProfile, setCachedProfileState] = useState<CachedProfile | null>(null);
  const [locationModalVisible, setLocationModalVisible] = useState(false);
  const [locationModalBusy, setLocationModalBusy] = useState(false);
  const [locationModalError, setLocationModalError] = useState<string | null>(null);
  const [locationCanAskAgain, setLocationCanAskAgain] = useState(true);
  const [backgroundTasksReady, setBackgroundTasksReady] = useState(false);
  const shouldFetchProfileSummary =
    Boolean(session) &&
    localOnboardingDone !== null &&
    !(localOnboardingDone === true && hasDraft !== true);
  const profileQuery = useProfileSummary(
    shouldFetchProfileSummary,
    session?.access_token ?? null,
    session?.user?.id ?? null,
  );

  useEffect(() => {
    let mounted = true;
    getOnboardingDone().then((value) => {
      if (mounted) setLocalOnboardingDone(value);
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    if (!session?.user?.id) {
      setHasDraft(null);
      setCachedProfileState(null);
      return () => {
        mounted = false;
      };
    }
    getOnboardingDraft(session.user.id).then((draft) => {
      if (mounted) setHasDraft(Boolean(draft));
    });
    getProfileCache(session.user.id).then((cached) => {
      if (mounted) setCachedProfileState(cached);
    });
    return () => {
      mounted = false;
    };
  }, [session?.user?.id]);

  useEffect(() => {
    if (!profileQuery.isError) return;
    if (!isAuthError(profileQuery.error)) return;
    supabase.auth.signOut().catch(() => undefined);
  }, [profileQuery.isError, profileQuery.error]);

  useEffect(() => {
    if (!profileQuery.data || !session?.user?.id) return;
    setProfileCache({
      userId: session.user.id,
      fullName: profileQuery.data.fullName ?? null,
      username: profileQuery.data.username ?? null,
      onboardingDone: profileQuery.data.onboardingDone ?? null,
      updatedAt: new Date().toISOString(),
    }).catch(() => undefined);
  }, [profileQuery.data, session?.user?.id]);

  const gateStatus = resolveOnboardingGate({
    session,
    localOnboardingDone,
    profileQuery,
    hasDraft,
    cachedProfile,
  });

  useFavoritesSync(
    Boolean(session?.user?.id) &&
      gateStatus === "ready" &&
      backgroundTasksReady,
  );

  useEffect(() => {
    if (gateStatus !== "ready") {
      setBackgroundTasksReady(false);
      return () => undefined;
    }
    let active = true;
    let backgroundTimer: ReturnType<typeof setTimeout> | null = null;
    const interactionTask = InteractionManager.runAfterInteractions(() => {
      backgroundTimer = setTimeout(() => {
        if (active) setBackgroundTasksReady(true);
      }, 420);
    });
    return () => {
      active = false;
      if (backgroundTimer) clearTimeout(backgroundTimer);
      interactionTask.cancel();
    };
  }, [gateStatus]);

  useEffect(() => {
    let mounted = true;
    const userId = session?.user?.id ?? null;
    if (gateStatus !== "ready" || !backgroundTasksReady || !userId)
      return () => undefined;
    hasSeenLocationPrompt(userId)
      .then(async (seen) => {
        if (!mounted || seen) return;
        const permissionState = await getLocationPermissionState();
        if (!mounted) return;
        if (permissionState.permissionStatus === "granted") return;
        setLocationCanAskAgain(permissionState.canAskAgain);
        setLocationModalError(null);
        setLocationModalVisible(true);
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, [backgroundTasksReady, gateStatus, session?.user?.id]);

  const handleLocationAllow = useCallback(async () => {
    if (locationModalBusy) return;
    markLocationPromptSeen(session?.user?.id ?? null).catch(() => undefined);
    setLocationModalBusy(true);
    setLocationModalError(null);
    try {
      const result = await requestLocationConsent({
        intent: "allow",
        accessToken: session?.access_token ?? null,
      });
      setLocationCanAskAgain(result.canAskAgain);
      setLocationModalVisible(false);
    } catch (error) {
      console.warn("Location modal allow failed", error);
      setLocationModalError(t("onboarding:errors.locationFailed"));
    } finally {
      setLocationModalBusy(false);
    }
  }, [locationModalBusy, session?.access_token, session?.user?.id, t]);

  const handleLocationSkip = useCallback(async () => {
    if (locationModalBusy) return;
    markLocationPromptSeen(session?.user?.id ?? null).catch(() => undefined);
    setLocationModalBusy(true);
    setLocationModalError(null);
    try {
      await requestLocationConsent({
        intent: "skip",
        accessToken: session?.access_token ?? null,
      });
      setLocationModalVisible(false);
    } catch {
      setLocationModalVisible(false);
    } finally {
      setLocationModalBusy(false);
    }
  }, [locationModalBusy, session?.access_token, session?.user?.id]);

  const handleLocationOpenSettings = useCallback(() => {
    markLocationPromptSeen(session?.user?.id ?? null).catch(() => undefined);
    setLocationModalVisible(false);
    Linking.openSettings().catch(() => undefined);
  }, [session?.user?.id]);

  const { isBlocked } = useTabSwipeBlocker();
  const renderTabBar = useCallback((props: MaterialTopTabBarProps) => {
    const activeRoute = props.state.routes[props.state.index]?.name ?? "inicio";
    const activeKey = (VISIBLE_TAB_KEYS.includes(activeRoute as TabKey) ? activeRoute : "inicio") as TabKey;
    return (
      <Animated.View
        pointerEvents="box-none"
        style={[
          StyleSheet.absoluteFillObject,
          { opacity: 1, transform: [{ translateY: 0 }] },
        ]}
      >
        <FloatingTabBar
          activeKey={activeKey}
          onSelect={(key) => {
            const route = props.state.routes.find((item) => item.name === key);
            if (route) {
              props.navigation.navigate(route.name);
            }
          }}
        />
      </Animated.View>
    );
  }, []);

  if (loading || gateStatus === "loading") {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: APP_BACKGROUND }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (gateStatus === "sign-in") {
    return <Redirect href="/auth" />;
  }

  if (gateStatus === "offline") {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: APP_BACKGROUND }}>
        <View style={{ maxWidth: 320 }}>
          <Text style={{ color: "white", fontSize: 16, textAlign: "center", fontWeight: "600" }}>
            Precisas de internet para concluir o onboarding.
          </Text>
        </View>
        <View style={{ height: 10 }} />
        <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, textAlign: "center" }}>
          Assim que estiveres online, tenta novamente.
        </Text>
        <View style={{ height: 16 }} />
        <Pressable
          onPress={() => profileQuery.refetch()}
          accessibilityRole="button"
          accessibilityLabel="Recarregar"
          unstable_pressDelay={0}
          style={{
            backgroundColor: "rgba(255,255,255,0.12)",
            borderRadius: 16,
            paddingVertical: 10,
            paddingHorizontal: 16,
            alignItems: "center",
            minWidth: 160,
          }}
        >
          <Text style={{ color: "white", fontWeight: "600" }}>Recarregar</Text>
        </Pressable>
      </View>
    );
  }

  if (gateStatus === "onboarding") {
    return <Redirect href="/onboarding" />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: APP_BACKGROUND }}>
      <ExpoTopTabs
        id="main-tabs"
        tabBarPosition="bottom"
        backBehavior="history"
        initialRouteName="inicio"
        initialLayout={{ width }}
        tabBar={renderTabBar}
        screenOptions={{
          swipeEnabled: !isBlocked,
          animationEnabled: false,
          tabBarShowLabel: false,
          tabBarShowIcon: false,
          tabBarIndicatorStyle: { height: 0 },
          tabBarStyle: { backgroundColor: "transparent" },
          lazy: true,
          lazyPreloadDistance: 0,
        }}
      >
        <ExpoTopTabs.Screen name="inicio" options={{ title: "Início" }} />
        <ExpoTopTabs.Screen name="competir" options={{ title: "Competir" }} />
        <ExpoTopTabs.Screen name="reservas" options={{ title: "Reservas" }} />
        <ExpoTopTabs.Screen name="comunidade" options={{ title: "Comunidade" }} />
        <ExpoTopTabs.Screen name="perfil" options={{ title: "Perfil" }} />
      </ExpoTopTabs>
      <LocationPermissionModal
        visible={locationModalVisible}
        busy={locationModalBusy}
        errorMessage={locationModalError}
        canAskAgain={locationCanAskAgain}
        onAllow={handleLocationAllow}
        onSkip={handleLocationSkip}
        onOpenSettings={handleLocationOpenSettings}
      />
    </View>
  );
}
