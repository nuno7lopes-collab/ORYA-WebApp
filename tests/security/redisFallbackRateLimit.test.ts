import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const getClientIp = vi.hoisted(() => vi.fn(() => "203.0.113.10"));
const getRedisCommandClient = vi.hoisted(() => vi.fn());
const isRedisConfigured = vi.hoisted(() => vi.fn(() => false));

vi.mock("@/lib/auth/requestValidation", () => ({ getClientIp }));
vi.mock("@/lib/redis/client", () => ({
  getRedisCommandClient,
  isRedisConfigured,
}));

let rateLimit: typeof import("@/lib/auth/rateLimit").rateLimit;

beforeEach(async () => {
  vi.resetModules();
  getClientIp.mockReturnValue("203.0.113.10");
  getRedisCommandClient.mockReset();
  isRedisConfigured.mockReset();
  rateLimit = (await import("@/lib/auth/rateLimit")).rateLimit;
});

function makeRequest() {
  return new NextRequest("http://localhost/api/auth/login", { method: "POST" });
}

describe("rateLimit fallback sem redis", () => {
  it("usa memória e não lança erro quando requireDistributed=true e redis ausente", async () => {
    isRedisConfigured.mockReturnValue(false);

    const result = await rateLimit(makeRequest(), {
      windowMs: 60_000,
      max: 5,
      keyPrefix: "test:distributed-fallback",
      requireDistributed: true,
    });

    expect(result.backend).toBe("memory");
    expect(result.degraded).toBe(true);
    expect(result.allowed).toBe(true);
  });

  it("faz fallback para memória quando redis falha", async () => {
    isRedisConfigured.mockReturnValue(true);
    getRedisCommandClient.mockRejectedValueOnce(new Error("redis down"));

    const result = await rateLimit(makeRequest(), {
      windowMs: 60_000,
      max: 5,
      keyPrefix: "test:redis-error-fallback",
      requireDistributed: true,
    });

    expect(result.backend).toBe("memory");
    expect(result.degraded).toBe(true);
    expect(result.allowed).toBe(true);
  });

  it("mantém backend redis quando redis responde", async () => {
    isRedisConfigured.mockReturnValue(true);
    getRedisCommandClient.mockResolvedValue({
      incr: vi.fn().mockResolvedValue(1),
      pExpire: vi.fn().mockResolvedValue(1),
      pTTL: vi.fn().mockResolvedValue(60_000),
    } as any);

    const result = await rateLimit(makeRequest(), {
      windowMs: 60_000,
      max: 5,
      keyPrefix: "test:redis-ok",
      requireDistributed: true,
    });

    expect(result.backend).toBe("redis");
    expect(result.degraded).toBe(false);
    expect(result.allowed).toBe(true);
  });
});
