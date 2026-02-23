import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const createSupabaseServer = vi.hoisted(() => vi.fn());
const getUserWithPolicy = vi.hoisted(() => vi.fn());

const prisma = vi.hoisted(() => ({
  event: { findUnique: vi.fn() },
}));

vi.mock("@/lib/supabaseServer", () => ({ createSupabaseServer }));
vi.mock("@/lib/auth/getUserWithPolicy", () => ({ getUserWithPolicy }));
vi.mock("@/lib/prisma", () => ({ prisma }));

let POST: typeof import("@/app/api/padel/pairings/route").POST;

beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();

  createSupabaseServer.mockResolvedValue({});
  getUserWithPolicy.mockResolvedValue({
    data: { user: { id: "u-1" } },
  });

  POST = (await import("@/app/api/padel/pairings/route")).POST;
});

describe("POST /api/padel/pairings validação", () => {
  it("rejeita pairingJoinMode inválido sem fallback silencioso", async () => {
    const req = new NextRequest("http://localhost/api/padel/pairings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        eventId: 44,
        paymentMode: "SPLIT",
        pairingJoinMode: "open_any",
      }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(body.errorCode ?? body.error).toBe("INVALID_PAIRING_JOIN_MODE");
    expect(prisma.event.findUnique).not.toHaveBeenCalled();
  });
});
