import AsyncStorage from "@react-native-async-storage/async-storage";

export type OnboardingDraft = {
  userId: string;
  step: 0 | 1 | 2 | 3 | 4;
  fullName?: string;
  username?: string;
  interests?: string[];
  padel?: {
    gender?: string | null;
    preferredSide?: string | null;
    level?: string | null;
    skipped?: boolean;
  };
  location?: {
    city?: string | null;
    region?: string | null;
    source?: "GPS" | "IP";
    consent?: "GRANTED" | "DENIED";
  };
  updatedAt?: string;
};

const STORAGE_KEY = "orya:onboardingDraft";

export const getOnboardingDraft = async (userId?: string | null): Promise<OnboardingDraft | null> => {
  if (!userId) return null;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OnboardingDraft;
    if (!parsed || parsed.userId !== userId) {
      await AsyncStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

export const setOnboardingDraft = async (draft: OnboardingDraft) => {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // ignore storage errors
  }
};

export const clearOnboardingDraft = async () => {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore storage errors
  }
};
