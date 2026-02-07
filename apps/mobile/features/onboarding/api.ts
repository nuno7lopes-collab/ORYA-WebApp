import { api, unwrapApiResponse } from "../../lib/api";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { InterestId } from "./types";

export type IpLocationResponse = {
  country?: string | null;
  region?: string | null;
  city?: string | null;
  approxLatLon?: { lat: number; lon: number } | null;
  accuracyMeters?: number | null;
  source?: string | null;
  granularity?: string | null;
};

const IP_CACHE_KEY = "orya_ip_location_cache_v1";
const IP_CACHE_TTL_MS = 30 * 60 * 1000;

const readIpCache = async (): Promise<{ data: IpLocationResponse; updatedAt: number } | null> => {
  const raw = await AsyncStorage.getItem(IP_CACHE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { data: IpLocationResponse; updatedAt: number };
    if (!parsed?.data || !parsed?.updatedAt) return null;
    return parsed;
  } catch {
    await AsyncStorage.removeItem(IP_CACHE_KEY);
    return null;
  }
};

const writeIpCache = async (data: IpLocationResponse) => {
  const payload = { data, updatedAt: Date.now() };
  await AsyncStorage.setItem(IP_CACHE_KEY, JSON.stringify(payload));
};

export const fetchIpLocation = async (accessToken?: string | null): Promise<IpLocationResponse> => {
  const cached = await readIpCache();
  if (cached && Date.now() - cached.updatedAt <= IP_CACHE_TTL_MS) {
    return cached.data;
  }
  const response = await api.requestWithAccessToken<unknown>("/api/location/ip", accessToken);
  const data = unwrapApiResponse<IpLocationResponse>(response);
  writeIpCache(data).catch(() => undefined);
  return data;
};

export const saveBasicProfile = async (payload: {
  fullName: string;
  username: string;
  favouriteCategories: InterestId[];
  accessToken?: string | null;
}): Promise<void> => {
  await api.requestWithAccessToken("/api/profiles/save-basic", payload.accessToken, {
    method: "POST",
    body: JSON.stringify({
      fullName: payload.fullName,
      username: payload.username,
      favouriteCategories: payload.favouriteCategories,
    }),
  });
};

export const checkUsernameAvailability = async (
  username: string,
  accessToken?: string | null,
  signal?: AbortSignal,
): Promise<boolean> => {
  const response = await api.requestWithAccessToken<unknown>("/api/profiles/check-username", accessToken, {
    method: "POST",
    body: JSON.stringify({ username }),
    signal,
  });
  const payload = unwrapApiResponse<{ available?: boolean }>(response);
  return Boolean(payload?.available);
};

export const savePadelOnboarding = async (payload: {
  gender?: string | null;
  preferredSide?: string | null;
  level?: string | null;
  accessToken?: string | null;
}): Promise<void> => {
  await api.requestWithAccessToken("/api/padel/onboarding", payload.accessToken, {
    method: "POST",
    body: JSON.stringify({
      gender: payload.gender ?? null,
      preferredSide: payload.preferredSide ?? null,
      level: payload.level ?? null,
    }),
  });
};

export const saveLocationConsent = async (payload: {
  consent: "PENDING" | "GRANTED" | "DENIED";
  preferredGranularity?: "COARSE" | "PRECISE" | null;
  accessToken?: string | null;
}): Promise<void> => {
  await api.requestWithAccessToken("/api/me/location/consent", payload.accessToken, {
    method: "POST",
    body: JSON.stringify({
      consent: payload.consent,
      preferredGranularity: payload.preferredGranularity ?? null,
    }),
  });
};
