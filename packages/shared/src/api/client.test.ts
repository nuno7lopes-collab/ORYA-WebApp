import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { createApiClient } from "./client";

vi.mock("../config/env", () => ({
  getSharedEnv: () => ({ apiBaseUrl: "https://api.example.com" }),
}));

describe("createApiClient", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it("preserves explicit Authorization from Headers init", async () => {
    const client = createApiClient({ baseUrl: "https://api.example.com" });
    const headers = new Headers({
      Authorization: "Bearer explicit-token",
      "x-test": "1",
    });

    await client.request("/api/me", { headers });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const sentHeaders = new Headers(init.headers);
    expect(sentHeaders.get("authorization")).toBe("Bearer explicit-token");
    expect(sentHeaders.get("x-test")).toBe("1");
  });

  it("injects access token when no Authorization header exists", async () => {
    const client = createApiClient({
      baseUrl: "https://api.example.com",
      getAccessToken: async () => "session-token",
    });
    const headers = new Headers({ "x-test": "2" });

    await client.request("/api/me", { headers });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const sentHeaders = new Headers(init.headers);
    expect(sentHeaders.get("authorization")).toBe("Bearer session-token");
    expect(sentHeaders.get("x-test")).toBe("2");
  });
});
