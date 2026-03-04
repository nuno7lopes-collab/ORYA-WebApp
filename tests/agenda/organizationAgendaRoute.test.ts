import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { SourceType } from "@prisma/client";

const getAgendaItemsForOrganization = vi.hoisted(() => vi.fn());
const getActiveOrganizationForUser = vi.hoisted(() => vi.fn());
const getMemberPermissionOverrides = vi.hoisted(() => vi.fn());
const getOrganizationActiveModules = vi.hoisted(() => vi.fn());
const getOrganizationReservasOperationalState = vi.hoisted(() => vi.fn());
const resolveMemberModuleAccess = vi.hoisted(() => vi.fn());
const hasModuleAccess = vi.hoisted(() => vi.fn());
const prismaMock = vi.hoisted(() => ({
  padelClub: { findFirst: vi.fn() },
  padelClubCourt: { findFirst: vi.fn() },
}));

vi.mock("@/domain/agendaReadModel/query", () => ({ getAgendaItemsForOrganization }));
vi.mock("@/lib/organizationContext", () => ({ getActiveOrganizationForUser }));
vi.mock("@/lib/organizationMemberAccess", () => ({ getMemberPermissionOverrides }));
vi.mock("@/lib/organizationModules", () => ({ getOrganizationActiveModules }));
vi.mock("@/lib/reservas/operationalState", () => ({ getOrganizationReservasOperationalState }));
vi.mock("@/lib/organizationRbac", () => ({ resolveMemberModuleAccess, hasModuleAccess }));
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
  getMemberPermissionOverrides.mockReset();
  getOrganizationActiveModules.mockReset();
  getOrganizationReservasOperationalState.mockReset();
  resolveMemberModuleAccess.mockReset();
  hasModuleAccess.mockReset();
  prismaMock.padelClub.findFirst.mockReset();
  prismaMock.padelClubCourt.findFirst.mockReset();
  getMemberPermissionOverrides.mockResolvedValue([]);
  getOrganizationActiveModules.mockResolvedValue({
    activeModules: ["RESERVAS", "EVENTOS", "TORNEIOS"],
  });
  getOrganizationReservasOperationalState.mockResolvedValue({ acceptNewBookings: true });
  resolveMemberModuleAccess.mockReturnValue({});
  hasModuleAccess.mockReturnValue(true);
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
      organization: { id: 1, primaryModule: null },
      membership: { role: "ADMIN", rolePack: null },
    });
    getAgendaItemsForOrganization.mockResolvedValue([
      { kind: "EVENT", eventId: 1, title: "E1", startsAt: new Date(), endsAt: new Date() },
    ]);

    const req = new NextRequest("http://localhost/api/org/1/agenda?from=2024-01-01&to=2024-01-31");
    const res = await GET(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.result.items).toHaveLength(1);
    expect(body.result.reservasOperational).toEqual({ acceptsNewBookings: true });
    expect(getAgendaItemsForOrganization).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceTypes: expect.arrayContaining([SourceType.BOOKING, SourceType.CLASS_SESSION]),
      }),
    );
  });

  it("expõe estado operacional OFF de reservas", async () => {
    getActiveOrganizationForUser.mockResolvedValue({
      organization: { id: 1, primaryModule: null },
      membership: { role: "ADMIN", rolePack: null },
    });
    getOrganizationActiveModules.mockResolvedValue({
      activeModules: ["RESERVAS"],
    });
    getOrganizationReservasOperationalState.mockResolvedValue({ acceptNewBookings: false });
    getAgendaItemsForOrganization.mockResolvedValue([]);

    const req = new NextRequest("http://localhost/api/org/1/agenda?from=2024-01-01&to=2024-01-31");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.result.reservasOperational).toEqual({ acceptsNewBookings: false });
  });
});
