const mockBaseRequest = jest.fn();
const mockFallbackRequest = jest.fn();
const mockGetActiveSession = jest.fn();
const mockRefreshSessionIfPossible = jest.fn();
const mockSignOut = jest.fn();

jest.mock("@orya/shared", () => ({
  createApiClient: (options?: { baseUrl?: string }) => ({
    request: (...args: unknown[]) => {
      const baseUrl = options?.baseUrl ?? "";
      if (typeof baseUrl === "string" && baseUrl.includes("orya.pt")) {
        return mockFallbackRequest(...args);
      }
      return mockBaseRequest(...args);
    },
  }),
}));

jest.mock("../lib/session", () => ({
  getActiveSession: (...args: unknown[]) => mockGetActiveSession(...args),
  refreshSessionIfPossible: (...args: unknown[]) =>
    mockRefreshSessionIfPossible(...args),
}));

jest.mock("../lib/supabase", () => ({
  supabase: {
    auth: {
      signOut: (...args: unknown[]) => mockSignOut(...args),
    },
  },
}));

import { api } from "../lib/api";

describe("api auth retry", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.spyOn(console, "info").mockImplementation(() => undefined);
    jest.spyOn(console, "warn").mockImplementation(() => undefined);

    mockBaseRequest.mockReset();
    mockFallbackRequest.mockReset();
    mockGetActiveSession.mockReset();
    mockRefreshSessionIfPossible.mockReset();
    mockSignOut.mockReset();

    mockGetActiveSession.mockResolvedValue({ access_token: "token-atual" });
    mockSignOut.mockResolvedValue(undefined);
  });

  it("não repete pedido nem faz signOut quando refresh falha após API 401", async () => {
    mockBaseRequest.mockRejectedValue(new Error("API 401: UNAUTHENTICATED"));
    mockRefreshSessionIfPossible.mockResolvedValue(null);

    await expect(api.request("/api/me")).rejects.toThrow("API 401");

    expect(mockRefreshSessionIfPossible).toHaveBeenCalledTimes(1);
    expect(mockBaseRequest).toHaveBeenCalledTimes(1);
    expect(mockFallbackRequest).not.toHaveBeenCalled();
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it("repete pedido quando refresh devolve sessão renovada", async () => {
    mockBaseRequest
      .mockRejectedValueOnce(new Error("API 401: UNAUTHENTICATED"))
      .mockResolvedValueOnce({ ok: true, data: { refreshed: true } });
    mockRefreshSessionIfPossible.mockResolvedValue({
      access_token: "token-renovado",
    });

    const result = await api.request<{ ok: boolean; data: { refreshed: boolean } }>(
      "/api/me",
    );

    expect(result).toEqual({ ok: true, data: { refreshed: true } });
    expect(mockRefreshSessionIfPossible).toHaveBeenCalledTimes(1);
    expect(mockBaseRequest).toHaveBeenCalledTimes(2);
    expect(mockSignOut).not.toHaveBeenCalled();
  });
});
