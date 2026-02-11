import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const requireAdminUser = vi.hoisted(() => vi.fn());
const rateLimit = vi.hoisted(() => vi.fn());
const resetMfa = vi.hoisted(() => vi.fn());
const forceResetMfa = vi.hoisted(() => vi.fn());
const auditAdminAction = vi.hoisted(() => vi.fn());
const notifyAdminSecurityEvent = vi.hoisted(() => vi.fn());
const clearMfaSessionCookie = vi.hoisted(() => vi.fn());
const getClientIp = vi.hoisted(() => vi.fn());
const isAppRequest = vi.hoisted(() => vi.fn());

vi.mock("@/lib/admin/auth", () => ({ requireAdminUser }));
vi.mock("@/lib/auth/rateLimit", () => ({ rateLimit }));
vi.mock("@/lib/admin/mfa", () => ({ resetMfa, forceResetMfa }));
vi.mock("@/lib/admin/audit", () => ({ auditAdminAction }));
vi.mock("@/lib/admin/alerts", () => ({ notifyAdminSecurityEvent }));
vi.mock("@/lib/admin/mfaSession", () => ({ clearMfaSessionCookie }));
vi.mock("@/lib/auth/requestValidation", () => ({ getClientIp, isAppRequest }));

let POST: typeof import("@/app/api/admin/mfa/reset/route").POST;

beforeEach(async () => {
  process.env.ADMIN_MFA_BREAK_GLASS_TOKEN = "token-hard-cut";
  process.env.ADMIN_MFA_RESET_IP_ALLOWLIST = "*";
  delete process.env.ADMIN_ACTION_IP_ALLOWLIST;

  requireAdminUser.mockReset();
  rateLimit.mockReset();
  resetMfa.mockReset();
  forceResetMfa.mockReset();
  auditAdminAction.mockReset();
  notifyAdminSecurityEvent.mockReset();
  clearMfaSessionCookie.mockReset();
  getClientIp.mockReset();
  isAppRequest.mockReset();

  requireAdminUser.mockResolvedValue({ ok: true, userId: "admin-1", userEmail: "admin@orya.pt" });
  rateLimit.mockResolvedValue({ allowed: true, retryAfter: 0 });
  getClientIp.mockReturnValue("127.0.0.1");
  isAppRequest.mockReturnValue(false);
  auditAdminAction.mockResolvedValue(null);
  notifyAdminSecurityEvent.mockResolvedValue(undefined);
  forceResetMfa.mockResolvedValue({ ok: true, payload: { otpauth: "otpauth://new", recoveryCodes: ["AAAAA-BBBBB"] } });
  resetMfa.mockResolvedValue({ ok: false, error: "MFA_CODE_REQUIRED" });

  vi.resetModules();
  POST = (await import("@/app/api/admin/mfa/reset/route")).POST;
});

describe("admin MFA reset hard-cut contract", () => {
  it("accepts only canonical break-glass header", async () => {
    const req = new NextRequest("http://localhost/api/admin/mfa/reset", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-orya-mfa-break-glass": "token-hard-cut",
      },
      body: JSON.stringify({}),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(forceResetMfa).toHaveBeenCalledTimes(1);
    expect(resetMfa).not.toHaveBeenCalled();
  });

  it("rejects legacy x-orya-break-glass header and falls back to normal code reset flow", async () => {
    const req = new NextRequest("http://localhost/api/admin/mfa/reset", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-orya-break-glass": "token-hard-cut",
      },
      body: JSON.stringify({}),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.ok).toBe(false);
    expect(body.errorCode).toBe("MFA_CODE_REQUIRED");
    expect(forceResetMfa).not.toHaveBeenCalled();
    expect(resetMfa).toHaveBeenCalledTimes(1);
  });
});
