const mockRequestWithAccessToken = jest.fn();
const mockGetPermissionsAsync = jest.fn();
const mockRequestPermissionsAsync = jest.fn();
const mockGetDevicePushTokenAsync = jest.fn();

jest.mock("expo-constants", () => ({
  __esModule: true,
  default: {
    appOwnership: "standalone",
    isDevice: true,
  },
}));

jest.mock("react-native", () => ({
  Platform: {
    OS: "ios",
  },
}));

jest.mock("expo-notifications", () => ({
  getPermissionsAsync: (...args: unknown[]) => mockGetPermissionsAsync(...args),
  requestPermissionsAsync: (...args: unknown[]) => mockRequestPermissionsAsync(...args),
  getDevicePushTokenAsync: (...args: unknown[]) => mockGetDevicePushTokenAsync(...args),
}));

jest.mock("../lib/api", () => ({
  api: {
    requestWithAccessToken: (...args: unknown[]) => mockRequestWithAccessToken(...args),
  },
}));

import Constants from "expo-constants";
import { Platform } from "react-native";
import { syncPushTokenWithBackend } from "../lib/push";

describe("push token sync", () => {
  beforeEach(() => {
    mockRequestWithAccessToken.mockReset();
    mockGetPermissionsAsync.mockReset();
    mockRequestPermissionsAsync.mockReset();
    mockGetDevicePushTokenAsync.mockReset();

    (Platform as { OS: string }).OS = "ios";
    (Constants as { appOwnership: string; isDevice: boolean }).appOwnership = "standalone";
    (Constants as { appOwnership: string; isDevice: boolean }).isDevice = true;
  });

  it("devolve unsupported fora de iOS", async () => {
    (Platform as { OS: string }).OS = "android";

    const result = await syncPushTokenWithBackend("access-token");

    expect(result).toEqual({ status: "unsupported", token: null });
    expect(mockRequestWithAccessToken).not.toHaveBeenCalled();
  });

  it("devolve token_unavailable quando permissões não estão granted", async () => {
    mockGetPermissionsAsync.mockResolvedValue({ status: "denied" });

    const result = await syncPushTokenWithBackend("access-token");

    expect(result).toEqual({ status: "token_unavailable", token: null });
    expect(mockRequestWithAccessToken).not.toHaveBeenCalled();
  });

  it("devolve unchanged quando token não mudou", async () => {
    mockGetPermissionsAsync.mockResolvedValue({ status: "granted" });
    mockGetDevicePushTokenAsync.mockResolvedValue({ data: "token-123" });

    const result = await syncPushTokenWithBackend("access-token", "token-123");

    expect(result).toEqual({ status: "unchanged", token: "token-123" });
    expect(mockRequestWithAccessToken).not.toHaveBeenCalled();
  });

  it("regista token no backend quando há token novo", async () => {
    mockGetPermissionsAsync.mockResolvedValue({ status: "granted" });
    mockGetDevicePushTokenAsync.mockResolvedValue({ data: "token-456" });
    mockRequestWithAccessToken.mockResolvedValue({ ok: true });

    const result = await syncPushTokenWithBackend("access-token", "token-old");

    expect(result).toEqual({ status: "registered", token: "token-456" });
    expect(mockRequestWithAccessToken).toHaveBeenCalledWith(
      "/api/me/push-tokens",
      "access-token",
      {
        method: "POST",
        body: JSON.stringify({ token: "token-456", platform: "ios" }),
      },
    );
  });
});
