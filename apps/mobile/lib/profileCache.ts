import AsyncStorage from "@react-native-async-storage/async-storage";

type CachedProfile = {
  userId: string;
  fullName?: string | null;
  username?: string | null;
  onboardingDone?: boolean | null;
  updatedAt: string;
};

const CACHE_KEY = "orya_profile_cache_v1";

type CacheMap = Record<string, CachedProfile>;

const readCacheMap = async (): Promise<CacheMap> => {
  const raw = await AsyncStorage.getItem(CACHE_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as CacheMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    await AsyncStorage.removeItem(CACHE_KEY);
    return {};
  }
};

export const getProfileCache = async (userId: string): Promise<CachedProfile | null> => {
  if (!userId) return null;
  const map = await readCacheMap();
  return map[userId] ?? null;
};

export const setProfileCache = async (payload: CachedProfile): Promise<void> => {
  if (!payload?.userId) return;
  const map = await readCacheMap();
  map[payload.userId] = payload;
  await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(map));
};

export const clearProfileCache = async (userId: string): Promise<void> => {
  if (!userId) return;
  const map = await readCacheMap();
  if (map[userId]) {
    delete map[userId];
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(map));
  }
};

export type { CachedProfile };
