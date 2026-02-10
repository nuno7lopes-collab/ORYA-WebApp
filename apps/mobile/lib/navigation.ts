import type { Router } from "expo-router";
import type { NavigationProp } from "@react-navigation/native";

const DEFAULT_FALLBACK = "/agora";

export const safeBack = (
  router: Router,
  navigation?: NavigationProp<ReactNavigation.RootParamList> | null,
  fallback: string = DEFAULT_FALLBACK,
) => {
  try {
    if (navigation?.canGoBack?.()) {
      navigation.goBack();
      return;
    }
  } catch {
    // ignore
  }
  try {
    if (router.canGoBack?.()) {
      router.back();
      return;
    }
  } catch {
    // ignore
  }
  router.replace(fallback);
};
