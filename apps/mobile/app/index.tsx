import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "../lib/auth";
import { useProfileSummary } from "../features/profile/hooks";

export default function Index() {
  const { loading, session } = useAuth();
  const profileQuery = useProfileSummary(Boolean(session));

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
