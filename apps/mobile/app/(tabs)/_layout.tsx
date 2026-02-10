import { Redirect, withLayoutContext } from "expo-router";
import { useAuth } from "../../lib/auth";
import { useProfileSummary } from "../../features/profile/hooks";
import { ActivityIndicator, Animated, Pressable, Text, View } from "react-native";
import { useCallback, useEffect, useState } from "react";
import { FloatingTabBar } from "../../components/navigation/FloatingTabBar";
import { getOnboardingDone } from "../../lib/onboardingState";
import { isAuthError, resolveOnboardingGate } from "../../lib/onboardingGate";
import { supabase } from "../../lib/supabase";
import { getOnboardingDraft } from "../../lib/onboardingDraft";
import { useFavoritesSync } from "../../features/favorites/hooks";
import { CachedProfile, getProfileCache, setProfileCache } from "../../lib/profileCache";
import { TAB_ORDER, type TabKey } from "../../components/navigation/tabOrder";
import { useTabSwipeBlocker } from "../../components/navigation/TabSwipeProvider";
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

export default function TabsLayout() {
  const { loading, session } = useAuth();
  const profileQuery = useProfileSummary(
    Boolean(session),
    session?.access_token ?? null,
    session?.user?.id ?? null,
  );
  const [localOnboardingDone, setLocalOnboardingDone] = useState<boolean | null>(null);
  const [hasDraft, setHasDraft] = useState<boolean | null>(null);
  const [cachedProfile, setCachedProfileState] = useState<CachedProfile | null>(null);

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

  useFavoritesSync(Boolean(session?.user?.id) && gateStatus === "ready");

  const { isBlocked } = useTabSwipeBlocker();
  const renderLazyPlaceholder = useCallback(
    () => (
      <View style={{ flex: 1, backgroundColor: "#0b1014", alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color="rgba(255,255,255,0.7)" />
      </View>
    ),
    [],
  );
  const renderTabBar = useCallback((props: MaterialTopTabBarProps) => {
    const activeRoute = props.state.routes[props.state.index]?.name ?? "agora";
    const activeKey = ((TAB_ORDER as readonly string[]).includes(activeRoute) ? activeRoute : "agora") as TabKey;
    const pagerProgress = Animated.subtract(props.position, 1);
    return (
      <FloatingTabBar
        activeKey={activeKey}
        onSelect={(key) => {
          const route = props.state.routes.find((item) => item.name === key);
          if (route) {
            props.navigation.navigate(route.name);
          }
        }}
        pagerProgress={pagerProgress}
      />
    );
  }, []);

  if (loading || gateStatus === "loading") {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0b1014" }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (gateStatus === "sign-in") {
    return <Redirect href="/auth" />;
  }

  if (gateStatus === "offline") {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: "#0b1014" }}>
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
    <View style={{ flex: 1, backgroundColor: "#0b1014" }}>
      <ExpoTopTabs
        tabBarPosition="bottom"
        swipeEnabled={!isBlocked}
        animationEnabled
        backBehavior="history"
        initialRouteName="agora"
        tabBar={renderTabBar}
        screenOptions={{
          tabBarShowLabel: false,
          tabBarShowIcon: false,
          tabBarIndicatorStyle: { height: 0 },
          tabBarStyle: { backgroundColor: "transparent" },
          lazy: true,
          lazyPreloadDistance: 1,
          lazyPlaceholder: renderLazyPlaceholder,
        }}
      >
        <ExpoTopTabs.Screen name="wallet" options={{ title: "Bilhetes" }} />
        <ExpoTopTabs.Screen name="agora" options={{ title: "Agora" }} />
        <ExpoTopTabs.Screen name="network" options={{ title: "Rede" }} />
        <ExpoTopTabs.Screen name="messages" options={{ title: "Mensagens" }} />
        <ExpoTopTabs.Screen name="profile" options={{ title: "Perfil" }} />
        <ExpoTopTabs.Screen name="index" options={{ title: "Descobrir" }} />
      </ExpoTopTabs>
    </View>
  );
}
