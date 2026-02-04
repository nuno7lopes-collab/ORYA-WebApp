import Constants from "expo-constants";
import { Platform } from "react-native";

export const registerForPushToken = async (): Promise<string | null> => {
  if (Platform.OS !== "ios") return null;
  if (!Constants.isDevice) return null;
  if (Constants.appOwnership === "expo") return null;

  const Notifications = await import("expo-notifications");

  const permissions = await Notifications.getPermissionsAsync();
  let status = permissions.status;
  if (status !== "granted") {
    const request = await Notifications.requestPermissionsAsync();
    status = request.status;
  }

  if (status !== "granted") return null;

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId;
  if (!projectId) return null;

  const token = await Notifications.getExpoPushTokenAsync({
    projectId,
  });

  return token.data ?? null;
};
