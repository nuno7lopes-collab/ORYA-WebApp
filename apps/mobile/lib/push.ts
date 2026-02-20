import Constants from "expo-constants";
import { Platform } from "react-native";

export type PushPermissionStatus = "granted" | "denied" | "undetermined" | "unavailable";
export type PushPermissionReason = "not_ios" | "simulator" | "expo_go" | "unknown" | null;

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

export const getPushPermissionStatus = async (): Promise<{
  status: PushPermissionStatus;
  granted: boolean;
  reason: PushPermissionReason;
}> => {
  const support = isPushSupported();
  if (!support.supported) {
    return { status: "unavailable", granted: false, reason: support.reason };
  }

  const Notifications = await import("expo-notifications");
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

  const Notifications = await import("expo-notifications");
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

  const Notifications = await import("expo-notifications");
  const permissions = await Notifications.getPermissionsAsync();
  const status = normalizeStatus(permissions.status);
  if (status !== "granted") return null;

  const token = await Notifications.getDevicePushTokenAsync();
  return token.data ?? null;
};
