import AsyncStorage from "@react-native-async-storage/async-storage";
import type { StateStorage } from "zustand/middleware";

const inMemoryStorage = () => {
  const store = new Map<string, string>();
  const getItem: StateStorage["getItem"] = async (name) => store.get(name) ?? null;
  const setItem: StateStorage["setItem"] = async (name, value) => {
    store.set(name, typeof value === "string" ? value : JSON.stringify(value));
  };
  const removeItem: StateStorage["removeItem"] = async (name) => {
    store.delete(name);
  };
  return { getItem, setItem, removeItem } satisfies StateStorage;
};

const isBrowserLike = typeof window !== "undefined";

export const safeAsyncStorage: StateStorage = isBrowserLike
  ? {
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
    }
  : inMemoryStorage();
