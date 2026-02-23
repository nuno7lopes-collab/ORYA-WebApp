import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const signInWithPassword = vi.hoisted(() => vi.fn());
const getUserById = vi.hoisted(() => vi.fn());
const rateLimit = vi.hoisted(() => vi.fn());
const isRateLimitBackendUnavailableError = vi.hoisted(() => vi.fn(() => false));
const isAppRequest = vi.hoisted(() => vi.fn(() => false));
const isSameOrigin = vi.hoisted(() => vi.fn(() => true));
const getRequestContext = vi.hoisted(() =>
  vi.fn(() => ({ requestId: "req-test", correlationId: "corr-test", orgId: null })),
);
const enforceMobileVersionGate = vi.hoisted(() => vi.fn(() => null));
const resolveUsernameOwner = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabaseServer", () => ({
  createSupabaseServer: vi.fn(async () => ({
    auth: {
      signInWithPassword,
    },
  })),
}));

vi.mock("@/lib/supabaseAdmin", () => ({
  supabaseAdmin: {
    auth: {
      admin: {
        getUserById,
      },
    },
  },
}));

vi.mock("@/lib/auth/rateLimit", () => ({
  rateLimit,
  isRateLimitBackendUnavailableError,
}));
vi.mock("@/lib/auth/requestValidation", () => ({ isAppRequest, isSameOrigin }));
vi.mock("@/lib/http/requestContext", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/http/requestContext")>();
  return { ...actual, getRequestContext };
});
vi.mock("@/lib/http/mobileVersionGate", () => ({ enforceMobileVersionGate }));
vi.mock("@/lib/username/resolveUsernameOwner", () => ({ resolveUsernameOwner }));
vi.mock("@/lib/http/withApiEnvelope", () => ({ withApiEnvelope: (handler: unknown) => handler }));

let POST: typeof import("@/app/api/auth/login/route").POST;

beforeEach(async () => {
  vi.resetModules();

  signInWithPassword.mockReset();
  getUserById.mockReset();
  rateLimit.mockReset();
  isRateLimitBackendUnavailableError.mockReset();
  isAppRequest.mockReset();
  isSameOrigin.mockReset();
  getRequestContext.mockReset();
  enforceMobileVersionGate.mockReset();
  resolveUsernameOwner.mockReset();

  rateLimit.mockResolvedValue({ allowed: true, retryAfter: 0, backend: "memory", degraded: true });
  isRateLimitBackendUnavailableError.mockReturnValue(false);
  isAppRequest.mockReturnValue(false);
  isSameOrigin.mockReturnValue(true);
  getRequestContext.mockReturnValue({ requestId: "req-test", correlationId: "corr-test", orgId: null });
  enforceMobileVersionGate.mockReturnValue(null);
  resolveUsernameOwner.mockResolvedValue({ ownerType: "user", ownerId: "user-1" });
  getUserById.mockResolvedValue({ data: { user: { email: "joao@example.com" } }, error: null });
  signInWithPassword.mockResolvedValue({
    data: { session: { access_token: "acc", refresh_token: "ref" } },
    error: null,
  });

  POST = (await import("@/app/api/auth/login/route")).POST;
});

function makeRequest(body: Record<string, unknown>, headers?: Record<string, string>) {
  return new NextRequest("http://localhost/api/auth/login", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(headers ?? {}),
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/login", () => {
  it("aceita @username e resolve email do owner antes do sign-in", async () => {
    const res = await POST(makeRequest({ identifier: "@joao", password: "123456" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(resolveUsernameOwner).toHaveBeenCalledWith(
      "joao",
      expect.objectContaining({ expectedOwnerType: "user" }),
    );
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: "joao@example.com",
      password: "123456",
    });
  });

  it("aceita username sem @ e resolve email do owner", async () => {
    const res = await POST(makeRequest({ identifier: "Joao", password: "abc123" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(resolveUsernameOwner).toHaveBeenCalledWith(
      "joao",
      expect.objectContaining({ expectedOwnerType: "user" }),
    );
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: "joao@example.com",
      password: "abc123",
    });
  });

  it("rejeita identificadores com @ ambíguo que não são email válido", async () => {
    const res = await POST(makeRequest({ identifier: "joao@empresa", password: "123456" }));
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.ok).toBe(false);
    expect(body.errorCode).toBe("INVALID_CREDENTIALS");
    expect(resolveUsernameOwner).not.toHaveBeenCalled();
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it("usa email válido diretamente sem resolver username", async () => {
    const res = await POST(makeRequest({ identifier: "Ana@Example.com", password: "123456" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(resolveUsernameOwner).not.toHaveBeenCalled();
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: "ana@example.com",
      password: "123456",
    });
  });

  it("mantém compatibilidade com payload legado usando campo email", async () => {
    const res = await POST(makeRequest({ email: "legacy@example.com", password: "123456" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(resolveUsernameOwner).not.toHaveBeenCalled();
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: "legacy@example.com",
      password: "123456",
    });
  });
});
