import { describe, expect, it, vi } from "vitest";
import { resolvePublicDNS } from "../../scripts/db/resolve-public-dns";

describe("resolvePublicDNS", () => {
  it("devolve IP quando DoH responde", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ Answer: [{ type: 1, data: "1.2.3.4" }] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ Answer: [] }),
      });
    // @ts-expect-error - mock global fetch
    global.fetch = fetchMock;

    const res = await resolvePublicDNS("example.com");
    expect(res.ok).toBe(true);
    expect(res.ips[0]).toBe("1.2.3.4");
  });

  it("falha quando DoH falha", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: false, status: 502, json: async () => ({}) });
    // @ts-expect-error - mock global fetch
    global.fetch = fetchMock;

    const res = await resolvePublicDNS("example.com");
    expect(res.ok).toBe(false);
    expect(res.code).toMatch(/CF_|GG_/);
  });
});
