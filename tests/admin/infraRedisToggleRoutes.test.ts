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

let startRedis: typeof import("@/app/api/admin/infra/redis/start/route").POST;
let stopRedis: typeof import("@/app/api/admin/infra/redis/stop/route").POST;

beforeEach(async () => {
  requireAdminUser.mockReset();
  requireInfraAction.mockReset();
  resolveInfraIpAllowlist.mockReset();
  normalizeTargetEnv.mockReset();
  runScript.mockReset();
  auditInfraAction.mockReset();

  resolveInfraIpAllowlist.mockReturnValue(["*"]);
  normalizeTargetEnv.mockReturnValue("prod");
  requireAdminUser.mockResolvedValue({ ok: true, userId: "admin-1", userEmail: "admin@orya.pt" });
  requireInfraAction.mockResolvedValue({ ok: true });
  runScript.mockResolvedValue({ ok: true, stdout: "ok", stderr: "" });
  auditInfraAction.mockResolvedValue(null);

  vi.resetModules();
  startRedis = (await import("@/app/api/admin/infra/redis/start/route")).POST;
  stopRedis = (await import("@/app/api/admin/infra/redis/stop/route")).POST;
});

describe("admin infra redis routes", () => {
  it("executa redis stop com script dedicado", async () => {
    const req = new NextRequest("http://localhost/api/admin/infra/redis/stop", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ targetEnv: "prod", confirmProd: "PROD" }),
    });

    const res = await stopRedis(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(runScript).toHaveBeenCalledWith(
      expect.anything(),
      "aws/redis-stop.sh",
      [],
      expect.objectContaining({ APP_ENV: "prod" }),
    );
  });

  it("executa redis start com script dedicado", async () => {
    const req = new NextRequest("http://localhost/api/admin/infra/redis/start", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ targetEnv: "prod", confirmProd: "PROD" }),
    });

    const res = await startRedis(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(runScript).toHaveBeenCalledWith(
      expect.anything(),
      "aws/redis-start.sh",
      [],
      expect.objectContaining({ APP_ENV: "prod" }),
    );
  });
});
