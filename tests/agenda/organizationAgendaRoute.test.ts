import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const getAgendaItemsForOrganization = vi.hoisted(() => vi.fn());
const getActiveOrganizationForUser = vi.hoisted(() => vi.fn());
const ensureMemberModuleAccess = vi.hoisted(() => vi.fn());

vi.mock("@/domain/agendaReadModel/query", () => ({ getAgendaItemsForOrganization }));
vi.mock("@/lib/organizationContext", () => ({ getActiveOrganizationForUser }));
vi.mock("@/lib/organizationMemberAccess", () => ({ ensureMemberModuleAccess }));
vi.mock("@/lib/organizationId", () => ({ resolveOrganizationIdFromRequest: () => null }));
vi.mock("@/lib/supabaseServer", () => ({
  createSupabaseServer: vi.fn(async () => ({
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: "u1" } } })) },
  })),
}));
vi.mock("@/lib/security", () => ({
  ensureAuthenticated: vi.fn(async () => ({ id: "u1" })),
}));

let GET: typeof import("@/app/api/organizacao/agenda/route").GET;

beforeEach(async () => {
  getAgendaItemsForOrganization.mockReset();
  getActiveOrganizationForUser.mockReset();
  ensureMemberModuleAccess.mockReset();
  vi.resetModules();
  GET = (await import("@/app/api/organizacao/agenda/route")).GET;
});

describe("organization agenda route", () => {
  it("bloqueia sem membership", async () => {
    getActiveOrganizationForUser.mockResolvedValue({ organization: null, membership: null });
    const req = new NextRequest("http://localhost/api/organizacao/agenda?from=2024-01-01&to=2024-01-31");
    const res = await GET(req);
    expect(res.status).toBe(403);
  });

  it("devolve itens com range válido", async () => {
    getActiveOrganizationForUser.mockResolvedValue({
      organization: { id: 1 },
      membership: { role: "ADMIN", rolePack: null },
    });
    ensureMemberModuleAccess.mockResolvedValue({ ok: true });
    getAgendaItemsForOrganization.mockResolvedValue([
      { kind: "EVENT", eventId: 1, title: "E1", startsAt: new Date(), endsAt: new Date() },
    ]);

    const req = new NextRequest("http://localhost/api/organizacao/agenda?from=2024-01-01&to=2024-01-31");
    const res = await GET(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.items).toHaveLength(1);
  });
});
