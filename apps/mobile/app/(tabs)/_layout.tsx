import { Redirect, Tabs } from "expo-router";
import { useAuth } from "../../lib/auth";
import { useProfileSummary } from "../../features/profile/hooks";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useEffect, useState } from "react";
import { FloatingTabBar } from "../../components/navigation/FloatingTabBar";
import { getOnboardingDone } from "../../lib/onboardingState";
import { isAuthError, resolveOnboardingGate } from "../../lib/onboardingGate";
import { supabase } from "../../lib/supabase";
import { getOnboardingDraft } from "../../lib/onboardingDraft";
import { useFavoritesSync } from "../../features/favorites/hooks";
import { CachedProfile, getProfileCache, setProfileCache } from "../../lib/profileCache";

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

  if (loading || gateStatus === "loading") {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0b101a" }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (gateStatus === "sign-in") {
    return <Redirect href="/auth" />;
  }

  if (gateStatus === "offline") {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: "#0b101a" }}>
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
    <Tabs
      backBehavior="history"
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarHideOnKeyboard: true,
        sceneContainerStyle: { backgroundColor: "#0b101a" },
        lazy: true,
        lazyPreloadDistance: 0,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: "transparent",
          borderTopWidth: 0,
          elevation: 0,
        },
      }}
      tabBar={(props) => <FloatingTabBar {...props} />}
    >
      <Tabs.Screen
        name="agora"
        options={{
          title: "Agora",
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: "Descobrir",
        }}
      />
      <Tabs.Screen
        name="tickets"
        options={{
          title: "Bilhetes",
        }}
      />
      <Tabs.Screen
        name="network"
        options={{
          title: "Rede",
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Perfil",
        }}
      />
    </Tabs>
  );
}
