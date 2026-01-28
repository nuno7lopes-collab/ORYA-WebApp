import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const evaluateEventAccess = vi.hoisted(() => vi.fn());
const prisma = vi.hoisted(() => ({
  $queryRaw: vi.fn(),
}));

vi.mock("@/domain/access/evaluateAccess", () => ({ evaluateEventAccess }));
vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/domain/finance/gateway/stripeGateway", () => ({
  createPaymentIntent: vi.fn(),
  retrievePaymentIntent: vi.fn(),
}));
vi.mock("@/lib/env", () => ({ env: {} }));
vi.mock("@/lib/supabaseServer", () => ({
  createSupabaseServer: vi.fn(async () => ({
    auth: { getUser: vi.fn(async () => ({ data: { user: null } })) },
  })),
}));

let POST: typeof import("@/app/api/payments/intent/route").POST;

beforeEach(() => {
  evaluateEventAccess.mockReset();
  prisma.$queryRaw.mockReset();
  process.env.LEGACY_INTENT_DISABLED = "true";
});

describe("payments intent access gate", () => {
  it("bloqueia checkout quando legacy intent esta desativado", async () => {
    vi.resetModules();
    POST = (await import("@/app/api/payments/intent/route")).POST;
    const req = new NextRequest("http://localhost/api/payments/intent", {
      method: "POST",
      body: JSON.stringify({
        slug: "slug",
        items: [{ ticketId: 1, quantity: 1 }],
        guest: { name: "Guest", email: "g@x.com" },
      }),
    });
    const res = await POST(req);
    const body = await res.json();
    expect(body.error.errorCode).toBe("LEGACY_INTENT_DISABLED");
    expect(evaluateEventAccess).not.toHaveBeenCalled();
  });

  it("bloqueia checkout quando access engine nega (legacy enabled)", async () => {
    process.env.LEGACY_INTENT_DISABLED = "false";
    vi.resetModules();
    POST = (await import("@/app/api/payments/intent/route")).POST;
    prisma.$queryRaw.mockResolvedValue([
      {
        id: 1,
        organization_id: 1,
        is_deleted: false,
        status: "PUBLISHED",
        type: "ORGANIZATION_EVENT",
        ends_at: null,
      },
    ]);
    evaluateEventAccess.mockResolvedValue({ allowed: false, reasonCode: "INVITE_ONLY" });
    const req = new NextRequest("http://localhost/api/payments/intent", {
      method: "POST",
      body: JSON.stringify({
        slug: "slug",
        items: [{ ticketId: 1, quantity: 1 }],
        guest: { name: "Guest", email: "g@x.com" },
      }),
    });
    const res = await POST(req);
    const body = await res.json();
    expect(body.error.errorCode).toBe("INVITE_ONLY");
    expect(evaluateEventAccess).toHaveBeenCalled();
  });
});
