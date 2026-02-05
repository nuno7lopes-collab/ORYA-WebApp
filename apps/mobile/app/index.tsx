import { Redirect } from "expo-router";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { useEffect, useState } from "react";
import { useProfileSummary } from "../features/profile/hooks";
import { getOnboardingDone, resetOnboardingDone } from "../lib/onboardingState";
import { isAuthError, resolveOnboardingGate } from "../lib/onboardingGate";
import { getOnboardingDraft } from "../lib/onboardingDraft";

export default function Index() {
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
    if (isAuthError(profileQuery.error)) {
      resetOnboardingDone().catch(() => undefined);
      supabase.auth.signOut().catch(() => undefined);
    }
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
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          backgroundColor: "#0b101a",
        }}
      >
        <Text style={{ color: "white", fontSize: 16, fontWeight: "600", textAlign: "center" }}>
          Precisas de internet para concluir o onboarding.
        </Text>
        <View style={{ height: 12 }} />
        <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, textAlign: "center" }}>
          Quando estiveres online, tenta novamente.
        </Text>
        <View style={{ height: 16 }} />
        <Pressable
          onPress={() => profileQuery.refetch()}
          style={{
            borderRadius: 16,
            paddingHorizontal: 16,
            paddingVertical: 10,
            backgroundColor: "rgba(255,255,255,0.12)",
            minWidth: 160,
            alignItems: "center",
          }}
        >
          <Text style={{ color: "white", fontWeight: "600" }}>Tentar novamente</Text>
        </Pressable>
      </View>
    );
  }

  return gateStatus === "ready" ? <Redirect href="/(tabs)" /> : <Redirect href="/onboarding" />;
}
