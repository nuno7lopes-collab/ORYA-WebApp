import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, processLock } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { getMobileEnv } from "./env";

type AuthStorageAdapter = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

const shared = getMobileEnv();
const supabaseUrl = shared.supabaseUrl;
const supabaseAnonKey = shared.supabaseAnonKey;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "[mobile] Missing Supabase envs EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY",
  );
}

const isWebPlatform = Platform.OS === "web";
const volatileStorage = new Map<string, string>();
let secureStoreFallbackWarned = false;

const warnSecureStoreFallback = () => {
  if (secureStoreFallbackWarned) return;
  secureStoreFallbackWarned = true;
  console.warn(
    "[mobile] SecureStore indisponível; sessão mantida apenas em memória até reinício da app.",
  );
};

const secureStorage: AuthStorageAdapter = {
  getItem: async (key) => {
    if (isWebPlatform) {
      return AsyncStorage.getItem(key);
    }
    try {
      const secureValue = await SecureStore.getItemAsync(key);
      if (secureValue != null) {
        return secureValue;
      }
    } catch {
      // fallback below
    }

    const volatileValue = volatileStorage.get(key);
    if (typeof volatileValue === "string") {
      return volatileValue;
    }

    const legacyValue = await AsyncStorage.getItem(key);
    if (legacyValue == null) {
      return null;
    }

    // One-time migration from AsyncStorage to SecureStore.
    try {
      await SecureStore.setItemAsync(key, legacyValue);
      await AsyncStorage.removeItem(key);
    } catch {
      volatileStorage.set(key, legacyValue);
      warnSecureStoreFallback();
    }
    return legacyValue;
  },
  setItem: async (key, value) => {
    if (isWebPlatform) {
      await AsyncStorage.setItem(key, value);
      return;
    }
    try {
      await SecureStore.setItemAsync(key, value);
      volatileStorage.delete(key);
      await AsyncStorage.removeItem(key).catch(() => undefined);
      return;
    } catch {
      volatileStorage.set(key, value);
      warnSecureStoreFallback();
      await AsyncStorage.removeItem(key).catch(() => undefined);
    }
  },
  removeItem: async (key) => {
    if (!isWebPlatform) {
      await SecureStore.deleteItemAsync(key).catch(() => undefined);
    }
    volatileStorage.delete(key);
    await AsyncStorage.removeItem(key);
  },
};

export const supabase = createClient(supabaseUrl ?? "", supabaseAnonKey ?? "", {
  auth: {
    storage: secureStorage,
    persistSession: true,
    // Refresh manual para evitar corridas de token no cliente mobile.
    autoRefreshToken: false,
    // Evita refresh concorrente (mesmo token) no runtime React Native.
    lock: processLock,
    detectSessionInUrl: false,
    flowType: "pkce",
  },
});
