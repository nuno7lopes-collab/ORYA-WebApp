import { afterEach, describe, expect, it, vi } from "vitest";

import { createApiClient } from "../../packages/shared/src/api/client";

describe("shared api client error sanitization", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sanitizes unexpected html error payloads", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response("<!DOCTYPE html><html><body>boom</body></html>", {
          status: 500,
          headers: {
            "Content-Type": "text/html; charset=utf-8",
          },
        }),
      );

    const api = createApiClient({ baseUrl: "https://api.test" });
    await expect(api.request("/x")).rejects.toThrow(
      "API 500: Resposta HTML inesperada do servidor.",
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("truncates long non-html payloads", async () => {
    const longBody = "erro ".repeat(150);
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(longBody, {
        status: 500,
        headers: {
          "Content-Type": "text/plain",
        },
      }),
    );

    const api = createApiClient({ baseUrl: "https://api.test" });
    let message = "";
    try {
      await api.request("/y");
    } catch (err) {
      message = err instanceof Error ? err.message : String(err);
    }
    expect(message.startsWith("API 500:")).toBe(true);
    expect(message.length).toBeLessThan(470);
  });
});
