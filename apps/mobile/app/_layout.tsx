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
import { LogBox, View, ActivityIndicator } from "react-native";
import { getMobileEnv } from "../lib/env";
import { resolveAppScheme } from "../lib/deeplink";
import { useFonts } from "expo-font";
import { Ionicons } from "../components/icons/Ionicons";
import { useEffect, useState } from "react";
import * as WebBrowser from "expo-web-browser";
import { perfMark, perfMeasure, perfLog } from "../lib/perf";
import { TabSwipeProvider } from "../components/navigation/TabSwipeProvider";
import { I18nProvider } from "../components/i18n/I18nProvider";
import { Manrope_500Medium, Manrope_700Bold } from "@expo-google-fonts/manrope";
import { Sora_600SemiBold, Sora_700Bold } from "@expo-google-fonts/sora";

WebBrowser.maybeCompleteAuthSession();

LogBox.ignoreLogs([
  "SafeAreaView has been deprecated",
  "SafeAreaView has been deprecated and will be removed in a future release",
  "SafeAreaView is deprecated",
  "Please use 'react-native-safe-area-context' instead",
  "WebCrypto API is not supported",
  "expo-notifications: Android Push notifications",
  "`expo-notifications` functionality is not fully supported in Expo Go",
]);

export default function RootLayout() {
  perfMark("app_boot");
  const env = getMobileEnv();
  const stripeKey = env.stripePublishableKey ?? "";
  const merchantIdentifier = env.appleMerchantId ?? undefined;
  const appScheme = resolveAppScheme();
  const [fontsLoaded, fontsError] = useFonts({
    ...Ionicons.font,
    Sora_600SemiBold,
    Sora_700Bold,
    Manrope_500Medium,
    Manrope_700Bold,
  });
  const [fontTimeout, setFontTimeout] = useState(false);

  useEffect(() => {
    if (!__DEV__) return;
    Ionicons.loadFont().catch((error) => {
      console.warn("Ionicons.loadFont failed", error);
    });
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setFontTimeout(true), 2000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (fontsLoaded) {
      perfMeasure("fonts_loaded", "app_boot");
    } else if (fontsError) {
      perfLog("fonts_error", { error: String(fontsError) });
    } else if (fontTimeout) {
      perfLog("fonts_timeout");
    }
  }, [fontsError, fontsLoaded, fontTimeout]);

  useEffect(() => {
    perfLog("api_base_url", { apiBaseUrl: env.apiBaseUrl, appEnv: env.appEnv });
  }, [env.apiBaseUrl, env.appEnv]);

  const loadingFallback = (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0b1014" }}>
      <ActivityIndicator />
    </View>
  );

  if (!fontsLoaded && !fontsError && !fontTimeout) {
    return loadingFallback;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: "#0b1014" }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StripeProvider
            publishableKey={stripeKey}
            merchantIdentifier={merchantIdentifier}
            urlScheme={appScheme}
          >
            <I18nProvider fallback={loadingFallback}>
              <AuthProvider>
                <StatusBar style="light" />
                <PushGate />
                <TabSwipeProvider>
                  <Stack
                    screenOptions={{
                      headerShown: false,
                      contentStyle: { backgroundColor: "#0b1014" },
                    }}
                  >
                    <Stack.Screen
                      name="(tabs)"
                      options={{
                        headerShown: false,
                      }}
                    />
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
                      name="service/[id]/booking"
                      options={{
                        animation: "slide_from_right",
                        animationDuration: 380,
                        gestureEnabled: true,
                      }}
                    />
                    <Stack.Screen
                      name="padel/index"
                      options={{
                        animation: "fade_from_bottom",
                        animationDuration: 380,
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
                </TabSwipeProvider>
              </AuthProvider>
            </I18nProvider>
          </StripeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
