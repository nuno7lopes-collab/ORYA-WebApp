import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const ensureMemberModuleAccess = vi.hoisted(() => vi.fn());
const getActiveOrganizationForUser = vi.hoisted(() => vi.fn());
const recordOutboxEvent = vi.hoisted(() => vi.fn(() => ({ eventId: "evt_1" })));
const appendEventLog = vi.hoisted(() => vi.fn());

vi.mock("@/lib/organizationMemberAccess", () => ({ ensureMemberModuleAccess }));
vi.mock("@/lib/organizationContext", () => ({ getActiveOrganizationForUser }));
vi.mock("@/lib/organizationId", () => ({ resolveOrganizationIdFromRequest: () => null }));
vi.mock("@/domain/outbox/producer", () => ({ recordOutboxEvent }));
vi.mock("@/domain/eventLog/append", () => ({ appendEventLog }));
vi.mock("@/lib/supabaseServer", () => ({
  createSupabaseServer: vi.fn(async () => ({
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: "u1", email: "owner@example.com" } } })),
    },
  })),
}));

let settingsState: any = null;

vi.mock("@/lib/prisma", () => {
  const prisma = {
    organizationSettings: {
      findUnique: vi.fn(() => settingsState),
      upsert: vi.fn(({ create }: any) => {
        settingsState = { ...create };
        return settingsState;
      }),
    },
    emailIdentity: {
      upsert: vi.fn(() => ({ id: "id_email_1" })),
    },
    $transaction: async (fn: any) => fn(prisma),
  };
  return { prisma };
});

let GET: typeof import("@/app/api/organizacao/finance/invoicing/route").GET;
let POST: typeof import("@/app/api/organizacao/finance/invoicing/route").POST;

beforeEach(async () => {
  vi.resetModules();
  settingsState = null;
  ensureMemberModuleAccess.mockReset();
  getActiveOrganizationForUser.mockReset();
  recordOutboxEvent.mockClear();
  appendEventLog.mockClear();
  GET = (await import("@/app/api/organizacao/finance/invoicing/route")).GET;
  POST = (await import("@/app/api/organizacao/finance/invoicing/route")).POST;
});

describe("finance invoicing route", () => {
  it("bloqueia sem ack no modo manual", async () => {
    getActiveOrganizationForUser.mockResolvedValue({
      organization: { id: 1 },
      membership: { role: "ADMIN", rolePack: null },
    });
    ensureMemberModuleAccess.mockResolvedValue({ ok: true });
    const req = new NextRequest("http://localhost/api/organizacao/finance/invoicing", {
      method: "POST",
      body: JSON.stringify({ invoicingMode: "MANUAL_OUTSIDE_ORYA", acknowledged: false }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("guarda config e escreve EventLog+Outbox", async () => {
    getActiveOrganizationForUser.mockResolvedValue({
      organization: { id: 1 },
      membership: { role: "ADMIN", rolePack: null },
    });
    ensureMemberModuleAccess.mockResolvedValue({ ok: true });
    const req = new NextRequest("http://localhost/api/organizacao/finance/invoicing", {
      method: "POST",
      body: JSON.stringify({
        invoicingMode: "EXTERNAL_SOFTWARE",
        invoicingSoftwareName: "Moloni",
        acknowledged: true,
      }),
    });
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.result.settings.invoicingMode).toBe("EXTERNAL_SOFTWARE");
    expect(recordOutboxEvent).toHaveBeenCalledTimes(1);
    expect(appendEventLog).toHaveBeenCalledTimes(1);
  });

  it("devolve settings existentes", async () => {
    settingsState = {
      organizationId: 1,
      invoicingMode: "EXTERNAL_SOFTWARE",
      invoicingSoftwareName: "InvoiceX",
      invoicingNotes: null,
      invoicingAcknowledgedAt: new Date("2024-01-01T00:00:00Z"),
    };
    getActiveOrganizationForUser.mockResolvedValue({
      organization: { id: 1 },
      membership: { role: "ADMIN", rolePack: null },
    });
    ensureMemberModuleAccess.mockResolvedValue({ ok: true });
    const req = new NextRequest("http://localhost/api/organizacao/finance/invoicing");
    const res = await GET(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.result.settings.invoicingMode).toBe("EXTERNAL_SOFTWARE");
  });
});
