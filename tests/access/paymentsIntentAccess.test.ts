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
vi.mock("@/lib/crm/ingest", () => ({
  ingestCrmInteraction: vi.fn(async () => null),
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
  delete process.env.LEGACY_INTENT_DISABLED;
});

describe("payments intent access gate", () => {
  it(
    "bloqueia checkout com payload inválido antes do access engine",
    async () => {
      vi.resetModules();
      POST = (await import("@/app/api/payments/intent/route")).POST;
      const req = new NextRequest("http://localhost/api/payments/intent", {
        method: "POST",
        body: JSON.stringify({
          slug: "slug",
          items: [],
        }),
      });
      const res = await POST(req);
      const body = await res.json();
      expect(body.errorCode).toBe("INVALID_INPUT");
      expect(evaluateEventAccess).not.toHaveBeenCalled();
    },
    10_000,
  );

  it("bloqueia checkout quando access engine nega", async () => {
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
        guest: { name: "Guest", email: "g@x.com", consent: true },
      }),
    });
    const res = await POST(req);
    const body = await res.json();
    expect(body.errorCode).toBe("INVITE_ONLY");
    expect(evaluateEventAccess).toHaveBeenCalled();
  });

  it("propaga erro do access engine em payload valido", async () => {
    delete process.env.LEGACY_INTENT_DISABLED;
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
        guest: { name: "Guest", email: "g@x.com", consent: true },
      }),
    });
    const res = await POST(req);
    const body = await res.json();
    expect({ status: res.status, code: body.code }).toMatchInlineSnapshot(`
      {
        "code": "INVITE_ONLY",
        "status": 403,
      }
    `);
    expect(evaluateEventAccess).toHaveBeenCalled();
  });

  it("guardrail: LEGACY_INTENT_DISABLED nao pode voltar ao default invertido", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const file = readFileSync(resolve(process.cwd(), "app/api/payments/intent/route.ts"), "utf8");
    expect(file).not.toContain('LEGACY_INTENT_DISABLED !== "false"');
  });
});
