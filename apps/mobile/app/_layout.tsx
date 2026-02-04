import "../global.css";
import { Stack } from "expo-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AuthProvider } from "../lib/auth";
import { queryClient } from "../lib/queryClient";
import { StatusBar } from "expo-status-bar";
import { PushGate } from "../components/notifications/PushGate";
import { StripeProvider } from "@stripe/stripe-react-native";
import { LogBox } from "react-native";
import { getMobileEnv } from "../lib/env";

LogBox.ignoreLogs([
  "SafeAreaView has been deprecated",
  "expo-notifications: Android Push notifications",
  "`expo-notifications` functionality is not fully supported in Expo Go",
]);

export default function RootLayout() {
  const env = getMobileEnv();
  const stripeKey = env.stripePublishableKey ?? "";
  const merchantIdentifier = env.appleMerchantId ?? undefined;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StripeProvider
            publishableKey={stripeKey}
            merchantIdentifier={merchantIdentifier}
            urlScheme="orya"
          >
            <AuthProvider>
              <StatusBar style="light" />
              <PushGate />
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen
                  name="event/[slug]"
                  options={{
                    animation: "fade_from_bottom",
                    animationDuration: 420,
                    gestureEnabled: true,
                  }}
                />
                <Stack.Screen
                  name="service/[id]"
                  options={{
                    animation: "fade_from_bottom",
                    animationDuration: 420,
                    gestureEnabled: true,
                  }}
                />
                <Stack.Screen
                  name="checkout/index"
                  options={{
                    animation: "slide_from_right",
                    animationDuration: 380,
                    gestureEnabled: true,
                  }}
                />
              </Stack>
            </AuthProvider>
          </StripeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
