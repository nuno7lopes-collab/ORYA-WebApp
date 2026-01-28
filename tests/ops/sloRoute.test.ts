import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const requireInternalSecret = vi.hoisted(() => vi.fn());
const getOpsSlo = vi.hoisted(() => vi.fn());

vi.mock("@/lib/security/requireInternalSecret", () => ({ requireInternalSecret }));
vi.mock("@/domain/ops/slo", () => ({ getOpsSlo }));

let GET: typeof import("@/app/api/internal/ops/slo/route").GET;

beforeEach(async () => {
  requireInternalSecret.mockReset();
  getOpsSlo.mockReset();
  vi.resetModules();
  GET = (await import("@/app/api/internal/ops/slo/route")).GET;
});

describe("ops slo route", () => {
  it("bloqueia sem secret", async () => {
    requireInternalSecret.mockReturnValue(false);
    const req = new NextRequest("http://localhost/api/internal/ops/slo");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("devolve shape estável", async () => {
    requireInternalSecret.mockReturnValue(true);
    getOpsSlo.mockResolvedValue({ ts: "now", outbox: { pendingCountCapped: 0 }, eventLog: { last1hCount: 0 } });
    const req = new NextRequest("http://localhost/api/internal/ops/slo");
    const res = await GET(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.result.outbox).toBeDefined();
    expect(body.result.eventLog).toBeDefined();
  });
});
