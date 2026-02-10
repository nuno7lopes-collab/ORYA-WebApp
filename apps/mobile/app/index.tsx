import { Redirect } from "expo-router";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { useEffect, useRef, useState } from "react";
import { useProfileSummary } from "../features/profile/hooks";
import { getOnboardingDone, resetOnboardingDone } from "../lib/onboardingState";
import { isAuthError, resolveOnboardingGate } from "../lib/onboardingGate";
import { getOnboardingDraft } from "../lib/onboardingDraft";
import { perfLog, perfMark, perfMeasure } from "../lib/perf";
import { CachedProfile, getProfileCache, setProfileCache } from "../lib/profileCache";

export default function Index() {
  const { loading, session } = useAuth();
  const profileQuery = useProfileSummary(
    Boolean(session),
    session?.access_token ?? null,
    session?.user?.id ?? null,
  );
  const [localOnboardingDone, setLocalOnboardingDone] = useState<boolean | null>(null);
  const [hasDraft, setHasDraft] = useState<boolean | null>(null);
  const [cachedProfile, setCachedProfileState] = useState<CachedProfile | null>(null);
  const profileStartRef = useRef<number | null>(null);

  useEffect(() => {
    let mounted = true;
    perfMark("onboarding_local");
    getOnboardingDone().then((value) => {
      if (mounted) setLocalOnboardingDone(value);
      perfMeasure("onboarding_local_done", "onboarding_local");
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    perfMark("onboarding_draft");
    if (!session?.user?.id) {
      setHasDraft(null);
      setCachedProfileState(null);
      return () => {
        mounted = false;
      };
    }
    getOnboardingDraft(session.user.id).then((draft) => {
      if (mounted) setHasDraft(Boolean(draft));
      perfMeasure("onboarding_draft_done", "onboarding_draft");
    });
    getProfileCache(session.user.id).then((cached) => {
      if (mounted) setCachedProfileState(cached);
    });
    return () => {
      mounted = false;
    };
  }, [session?.user?.id]);

  useEffect(() => {
    if (profileQuery.isLoading && !profileStartRef.current) {
      profileStartRef.current = Date.now();
      perfLog("profile_fetch_start");
    }
    if (!profileQuery.isLoading && profileStartRef.current) {
      const duration = Date.now() - profileStartRef.current;
      perfLog("profile_fetch_done", { ms: duration, ok: !profileQuery.isError });
      profileStartRef.current = null;
    }
  }, [profileQuery.isLoading, profileQuery.isError]);

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
    cachedProfile,
  });

  useEffect(() => {
    perfLog("gate_status", { status: gateStatus });
  }, [gateStatus]);

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
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          backgroundColor: "#0b1014",
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
          accessibilityRole="button"
          accessibilityLabel="Tentar novamente"
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

  return gateStatus === "ready" ? <Redirect href="/agora" /> : <Redirect href="/onboarding" />;
}
