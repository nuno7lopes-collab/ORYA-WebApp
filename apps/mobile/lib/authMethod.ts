import AsyncStorage from "@react-native-async-storage/async-storage";

export type AuthMethod = "apple" | "google" | "email";

const STORAGE_KEY = "orya:lastAuthMethod";
let cachedMethod: AuthMethod | null | undefined = undefined;

const isAuthMethod = (value: string | null): value is AuthMethod =>
  value === "apple" || value === "google" || value === "email";

export const getLastAuthMethod = async () => {
  if (cachedMethod !== undefined) return cachedMethod;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    cachedMethod = isAuthMethod(raw) ? raw : null;
    return cachedMethod;
  } catch {
    cachedMethod = null;
    return cachedMethod;
  }
};

export const setLastAuthMethod = async (method: AuthMethod | null) => {
  cachedMethod = method;
  try {
    if (method) {
      await AsyncStorage.setItem(STORAGE_KEY, method);
    } else {
      await AsyncStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Ignore storage errors to avoid blocking UX.
  }
};
