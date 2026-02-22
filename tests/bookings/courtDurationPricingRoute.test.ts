import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const createSupabaseServer = vi.hoisted(() => vi.fn());
const ensureAuthenticated = vi.hoisted(() => vi.fn());
const isUnauthenticatedError = vi.hoisted(() => vi.fn(() => false));
const getActiveOrganizationForUser = vi.hoisted(() => vi.fn());
const resolveOrganizationIdFromRequest = vi.hoisted(() => vi.fn());
const ensureReservasModuleAccess = vi.hoisted(() => vi.fn());
const ensureOrganizationWriteAccess = vi.hoisted(() => vi.fn());
const recordOrganizationAudit = vi.hoisted(() => vi.fn());

const prismaMock = vi.hoisted(() => ({
  profile: { findUnique: vi.fn() },
  service: { findFirst: vi.fn() },
  serviceDurationPrice: {
    findMany: vi.fn(),
    deleteMany: vi.fn(),
    createMany: vi.fn(),
  },
  organizationSettings: { findUnique: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock("@/lib/supabaseServer", () => ({ createSupabaseServer }));
vi.mock("@/lib/security", () => ({ ensureAuthenticated, isUnauthenticatedError }));
vi.mock("@/lib/organizationContext", () => ({ getActiveOrganizationForUser }));
vi.mock("@/lib/organizationId", () => ({ resolveOrganizationIdFromRequest }));
vi.mock("@/lib/reservas/access", () => ({ ensureReservasModuleAccess }));
vi.mock("@/lib/organizationWriteAccess", () => ({ ensureOrganizationWriteAccess }));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/organizationAudit", () => ({ recordOrganizationAudit }));

let GET: typeof import("@/app/api/org/[orgId]/servicos/[id]/duration-prices/route").GET;
let PUT: typeof import("@/app/api/org/[orgId]/servicos/[id]/duration-prices/route").PUT;

beforeEach(async () => {
  vi.resetModules();

  createSupabaseServer.mockReset();
  ensureAuthenticated.mockReset();
  isUnauthenticatedError.mockReset();
  getActiveOrganizationForUser.mockReset();
  resolveOrganizationIdFromRequest.mockReset();
  ensureReservasModuleAccess.mockReset();
  ensureOrganizationWriteAccess.mockReset();
  recordOrganizationAudit.mockReset();

  prismaMock.profile.findUnique.mockReset();
  prismaMock.service.findFirst.mockReset();
  prismaMock.serviceDurationPrice.findMany.mockReset();
  prismaMock.serviceDurationPrice.deleteMany.mockReset();
  prismaMock.serviceDurationPrice.createMany.mockReset();
  prismaMock.organizationSettings.findUnique.mockReset();
  prismaMock.$transaction.mockReset();

  createSupabaseServer.mockResolvedValue({});
  ensureAuthenticated.mockResolvedValue({ id: "owner-1" });
  isUnauthenticatedError.mockReturnValue(false);
  resolveOrganizationIdFromRequest.mockReturnValue(77);
  ensureReservasModuleAccess.mockResolvedValue({ ok: true });
  ensureOrganizationWriteAccess.mockReturnValue({ ok: true });
  recordOrganizationAudit.mockResolvedValue(undefined);

  prismaMock.profile.findUnique.mockResolvedValue({ id: "owner-1" });
  getActiveOrganizationForUser.mockResolvedValue({
    organization: { id: 77, timezone: "Europe/Lisbon" },
    membership: { role: "OWNER", rolePack: null },
  });
  prismaMock.organizationSettings.findUnique.mockResolvedValue({
    bookingGridMinutes: 30,
    bookingAllowedDurations: [60, 90],
    bookingAllowCustomDuration: false,
  });
  prismaMock.$transaction.mockImplementation(async (callback: (tx: typeof prismaMock) => unknown) => callback(prismaMock));

  const route = await import("@/app/api/org/[orgId]/servicos/[id]/duration-prices/route");
  GET = route.GET;
  PUT = route.PUT;
});

describe("/api/org/[orgId]/servicos/[id]/duration-prices", () => {
  it("GET devolve grelha de preços por duração", async () => {
    prismaMock.service.findFirst.mockResolvedValue({
      id: 901,
      kind: "COURT",
      currency: "EUR",
    });
    prismaMock.serviceDurationPrice.findMany.mockResolvedValue([
      { durationMinutes: 30, priceCents: 1200, isActive: true },
      { durationMinutes: 60, priceCents: 2400, isActive: true },
    ]);

    const req = new NextRequest("http://localhost/api/org/77/servicos/901/duration-prices", { method: "GET" });
    const res = await GET(req, { params: Promise.resolve({ id: "901" }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data?.data?.items).toHaveLength(2);
    expect(body.data?.data?.durationCatalog).toEqual([30, 60, 90, 120]);
  });

  it("PUT recusa quando falta preço para duração ativa", async () => {
    prismaMock.service.findFirst.mockResolvedValue({
      id: 901,
      kind: "COURT",
      currency: "EUR",
    });

    const req = new NextRequest("http://localhost/api/org/77/servicos/901/duration-prices", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        items: [{ durationMinutes: 60, priceCents: 2400, isActive: true }],
      }),
    });
    const res = await PUT(req, { params: Promise.resolve({ id: "901" }) });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(body.errorCode).toBe("MISSING_ACTIVE_DURATION_PRICE");
    expect(prismaMock.serviceDurationPrice.createMany).not.toHaveBeenCalled();
  });

  it("PUT substitui grelha e audita operação", async () => {
    prismaMock.service.findFirst.mockResolvedValue({
      id: 901,
      kind: "COURT",
      currency: "EUR",
    });

    const req = new NextRequest("http://localhost/api/org/77/servicos/901/duration-prices", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        items: [
          { durationMinutes: 30, priceCents: 1200, isActive: true },
          { durationMinutes: 60, priceCents: 2400, isActive: true },
          { durationMinutes: 90, priceCents: 3600, isActive: true },
        ],
      }),
    });
    const res = await PUT(req, { params: Promise.resolve({ id: "901" }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(prismaMock.serviceDurationPrice.deleteMany).toHaveBeenCalledWith({
      where: { serviceId: 901 },
    });
    expect(prismaMock.serviceDurationPrice.createMany).toHaveBeenCalled();
    expect(recordOrganizationAudit).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        action: "SERVICE_DURATION_PRICES_REPLACED",
      }),
    );
  });
});
