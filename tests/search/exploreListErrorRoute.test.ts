import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const listRankedEvents = vi.hoisted(() => vi.fn());

vi.mock("@/domain/ranking/listRankedEvents", () => ({
  listRankedEvents: (...args: unknown[]) => listRankedEvents(...args),
}));

vi.mock("@/lib/supabaseServer", () => ({
  createSupabaseServer: vi.fn(async () => {
    throw new Error("no session");
  }),
}));

vi.mock("@/lib/observability/logger", () => ({
  logError: vi.fn(),
}));

describe("GET /api/explorar/list (erro)", () => {
  it("devolve 500 quando listRankedEvents falha", async () => {
    listRankedEvents.mockRejectedValueOnce(new Error("boom"));
    const { GET } = await import("@/app/api/explorar/list/route");
    const req = new NextRequest("http://localhost/api/explorar/list?q=padel");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.ok).toBe(false);
    expect(body.errorCode ?? body.code).toBe("INTERNAL_ERROR");
  });
});

