import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { useEffect } from "react";
import { useProfileSummary } from "../features/profile/hooks";

export default function Index() {
  const { loading, session } = useAuth();
  const profileQuery = useProfileSummary(Boolean(session), session?.access_token ?? null);

  useEffect(() => {
    if (!profileQuery.isError) return;
    const message =
      profileQuery.error instanceof Error
        ? profileQuery.error.message
        : String(profileQuery.error ?? "");
    if (message.includes("API 401") || message.includes("UNAUTHENTICATED")) {
      supabase.auth.signOut().catch(() => undefined);
    }
  }, [profileQuery.isError, profileQuery.error]);

  if (loading || (session && profileQuery.isLoading)) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!session) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  const onboardingDone = profileQuery.data?.onboardingDone ?? false;

  return onboardingDone ? <Redirect href="/(tabs)" /> : <Redirect href="/onboarding" />;
}
