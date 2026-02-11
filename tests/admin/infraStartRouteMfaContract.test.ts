import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const requireAdminUser = vi.hoisted(() => vi.fn());
const requireInfraAction = vi.hoisted(() => vi.fn());
const resolveInfraIpAllowlist = vi.hoisted(() => vi.fn());
const normalizeTargetEnv = vi.hoisted(() => vi.fn());
const runScript = vi.hoisted(() => vi.fn());
const auditInfraAction = vi.hoisted(() => vi.fn());

vi.mock("@/lib/admin/auth", () => ({ requireAdminUser }));
vi.mock("@/app/api/admin/infra/_helpers", () => ({
  requireInfraAction,
  resolveInfraIpAllowlist,
  normalizeTargetEnv,
  runScript,
  auditInfraAction,
}));

let POST: typeof import("@/app/api/admin/infra/start/route").POST;

beforeEach(async () => {
  requireAdminUser.mockReset();
  requireInfraAction.mockReset();
  resolveInfraIpAllowlist.mockReset();
  normalizeTargetEnv.mockReset();
  runScript.mockReset();
  auditInfraAction.mockReset();

  resolveInfraIpAllowlist.mockReturnValue(["*"]);
  normalizeTargetEnv.mockReturnValue("prod");
  runScript.mockResolvedValue({ ok: true, stdout: "ok", stderr: "" });
  auditInfraAction.mockResolvedValue(null);

  vi.resetModules();
  POST = (await import("@/app/api/admin/infra/start/route")).POST;
});

describe("admin infra start MFA contract", () => {
  it("returns MFA_REQUIRED when admin session is missing MFA", async () => {
    requireAdminUser.mockResolvedValue({ ok: false, status: 403, error: "MFA_REQUIRED" });

    const req = new NextRequest("http://localhost/api/admin/infra/start", {
      method: "POST",
      body: JSON.stringify({ targetEnv: "prod", confirmProd: "PROD" }),
      headers: { "content-type": "application/json" },
    });

    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(403);
    expect(body.ok).toBe(false);
    expect(body.errorCode).toBe("MFA_REQUIRED");
    expect(requireAdminUser).toHaveBeenCalledWith({ req });
  });

  it("accepts action without per-action mfaCode/recoveryCode and forwards canonical guard params", async () => {
    requireAdminUser.mockResolvedValue({ ok: true, userId: "admin-1", userEmail: "admin@orya.pt" });
    requireInfraAction.mockResolvedValue({ ok: true });

    const req = new NextRequest("http://localhost/api/admin/infra/start", {
      method: "POST",
      body: JSON.stringify({ targetEnv: "prod", confirmProd: "PROD", withAlb: true, enableWorker: true }),
      headers: { "content-type": "application/json" },
    });

    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(requireAdminUser).toHaveBeenCalledWith({ req });
    expect(requireInfraAction).toHaveBeenCalledTimes(1);

    const guardCall = requireInfraAction.mock.calls[0]?.[0];
    expect(guardCall).toMatchObject({
      req,
      targetEnv: "prod",
      confirmProd: "PROD",
      ipAllowlist: ["*"],
    });
    expect(guardCall).not.toHaveProperty("mfaCode");
    expect(guardCall).not.toHaveProperty("recoveryCode");
  });
});
