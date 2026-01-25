import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const requireInternalSecret = vi.hoisted(() => vi.fn());
const getOpsHealth = vi.hoisted(() => vi.fn());

vi.mock("@/lib/security/requireInternalSecret", () => ({ requireInternalSecret }));
vi.mock("@/domain/ops/health", () => ({ getOpsHealth }));

let GET: typeof import("@/app/api/internal/ops/health/route").GET;

beforeEach(async () => {
  requireInternalSecret.mockReset();
  getOpsHealth.mockReset();
  vi.resetModules();
  GET = (await import("@/app/api/internal/ops/health/route")).GET;
});

describe("ops health route", () => {
  it("bloqueia sem secret", async () => {
    requireInternalSecret.mockReturnValue({ ok: false, response: new Response(null, { status: 401 }) });
    const req = new NextRequest("http://localhost/api/internal/ops/health");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("devolve health", async () => {
    requireInternalSecret.mockReturnValue({ ok: true });
    getOpsHealth.mockResolvedValue({ ok: true, ts: "now", db: { ok: true } });
    const req = new NextRequest("http://localhost/api/internal/ops/health");
    const res = await GET(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
  });
});
