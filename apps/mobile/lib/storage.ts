import AsyncStorage from "@react-native-async-storage/async-storage";
import type { StateStorage } from "zustand/middleware";

export const safeAsyncStorage: StateStorage = {
  getItem: async (name) => {
    const raw = await AsyncStorage.getItem(name);
    if (!raw) return null;
    try {
      JSON.parse(raw);
      return raw;
    } catch {
      await AsyncStorage.removeItem(name);
      return null;
    }
  },
  setItem: (name, value) => {
    const payload = typeof value === "string" ? value : JSON.stringify(value);
    return AsyncStorage.setItem(name, payload);
  },
  removeItem: (name) => AsyncStorage.removeItem(name),
};
