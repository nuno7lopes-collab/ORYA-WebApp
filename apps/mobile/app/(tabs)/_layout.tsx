import { Redirect, Tabs } from "expo-router";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { tokens } from "@orya/shared";
import { useAuth } from "../../lib/auth";
import { useProfileSummary } from "../../features/profile/hooks";
import { ActivityIndicator, View } from "react-native";

export default function TabsLayout() {
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

  if (!profileQuery.data?.onboardingDone) {
    return <Redirect href="/onboarding" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: "transparent",
          borderTopColor: "transparent",
          elevation: 0,
          height: 84,
          paddingTop: 8,
          paddingBottom: 24,
        },
        tabBarBackground: () => (
          <BlurView
            tint="dark"
            intensity={65}
            style={{
              flex: 1,
              borderTopWidth: 1,
              borderTopColor: tokens.colors.border,
              backgroundColor: tokens.colors.glass,
            }}
          />
        ),
        tabBarActiveTintColor: tokens.colors.text,
        tabBarInactiveTintColor: tokens.colors.textMuted,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
        },
      }}
    >
      <Tabs.Screen
        name="agora"
        options={{
          title: "Agora",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "flash" : "flash-outline"} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: "Descobrir",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "compass" : "compass-outline"} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="tickets"
        options={{
          title: "Bilhetes",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "ticket" : "ticket-outline"} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="network"
        options={{
          title: "Rede",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "people" : "people-outline"} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Perfil",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "person-circle" : "person-circle-outline"} size={22} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
