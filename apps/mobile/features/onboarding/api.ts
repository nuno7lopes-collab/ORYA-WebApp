import { api, unwrapApiResponse } from "../../lib/api";
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

export const fetchIpLocation = async (): Promise<IpLocationResponse> => {
  const response = await api.request<unknown>("/api/location/ip");
  return unwrapApiResponse<IpLocationResponse>(response);
};

export const saveBasicProfile = async (payload: {
  fullName: string;
  username: string;
  favouriteCategories: InterestId[];
}): Promise<void> => {
  await api.request("/api/profiles/save-basic", {
    method: "POST",
    body: JSON.stringify({
      fullName: payload.fullName,
      username: payload.username,
      favouriteCategories: payload.favouriteCategories,
    }),
  });
};

export const checkUsernameAvailability = async (username: string): Promise<boolean> => {
  const response = await api.request<unknown>("/api/profiles/check-username", {
    method: "POST",
    body: JSON.stringify({ username }),
  });
  const payload = unwrapApiResponse<{ available?: boolean }>(response);
  return Boolean(payload?.available);
};

export const savePadelOnboarding = async (payload: {
  level?: string | null;
}): Promise<void> => {
  await api.request("/api/padel/onboarding", {
    method: "POST",
    body: JSON.stringify({
      level: payload.level ?? null,
    }),
  });
};

export const saveLocationConsent = async (payload: {
  consent: "PENDING" | "GRANTED" | "DENIED";
  preferredGranularity?: "COARSE" | "PRECISE" | null;
}): Promise<void> => {
  await api.request("/api/me/location/consent", {
    method: "POST",
    body: JSON.stringify({
      consent: payload.consent,
      preferredGranularity: payload.preferredGranularity ?? null,
    }),
  });
};

export const saveLocationCoarse = async (payload: {
  city?: string | null;
  region?: string | null;
  source: "IP" | "GPS" | "WIFI" | "MANUAL";
}): Promise<void> => {
  await api.request("/api/me/location/coarse", {
    method: "POST",
    body: JSON.stringify({
      city: payload.city ?? null,
      region: payload.region ?? null,
      source: payload.source,
    }),
  });
};
