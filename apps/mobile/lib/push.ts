import Constants from "expo-constants";
import { Platform } from "react-native";
import { api } from "./api";

export type PushPermissionStatus = "granted" | "denied" | "undetermined" | "unavailable";
export type PushPermissionReason = "not_ios" | "simulator" | "expo_go" | "unknown" | null;
export type PushTokenSyncStatus =
  | "unsupported"
  | "token_unavailable"
  | "unchanged"
  | "registered";

export type PushTokenSyncResult = {
  status: PushTokenSyncStatus;
  token: string | null;
};

const isPushSupported = () => {
  if (Platform.OS !== "ios") return { supported: false, reason: "not_ios" as const };
  if (!Constants.isDevice) return { supported: false, reason: "simulator" as const };
  if (Constants.appOwnership === "expo") return { supported: false, reason: "expo_go" as const };
  return { supported: true, reason: null };
};

const normalizeStatus = (status?: string | null): PushPermissionStatus => {
  if (status === "granted" || status === "denied" || status === "undetermined") {
    return status;
  }
  if (status === "provisional" || status === "ephemeral") {
    return "granted";
  }
  return "unavailable";
};

const loadNotifications = async () => {
  try {
    return await import("expo-notifications");
  } catch {
    // Jest fallback when dynamic import callback is unavailable.
    return require("expo-notifications");
  }
};

export const getPushPermissionStatus = async (): Promise<{
  status: PushPermissionStatus;
  granted: boolean;
  reason: PushPermissionReason;
}> => {
  const support = isPushSupported();
  if (!support.supported) {
    return { status: "unavailable", granted: false, reason: support.reason };
  }

  const Notifications = await loadNotifications();
  const permissions = await Notifications.getPermissionsAsync();
  const status = normalizeStatus(permissions.status);
  return { status, granted: status === "granted", reason: null };
};

export const requestPushPermission = async (): Promise<{
  status: PushPermissionStatus;
  granted: boolean;
  reason: PushPermissionReason;
}> => {
  const support = isPushSupported();
  if (!support.supported) {
    return { status: "unavailable", granted: false, reason: support.reason };
  }

  const Notifications = await loadNotifications();
  const permissions = await Notifications.getPermissionsAsync();
  let status = normalizeStatus(permissions.status);
  if (status !== "granted") {
    const request = await Notifications.requestPermissionsAsync();
    status = normalizeStatus(request.status);
  }

  return { status, granted: status === "granted", reason: null };
};

export const registerForPushToken = async (): Promise<string | null> => {
  const support = isPushSupported();
  if (!support.supported) return null;

  const Notifications = await loadNotifications();
  const permissions = await Notifications.getPermissionsAsync();
  const status = normalizeStatus(permissions.status);
  if (status !== "granted") return null;

  const token = await Notifications.getDevicePushTokenAsync();
  return token.data ?? null;
};

export const syncPushTokenWithBackend = async (
  accessToken: string,
  previousToken?: string | null,
): Promise<PushTokenSyncResult> => {
  const support = isPushSupported();
  if (!support.supported) {
    return { status: "unsupported", token: null };
  }

  const token = await registerForPushToken();
  if (!token) {
    return { status: "token_unavailable", token: null };
  }

  if (previousToken && previousToken === token) {
    return { status: "unchanged", token };
  }

  await api.requestWithAccessToken("/api/me/push-tokens", accessToken, {
    method: "POST",
    body: JSON.stringify({ token, platform: "ios" }),
  });
  return { status: "registered", token };
};
