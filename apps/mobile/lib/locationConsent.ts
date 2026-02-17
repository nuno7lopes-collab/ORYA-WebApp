import * as Location from "expo-location";
import { getActiveSession } from "./session";
import { saveLocationConsent } from "../features/onboarding/api";

const LOCATION_TIMEOUT_MS = 8_000;

const withTimeout = async <T,>(promise: Promise<T>, ms: number, label = "timeout") => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  try {
    return await new Promise<T>((resolve, reject) => {
      timeoutId = setTimeout(() => reject(new Error(label)), ms);
      promise
        .then((value) => resolve(value))
        .catch((error) => reject(error));
    });
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};

export type LocationPermissionState = {
  permissionStatus: Location.PermissionStatus;
  canAskAgain: boolean;
};

export type LocationConsentResult = LocationPermissionState & {
  consent: "GRANTED" | "DENIED";
  source: "GPS" | "IP";
};

export const getLocationPermissionState = async (): Promise<LocationPermissionState> => {
  const permission = await Location.getForegroundPermissionsAsync();
  return {
    permissionStatus: permission.status,
    canAskAgain: Boolean(permission.canAskAgain),
  };
};

export const requestLocationConsent = async (payload: {
  intent: "allow" | "skip";
  accessToken?: string | null;
}): Promise<LocationConsentResult> => {
  let permission = await Location.getForegroundPermissionsAsync();

  if (
    payload.intent === "allow" &&
    permission.status !== Location.PermissionStatus.GRANTED &&
    permission.canAskAgain !== false
  ) {
    permission = await withTimeout(
      Location.requestForegroundPermissionsAsync(),
      LOCATION_TIMEOUT_MS,
      "permission_timeout",
    );
  }

  const consent = permission.status === Location.PermissionStatus.GRANTED ? "GRANTED" : "DENIED";
  const source = consent === "GRANTED" ? "GPS" : "IP";
  const accessToken = payload.accessToken ?? (await getActiveSession())?.access_token ?? null;

  try {
    await saveLocationConsent({
      consent,
      preferredGranularity: consent === "GRANTED" ? "COARSE" : undefined,
      accessToken,
    });
  } catch (error) {
    console.warn("Location consent save failed", error);
  }

  return {
    consent,
    source,
    permissionStatus: permission.status,
    canAskAgain: Boolean(permission.canAskAgain),
  };
};
