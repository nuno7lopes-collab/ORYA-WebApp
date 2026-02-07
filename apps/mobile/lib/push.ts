import Constants from "expo-constants";
import { Platform } from "react-native";

export type PushPermissionStatus = "granted" | "denied" | "undetermined" | "unavailable";

const isPushSupported = () => {
  if (Platform.OS !== "ios") return false;
  if (!Constants.isDevice) return false;
  if (Constants.appOwnership === "expo") return false;
  return true;
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
}> => {
  if (!isPushSupported()) {
    return { status: "unavailable", granted: false };
  }

  const Notifications = await import("expo-notifications");
  const permissions = await Notifications.getPermissionsAsync();
  const status = normalizeStatus(permissions.status);
  return { status, granted: status === "granted" };
};

export const requestPushPermission = async (): Promise<{
  status: PushPermissionStatus;
  granted: boolean;
}> => {
  if (!isPushSupported()) {
    return { status: "unavailable", granted: false };
  }

  const Notifications = await import("expo-notifications");
  const permissions = await Notifications.getPermissionsAsync();
  let status = normalizeStatus(permissions.status);
  if (status !== "granted") {
    const request = await Notifications.requestPermissionsAsync();
    status = normalizeStatus(request.status);
  }

  return { status, granted: status === "granted" };
};

export const registerForPushToken = async (): Promise<string | null> => {
  if (!isPushSupported()) return null;

  const Notifications = await import("expo-notifications");
  const permissions = await Notifications.getPermissionsAsync();
  const status = normalizeStatus(permissions.status);
  if (status !== "granted") return null;

  const token = await Notifications.getDevicePushTokenAsync();
  return token.data ?? null;
};
