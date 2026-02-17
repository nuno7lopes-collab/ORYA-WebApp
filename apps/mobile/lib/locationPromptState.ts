import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_PREFIX = "orya:locationPromptSeen";

const keyFor = (userId: string) => `${STORAGE_PREFIX}:${userId}`;

const cache = new Map<string, boolean>();

export const hasSeenLocationPrompt = async (userId?: string | null): Promise<boolean> => {
  if (!userId) return true;
  if (cache.has(userId)) return Boolean(cache.get(userId));
  try {
    const raw = await AsyncStorage.getItem(keyFor(userId));
    const seen = raw === "1";
    cache.set(userId, seen);
    return seen;
  } catch {
    return false;
  }
};

export const markLocationPromptSeen = async (userId?: string | null): Promise<void> => {
  if (!userId) return;
  cache.set(userId, true);
  try {
    await AsyncStorage.setItem(keyFor(userId), "1");
  } catch {
    // Ignore storage errors to avoid blocking UX.
  }
};
