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

export const fetchIpLocation = async (accessToken?: string | null): Promise<IpLocationResponse> => {
  const response = await api.requestWithAccessToken<unknown>("/api/location/ip", accessToken);
  return unwrapApiResponse<IpLocationResponse>(response);
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
): Promise<boolean> => {
  const response = await api.requestWithAccessToken<unknown>("/api/profiles/check-username", accessToken, {
    method: "POST",
    body: JSON.stringify({ username }),
  });
  const payload = unwrapApiResponse<{ available?: boolean }>(response);
  return Boolean(payload?.available);
};

export const savePadelOnboarding = async (payload: {
  gender?: string | null;
  level?: string | null;
  accessToken?: string | null;
}): Promise<void> => {
  await api.requestWithAccessToken("/api/padel/onboarding", payload.accessToken, {
    method: "POST",
    body: JSON.stringify({
      gender: payload.gender ?? null,
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

export const saveLocationCoarse = async (payload: {
  city?: string | null;
  region?: string | null;
  source: "IP" | "GPS" | "WIFI" | "MANUAL";
  accessToken?: string | null;
}): Promise<void> => {
  await api.requestWithAccessToken("/api/me/location/coarse", payload.accessToken, {
    method: "POST",
    body: JSON.stringify({
      city: payload.city ?? null,
      region: payload.region ?? null,
      source: payload.source,
    }),
  });
};
