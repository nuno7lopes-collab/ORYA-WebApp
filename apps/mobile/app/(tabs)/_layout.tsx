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

export default function TabsLayout() {
  const { loading, session } = useAuth();
  const profileQuery = useProfileSummary(
    Boolean(session),
    session?.access_token ?? null,
    session?.user?.id ?? null,
  );
  const [localOnboardingDone, setLocalOnboardingDone] = useState<boolean | null>(null);
  const [hasDraft, setHasDraft] = useState<boolean | null>(null);

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
      return () => {
        mounted = false;
      };
    }
    getOnboardingDraft(session.user.id).then((draft) => {
      if (mounted) setHasDraft(Boolean(draft));
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

  const gateStatus = resolveOnboardingGate({
    session,
    localOnboardingDone,
    profileQuery,
    hasDraft,
  });

  if (loading || gateStatus === "loading") {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (gateStatus === "sign-in") {
    return <Redirect href="/auth" />;
  }

  if (gateStatus === "offline") {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
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
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarHideOnKeyboard: true,
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
