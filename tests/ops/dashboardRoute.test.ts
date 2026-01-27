import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const requireInternalSecret = vi.hoisted(() => vi.fn());
const getOpsHealth = vi.hoisted(() => vi.fn());
const getOpsSlo = vi.hoisted(() => vi.fn());

vi.mock("@/lib/security/requireInternalSecret", () => ({ requireInternalSecret }));
vi.mock("@/domain/ops/health", () => ({ getOpsHealth }));
vi.mock("@/domain/ops/slo", () => ({ getOpsSlo }));

let GET: typeof import("@/app/api/internal/ops/dashboard/route").GET;

beforeEach(async () => {
  requireInternalSecret.mockReset();
  getOpsHealth.mockReset();
  getOpsSlo.mockReset();
  vi.resetModules();
  GET = (await import("@/app/api/internal/ops/dashboard/route")).GET;
});

describe("ops dashboard route", () => {
  it("devolve health + slo", async () => {
    requireInternalSecret.mockReturnValue(true);
    getOpsHealth.mockResolvedValue({ ok: true, ts: "now", db: { ok: true } });
    getOpsSlo.mockResolvedValue({ ts: "now", outbox: { pendingCountCapped: 0 }, eventLog: { last1hCount: 0 } });
    const req = new NextRequest("http://localhost/api/internal/ops/dashboard");
    const res = await GET(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.health.ok).toBe(true);
    expect(body.slo.outbox).toBeDefined();
  });
});
