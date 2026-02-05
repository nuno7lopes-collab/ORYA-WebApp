import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "orya:onboardingDone";
let cachedValue: boolean | null = null;

export const getOnboardingDone = async () => {
  if (cachedValue !== null) return cachedValue;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    cachedValue = raw === "1";
    return cachedValue;
  } catch {
    cachedValue = false;
    return cachedValue;
  }
};

export const setOnboardingDone = async (value: boolean) => {
  cachedValue = value;
  try {
    if (value) {
      await AsyncStorage.setItem(STORAGE_KEY, "1");
    } else {
      await AsyncStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Ignore storage errors to avoid blocking UX.
  }
};

export const resetOnboardingDone = async () => setOnboardingDone(false);
