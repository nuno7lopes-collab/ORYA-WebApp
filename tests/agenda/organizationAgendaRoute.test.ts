import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { SourceType } from "@prisma/client";

const getAgendaItemsForOrganization = vi.hoisted(() => vi.fn());
const getActiveOrganizationForUser = vi.hoisted(() => vi.fn());
const ensureMemberModuleAccess = vi.hoisted(() => vi.fn());
const ensureReservasModuleAccess = vi.hoisted(() => vi.fn());
const prismaMock = vi.hoisted(() => ({
  padelClub: { findFirst: vi.fn() },
  padelClubCourt: { findFirst: vi.fn() },
  organizationModuleEntry: { findMany: vi.fn() },
}));

vi.mock("@/domain/agendaReadModel/query", () => ({ getAgendaItemsForOrganization }));
vi.mock("@/lib/organizationContext", () => ({ getActiveOrganizationForUser }));
vi.mock("@/lib/organizationMemberAccess", () => ({ ensureMemberModuleAccess }));
vi.mock("@/lib/reservas/access", () => ({ ensureReservasModuleAccess }));
vi.mock("@/lib/organizationId", () => ({ resolveOrganizationIdFromRequest: () => null }));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/supabaseServer", () => ({
  createSupabaseServer: vi.fn(async () => ({
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: "u1" } } })) },
  })),
}));
vi.mock("@/lib/security", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/security")>();
  return {
    ...actual,
    ensureAuthenticated: vi.fn(async () => ({ id: "u1" })),
    isAuthUnavailableError: vi.fn(() => false),
    isEmailNotVerifiedError: vi.fn(() => false),
    isUnauthenticatedError: vi.fn(() => false),
  };
});

let GET: typeof import("@/app/api/org/[orgId]/agenda/route").GET;

beforeEach(async () => {
  getAgendaItemsForOrganization.mockReset();
  getActiveOrganizationForUser.mockReset();
  ensureMemberModuleAccess.mockReset();
  ensureReservasModuleAccess.mockReset();
  prismaMock.padelClub.findFirst.mockReset();
  prismaMock.padelClubCourt.findFirst.mockReset();
  prismaMock.organizationModuleEntry.findMany.mockReset();
  vi.resetModules();
  GET = (await import("@/app/api/org/[orgId]/agenda/route")).GET;
});

describe("organization agenda route", () => {
  it("bloqueia sem membership", async () => {
    getActiveOrganizationForUser.mockResolvedValue({ organization: null, membership: null });
    const req = new NextRequest("http://localhost/api/org/1/agenda?from=2024-01-01&to=2024-01-31");
    const res = await GET(req);
    expect(res.status).toBe(403);
  });

  it("devolve itens com range válido", async () => {
    getActiveOrganizationForUser.mockResolvedValue({
      organization: { id: 1 },
      membership: { role: "ADMIN", rolePack: null },
    });
    ensureReservasModuleAccess.mockResolvedValue({ ok: true });
    ensureMemberModuleAccess.mockResolvedValue({ ok: true });
    prismaMock.organizationModuleEntry.findMany.mockResolvedValue([
      { moduleKey: "RESERVAS" },
      { moduleKey: "EVENTOS" },
      { moduleKey: "TORNEIOS" },
    ]);
    getAgendaItemsForOrganization.mockResolvedValue([
      { kind: "EVENT", eventId: 1, title: "E1", startsAt: new Date(), endsAt: new Date() },
    ]);

    const req = new NextRequest("http://localhost/api/org/1/agenda?from=2024-01-01&to=2024-01-31");
    const res = await GET(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.result.items).toHaveLength(1);
    expect(getAgendaItemsForOrganization).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceTypes: expect.arrayContaining([SourceType.BOOKING, SourceType.CLASS_SESSION]),
      }),
    );
  });
});
