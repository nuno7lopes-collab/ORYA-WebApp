import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const generateLink = vi.hoisted(() => vi.fn());
const sendEmail = vi.hoisted(() => vi.fn());
const rateLimit = vi.hoisted(() => vi.fn());
const isRateLimitBackendUnavailableError = vi.hoisted(() => vi.fn(() => false));
const isAppRequest = vi.hoisted(() => vi.fn(() => false));
const isSameOrigin = vi.hoisted(() => vi.fn(() => true));
const getRequestContext = vi.hoisted(() =>
  vi.fn(() => ({ requestId: "req-test", correlationId: "corr-test" })),
);
const normalizeAndValidateUsername = vi.hoisted(() =>
  vi.fn(() => ({ ok: true, username: "username-ok" })),
);
const checkUsernameAvailability = vi.hoisted(() =>
  vi.fn(() => ({ ok: true, available: true })),
);

vi.mock("@/lib/supabaseAdmin", () => ({
  supabaseAdmin: {
    auth: {
      admin: {
        generateLink,
      },
    },
  },
}));

vi.mock("@/lib/emailClient", () => ({ sendEmail }));
vi.mock("@/lib/appBaseUrl", () => ({ getAppBaseUrl: () => "https://orya.pt" }));
vi.mock("@/lib/auth/rateLimit", () => ({
  rateLimit,
  isRateLimitBackendUnavailableError,
}));
vi.mock("@/lib/auth/requestValidation", () => ({ isAppRequest, isSameOrigin }));
vi.mock("@/lib/http/requestContext", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/http/requestContext")>();
  return { ...actual, getRequestContext };
});
vi.mock("@/lib/http/withApiEnvelope", () => ({ withApiEnvelope: (handler: unknown) => handler }));
vi.mock("@/lib/globalUsernames", () => ({
  normalizeAndValidateUsername,
  checkUsernameAvailability,
}));

let POST: typeof import("@/app/api/auth/send-otp/route").POST;

beforeEach(async () => {
  vi.resetModules();

  generateLink.mockReset();
  sendEmail.mockReset();
  rateLimit.mockReset();
  isRateLimitBackendUnavailableError.mockReset();
  isAppRequest.mockReset();
  isSameOrigin.mockReset();
  getRequestContext.mockReset();
  normalizeAndValidateUsername.mockReset();
  checkUsernameAvailability.mockReset();

  rateLimit.mockResolvedValue({ allowed: true, retryAfter: 0, backend: "memory", degraded: true });
  isRateLimitBackendUnavailableError.mockReturnValue(false);
  isAppRequest.mockReturnValue(false);
  isSameOrigin.mockReturnValue(true);
  getRequestContext.mockReturnValue({ requestId: "req-test", correlationId: "corr-test" });
  normalizeAndValidateUsername.mockReturnValue({ ok: true, username: "username-ok" });
  checkUsernameAvailability.mockResolvedValue({ ok: true, available: true });
  sendEmail.mockResolvedValue({ messageId: "mid-1" });

  POST = (await import("@/app/api/auth/send-otp/route")).POST;
});

function makeRequest(body: Record<string, unknown>, headers?: Record<string, string>) {
  return new NextRequest("http://localhost/api/auth/send-otp", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(headers ?? {}),
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/send-otp", () => {
  it("envia fallback magic link quando falta email_otp", async () => {
    generateLink.mockResolvedValueOnce({
      data: {
        properties: {
          action_link: "https://orya.pt/auth/callback?token=abc",
        },
      },
      error: null,
    });

    const res = await POST(makeRequest({ email: "ana@example.com", password: "123456" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "ana@example.com",
        subject: "Confirma o teu acesso ORYA",
        text: expect.stringContaining("https://orya.pt/auth/callback?token=abc"),
        html: expect.stringContaining("Confirmar acesso ORYA"),
      }),
    );
  });

  it("devolve erro quando supabase não devolve otp nem action_link", async () => {
    generateLink.mockResolvedValueOnce({
      data: { properties: {} },
      error: null,
    });

    const res = await POST(makeRequest({ email: "ana@example.com", password: "123456" }));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.ok).toBe(false);
    expect(body.errorCode).toBe("OTP_GENERATION_FAILED");
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("aceita pedido mobile sem origin quando platform header está presente", async () => {
    isSameOrigin.mockImplementation((_req: NextRequest, options?: { allowMissing?: boolean }) =>
      Boolean(options?.allowMissing),
    );
    generateLink.mockResolvedValueOnce({
      data: {
        properties: {
          email_otp: "123456",
          action_link: "https://orya.pt/auth/callback?token=ok",
        },
      },
      error: null,
    });

    const req = makeRequest(
      { email: "mobile@example.com", password: "123456" },
      { "x-client-platform": "mobile" },
    );

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });
});
