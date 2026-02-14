import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const ensureMemberModuleAccess = vi.hoisted(() => vi.fn());
const getActiveOrganizationForUser = vi.hoisted(() => vi.fn());

vi.mock("@/lib/organizationMemberAccess", () => ({ ensureMemberModuleAccess }));
vi.mock("@/lib/organizationContext", () => ({ getActiveOrganizationForUser }));
vi.mock("@/lib/organizationId", () => ({ resolveOrganizationIdFromRequest: () => null }));
vi.mock("@/lib/supabaseServer", () => ({
  createSupabaseServer: vi.fn(async () => ({
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: "u1" } } })) },
  })),
}));

const ledgerEntries = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => {
  const prisma = {
    ledgerEntry: {
      findMany: ledgerEntries,
    },
  };
  return { prisma };
});

let GET: typeof import("@/app/api/org/[orgId]/finance/exports/ledger/route").GET;

beforeEach(async () => {
  vi.resetModules();
  ledgerEntries.mockReset();
  ensureMemberModuleAccess.mockReset();
  getActiveOrganizationForUser.mockReset();
  GET = (await import("@/app/api/org/[orgId]/finance/exports/ledger/route")).GET;
});

describe("ledger export route", () => {
  it("bloqueia sem membership", async () => {
    getActiveOrganizationForUser.mockResolvedValue({ organization: null, membership: null });
    const req = new NextRequest("http://localhost/api/org/1/finance/exports/ledger?from=2024-01-01&to=2024-01-31");
    const res = await GET(req);
    expect(res.status).toBe(403);
  });

  it("devolve CSV com headers", async () => {
    getActiveOrganizationForUser.mockResolvedValue({
      organization: { id: 1, officialEmail: "finance@org.pt", officialEmailVerifiedAt: new Date() },
      membership: { role: "ADMIN", rolePack: null },
    });
    ensureMemberModuleAccess.mockResolvedValue({ ok: true });
    ledgerEntries.mockResolvedValue([
      {
        createdAt: new Date("2024-01-10T10:00:00Z"),
        paymentId: "pay_1",
        entryType: "GROSS",
        amount: 1000,
        currency: "EUR",
        sourceType: "TICKET_ORDER",
        sourceId: "order_1",
        causationId: "c1",
        correlationId: "corr1",
      },
    ]);
    const req = new NextRequest("http://localhost/api/org/1/finance/exports/ledger?from=2024-01-01&to=2024-01-31");
    const res = await GET(req);
    const text = await res.text();
    expect(res.status).toBe(200);
    expect(text).toContain("createdAt,paymentId,entryType,amount,currency,sourceType,sourceId,causationId,correlationId");
    expect(text).toContain("pay_1");
  });
});
