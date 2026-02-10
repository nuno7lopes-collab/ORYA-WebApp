import Constants from "expo-constants";
import * as Linking from "expo-linking";

type ExpoConfig = {
  scheme?: string | string[];
};

const normalizeScheme = (value?: string | string[] | null) => {
  if (Array.isArray(value)) {
    return value.find((entry) => entry && entry.trim().length > 0) ?? null;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }
  return null;
};

export const resolveAppScheme = () => {
  const expoConfig = (Constants?.expoConfig ?? {}) as ExpoConfig;
  const fromConfig = normalizeScheme(expoConfig.scheme);
  if (fromConfig) return fromConfig;
  try {
    const url = Linking.createURL("/");
    const parsed = Linking.parse(url);
    return parsed.scheme ?? "orya";
  } catch {
    return "orya";
  }
};

export const buildReturnUrl = (path = "checkout-redirect") => {
  try {
    return Linking.createURL(path);
  } catch {
    return `${resolveAppScheme()}://${path}`;
  }
};
