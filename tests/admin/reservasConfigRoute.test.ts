import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const createSupabaseServer = vi.hoisted(() => vi.fn());
const ensureAuthenticated = vi.hoisted(() => vi.fn());
const isUnauthenticatedError = vi.hoisted(() => vi.fn(() => false));
const getActiveOrganizationForUser = vi.hoisted(() => vi.fn());
const resolveOrganizationIdFromRequest = vi.hoisted(() => vi.fn());
const ensureReservasModuleAccess = vi.hoisted(() => vi.fn());
const recordOrganizationAudit = vi.hoisted(() => vi.fn());

const prismaMock = vi.hoisted(() => ({
  profile: { findUnique: vi.fn() },
  organizationSettings: { findUnique: vi.fn(), upsert: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock("@/lib/supabaseServer", () => ({ createSupabaseServer }));
vi.mock("@/lib/security", () => ({ ensureAuthenticated, isUnauthenticatedError }));
vi.mock("@/lib/organizationContext", () => ({ getActiveOrganizationForUser }));
vi.mock("@/lib/organizationId", () => ({ resolveOrganizationIdFromRequest }));
vi.mock("@/lib/reservas/access", () => ({ ensureReservasModuleAccess }));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/organizationAudit", () => ({ recordOrganizationAudit }));

let GET: typeof import("@/app/api/org/[orgId]/reservas/config/route").GET;
let PATCH: typeof import("@/app/api/org/[orgId]/reservas/config/route").PATCH;

beforeEach(async () => {
  vi.resetModules();

  createSupabaseServer.mockReset();
  ensureAuthenticated.mockReset();
  isUnauthenticatedError.mockReset();
  getActiveOrganizationForUser.mockReset();
  resolveOrganizationIdFromRequest.mockReset();
  ensureReservasModuleAccess.mockReset();
  recordOrganizationAudit.mockReset();

  prismaMock.profile.findUnique.mockReset();
  prismaMock.organizationSettings.findUnique.mockReset();
  prismaMock.organizationSettings.upsert.mockReset();
  prismaMock.$transaction.mockReset();

  createSupabaseServer.mockResolvedValue({});
  ensureAuthenticated.mockResolvedValue({ id: "owner-1" });
  isUnauthenticatedError.mockReturnValue(false);
  resolveOrganizationIdFromRequest.mockReturnValue(77);

  prismaMock.profile.findUnique.mockResolvedValue({ id: "owner-1" });
  getActiveOrganizationForUser.mockResolvedValue({
    organization: { id: 77, timezone: "Europe/Lisbon" },
    membership: { role: "OWNER", rolePack: null },
  });
  ensureReservasModuleAccess.mockResolvedValue({ ok: true });

  prismaMock.organizationSettings.findUnique.mockResolvedValue({
    bookingGridMinutes: 30,
    bookingAllowedDurations: [60, 90],
    bookingAllowCustomDuration: false,
  });
  prismaMock.organizationSettings.upsert.mockResolvedValue({
    bookingGridMinutes: 30,
    bookingAllowedDurations: [60, 90],
    bookingAllowCustomDuration: false,
  });
  prismaMock.$transaction.mockImplementation(async (callback: (tx: typeof prismaMock) => unknown) => callback(prismaMock));

  recordOrganizationAudit.mockResolvedValue(undefined);

  const route = await import("@/app/api/org/[orgId]/reservas/config/route");
  GET = route.GET;
  PATCH = route.PATCH;
});

describe("/api/org/[orgId]/reservas/config", () => {
  it("devolve política canónica com catálogo 30/60/90/120", async () => {
    const req = new NextRequest("http://localhost/api/org/77/reservas/config", { method: "GET" });

    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data?.data).toEqual(
      expect.objectContaining({
        gridMinutes: 30,
        durationCatalog: [30, 60, 90, 120],
        activeDurations: [60, 90],
        allowedDurations: [60, 90],
        allowCustomDuration: false,
        presetDurations: [60, 90],
      }),
    );
  });

  it("recusa PATCH com allowCustomDuration=true", async () => {
    const req = new NextRequest("http://localhost/api/org/77/reservas/config", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        gridMinutes: 30,
        activeDurations: [60, 90],
        allowCustomDuration: true,
      }),
    });

    const res = await PATCH(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(body.errorCode).toBe("INVALID_BOOKING_CONFIG");
    expect(prismaMock.organizationSettings.upsert).not.toHaveBeenCalled();
  });

  it("guarda PATCH válido com activeDurations e força allowCustom=false", async () => {
    const req = new NextRequest("http://localhost/api/org/77/reservas/config", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        gridMinutes: 15,
        activeDurations: [30, 60],
      }),
    });

    prismaMock.organizationSettings.upsert.mockResolvedValueOnce({
      bookingGridMinutes: 15,
      bookingAllowedDurations: [30, 60],
      bookingAllowCustomDuration: false,
    });

    const res = await PATCH(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(prismaMock.organizationSettings.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          bookingGridMinutes: 15,
          bookingAllowedDurations: [30, 60],
          bookingAllowCustomDuration: false,
        }),
      }),
    );
    expect(body.data?.data).toEqual(
      expect.objectContaining({
        gridMinutes: 15,
        activeDurations: [30, 60],
        allowedDurations: [30, 60],
        allowCustomDuration: false,
        presetDurations: [30, 60],
      }),
    );
    expect(recordOrganizationAudit).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        organizationId: 77,
        action: "booking.config.updated",
      }),
    );
  });
});
