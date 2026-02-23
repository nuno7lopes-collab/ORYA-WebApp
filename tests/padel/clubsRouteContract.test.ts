import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const createSupabaseServer = vi.hoisted(() => vi.fn());
const getUserWithPolicy = vi.hoisted(() => vi.fn());
const getActiveOrganizationForUser = vi.hoisted(() => vi.fn());
const ensureMemberModuleAccess = vi.hoisted(() => vi.fn());
const parseOrganizationId = vi.hoisted(() => vi.fn());
const resolveOrganizationIdFromParams = vi.hoisted(() => vi.fn());
const deactivateReservationResourcesForCourts = vi.hoisted(() => vi.fn());

const prisma = vi.hoisted(() => ({
  padelClub: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  address: { findUnique: vi.fn() },
  $transaction: vi.fn(),
  padelTournamentConfig: { count: vi.fn() },
  padelClubCourt: { findMany: vi.fn(), updateMany: vi.fn() },
  padelClubStaff: { updateMany: vi.fn() },
}));

vi.mock("@/lib/supabaseServer", () => ({ createSupabaseServer }));
vi.mock("@/lib/auth/getUserWithPolicy", () => ({ getUserWithPolicy }));
vi.mock("@/lib/organizationContext", () => ({ getActiveOrganizationForUser }));
vi.mock("@/lib/organizationMemberAccess", () => ({ ensureMemberModuleAccess }));
vi.mock("@/lib/organizationId", () => ({ parseOrganizationId, resolveOrganizationIdFromParams }));
vi.mock("@/lib/reservas/courtResourceLink", () => ({ deactivateReservationResourcesForCourts }));
vi.mock("@/lib/prisma", () => ({ prisma }));

let POST: typeof import("@/app/api/padel/clubs/route").POST;
let DELETE: typeof import("@/app/api/padel/clubs/route").DELETE;

beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();

  createSupabaseServer.mockResolvedValue({});
  getUserWithPolicy.mockResolvedValue({
    data: { user: { id: "u-1" } },
  });
  getActiveOrganizationForUser.mockResolvedValue({
    organization: { id: 10 },
    membership: { role: "ADMIN", rolePack: null },
  });
  ensureMemberModuleAccess.mockResolvedValue({ ok: true });
  parseOrganizationId.mockReturnValue(10);
  resolveOrganizationIdFromParams.mockReturnValue(10);
  prisma.padelClub.findFirst.mockResolvedValue(null);
  prisma.address.findUnique.mockResolvedValue({
    id: "addr-1",
    formattedAddress: "Rua A",
    canonical: {},
    latitude: 0,
    longitude: 0,
    sourceProvider: null,
    sourceProviderPlaceId: null,
    confidenceScore: null,
    validationStatus: null,
  });
  prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
    typeof fn === "function" ? fn(prisma as unknown) : Promise.all(fn as Array<Promise<unknown>>),
  );
  prisma.padelTournamentConfig.count.mockResolvedValue(0);

  ({ POST, DELETE } = await import("@/app/api/padel/clubs/route"));
});

describe("padel clubs route contract", () => {
  it("retorna ADDRESS_REQUIRED quando falta morada", async () => {
    const req = new NextRequest("http://localhost/api/padel/clubs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ organizationId: 10, name: "Clube Teste" }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.errorCode ?? body.error).toBe("ADDRESS_REQUIRED");
  });

  it("retorna INVALID_ADDRESS quando morada não existe", async () => {
    prisma.address.findUnique.mockResolvedValueOnce(null);

    const req = new NextRequest("http://localhost/api/padel/clubs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        organizationId: 10,
        name: "Clube Teste",
        addressId: "addr-invalido",
      }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.errorCode ?? body.error).toBe("INVALID_ADDRESS");
  });

  it("retorna CLUB_IN_USE no delete quando clube já está associado a torneios", async () => {
    prisma.padelClub.findFirst.mockResolvedValueOnce({
      id: 5,
      organizationId: 10,
      deletedAt: null,
    });
    prisma.padelTournamentConfig.count.mockResolvedValueOnce(2);

    const req = new NextRequest("http://localhost/api/padel/clubs?id=5", { method: "DELETE" });
    const res = await DELETE(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.errorCode ?? body.error).toBe("CLUB_IN_USE");
  });
});
