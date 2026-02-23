import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const createSupabaseServer = vi.hoisted(() => vi.fn());
const getUserWithPolicy = vi.hoisted(() => vi.fn());

const prisma = vi.hoisted(() => ({
  padelPairing: { findUnique: vi.fn() },
}));

vi.mock("@/lib/supabaseServer", () => ({ createSupabaseServer }));
vi.mock("@/lib/auth/getUserWithPolicy", () => ({ getUserWithPolicy }));
vi.mock("@/lib/prisma", () => ({ prisma }));

let POST: typeof import("@/app/api/padel/pairings/[id]/actions/reopen/route").POST;

beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();

  createSupabaseServer.mockResolvedValue({});
  getUserWithPolicy.mockResolvedValue({
    data: { user: { id: "u-1" } },
  });

  POST = (await import("@/app/api/padel/pairings/[id]/actions/reopen/route")).POST;
});

describe("POST /api/padel/pairings/[id]/actions/reopen validação", () => {
  it("rejeita mode inválido sem fallback silencioso", async () => {
    const req = new NextRequest("http://localhost/api/padel/pairings/11/actions/reopen", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode: "open_any" }),
    });

    const res = await POST(req, { params: Promise.resolve({ id: "11" }) });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(body.errorCode ?? body.error).toBe("INVALID_MODE");
    expect(prisma.padelPairing.findUnique).not.toHaveBeenCalled();
  });
});
