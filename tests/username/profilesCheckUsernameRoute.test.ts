import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const checkUsernameAvailability = vi.hoisted(() => vi.fn());
const rateLimit = vi.hoisted(() => vi.fn());
const isRateLimitBackendUnavailableError = vi.hoisted(() => vi.fn(() => false));
const isAppRequest = vi.hoisted(() => vi.fn(() => false));
const isSameOrigin = vi.hoisted(() => vi.fn(() => true));
const enforceMobileVersionGate = vi.hoisted(() => vi.fn(() => null));
const getUser = vi.hoisted(() => vi.fn());

vi.mock("@/lib/globalUsernames", () => ({ checkUsernameAvailability }));
vi.mock("@/lib/auth/rateLimit", () => ({
  rateLimit,
  isRateLimitBackendUnavailableError,
}));
vi.mock("@/lib/auth/requestValidation", () => ({ isAppRequest, isSameOrigin }));
vi.mock("@/lib/http/mobileVersionGate", () => ({ enforceMobileVersionGate }));
vi.mock("@/lib/supabaseServer", () => ({
  createSupabaseServer: vi.fn(async () => ({
    auth: {
      getUser,
    },
  })),
}));
vi.mock("@/lib/http/withApiEnvelope", () => ({ withApiEnvelope: (handler: unknown) => handler }));

let POST: typeof import("@/app/api/profiles/check-username/route").POST;

beforeEach(async () => {
  vi.resetModules();

  checkUsernameAvailability.mockReset();
  rateLimit.mockReset();
  isRateLimitBackendUnavailableError.mockReset();
  isAppRequest.mockReset();
  isSameOrigin.mockReset();
  enforceMobileVersionGate.mockReset();
  getUser.mockReset();

  checkUsernameAvailability.mockResolvedValue({ ok: true, available: true, username: "joao" });
  rateLimit.mockResolvedValue({ allowed: true, retryAfter: 0, backend: "memory" });
  isRateLimitBackendUnavailableError.mockReturnValue(false);
  isAppRequest.mockReturnValue(false);
  isSameOrigin.mockImplementation((_req: NextRequest, options?: { allowMissing?: boolean }) =>
    Boolean(options?.allowMissing),
  );
  enforceMobileVersionGate.mockReturnValue(null);
  getUser.mockResolvedValue({ data: { user: { email: "joao@example.com" } }, error: null });

  POST = (await import("@/app/api/profiles/check-username/route")).POST;
});

function makeRequest(body: Record<string, unknown>, headers?: Record<string, string>) {
  return new NextRequest("http://localhost/api/profiles/check-username", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(headers ?? {}),
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/profiles/check-username", () => {
  it("aceita pedido mobile sem Origin quando x-client-platform está presente", async () => {
    const res = await POST(
      makeRequest({ username: "joao" }, { "x-client-platform": "mobile" }),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.available).toBe(true);
    expect(rateLimit).toHaveBeenCalledTimes(2);
    expect(checkUsernameAvailability).toHaveBeenCalledWith(
      "joao",
      undefined,
      expect.objectContaining({ allowReservedForEmail: "joao@example.com" }),
    );
  });

  it("bloqueia pedido sem origem quando não é app/mobile", async () => {
    const res = await POST(makeRequest({ username: "joao" }));
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.ok).toBe(false);
    expect(body.errorCode).toBe("FORBIDDEN");
    expect(rateLimit).not.toHaveBeenCalled();
  });

  it("devolve 429 quando rate limit por username é atingido", async () => {
    rateLimit
      .mockResolvedValueOnce({ allowed: true, retryAfter: 0, backend: "memory" })
      .mockResolvedValueOnce({ allowed: false, retryAfter: 42, backend: "memory" });

    const res = await POST(
      makeRequest({ username: "joao" }, { "x-client-platform": "mobile" }),
    );
    const body = await res.json();

    expect(res.status).toBe(429);
    expect(body.ok).toBe(false);
    expect(body.errorCode).toBe("RATE_LIMITED");
  });
});
