import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const createSupabaseServer = vi.hoisted(() => vi.fn());
const ensureAuthenticated = vi.hoisted(() => vi.fn());
const isUnauthenticatedError = vi.hoisted(() => vi.fn(() => false));
const getActiveOrganizationForUser = vi.hoisted(() => vi.fn());
const resolveOrganizationIdFromRequest = vi.hoisted(() => vi.fn());
const ensureReservasModuleAccess = vi.hoisted(() => vi.fn());
const recordOrganizationAudit = vi.hoisted(() => vi.fn());

const prisma = vi.hoisted(() => ({
  profile: { findUnique: vi.fn() },
  reservationProfessional: { findFirst: vi.fn() },
  reservationResource: { findFirst: vi.fn() },
  availabilitySchedule: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
  weeklyAvailabilityTemplate: { findMany: vi.fn(), createMany: vi.fn(), upsert: vi.fn() },
  availabilityOverride: { findMany: vi.fn(), create: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock("@/lib/supabaseServer", () => ({ createSupabaseServer }));
vi.mock("@/lib/security", () => ({ ensureAuthenticated, isUnauthenticatedError }));
vi.mock("@/lib/organizationContext", () => ({ getActiveOrganizationForUser }));
vi.mock("@/lib/organizationId", () => ({ resolveOrganizationIdFromRequest }));
vi.mock("@/lib/reservas/access", () => ({ ensureReservasModuleAccess }));
vi.mock("@/lib/organizationAudit", () => ({ recordOrganizationAudit }));
vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/lib/http/withApiEnvelope", () => ({
  withApiEnvelope: (handler: unknown) => handler,
}));

let POST: typeof import("@/app/api/org/[orgId]/reservas/disponibilidade/route").POST;

beforeEach(async () => {
  vi.resetModules();
  createSupabaseServer.mockReset();
  ensureAuthenticated.mockReset();
  isUnauthenticatedError.mockReset();
  getActiveOrganizationForUser.mockReset();
  resolveOrganizationIdFromRequest.mockReset();
  ensureReservasModuleAccess.mockReset();
  recordOrganizationAudit.mockReset();
  prisma.profile.findUnique.mockReset();
  prisma.reservationProfessional.findFirst.mockReset();
  prisma.reservationResource.findFirst.mockReset();
  prisma.availabilitySchedule.findMany.mockReset();
  prisma.availabilitySchedule.findFirst.mockReset();
  prisma.availabilitySchedule.create.mockReset();
  prisma.availabilitySchedule.update.mockReset();
  prisma.availabilitySchedule.delete.mockReset();
  prisma.weeklyAvailabilityTemplate.findMany.mockReset();
  prisma.weeklyAvailabilityTemplate.createMany.mockReset();
  prisma.weeklyAvailabilityTemplate.upsert.mockReset();
  prisma.availabilityOverride.findMany.mockReset();
  prisma.availabilityOverride.create.mockReset();
  prisma.$transaction.mockReset();

  isUnauthenticatedError.mockReturnValue(false);
  createSupabaseServer.mockResolvedValue({});
  ensureAuthenticated.mockResolvedValue({ id: "user-1" });
  resolveOrganizationIdFromRequest.mockReturnValue(21);
  ensureReservasModuleAccess.mockResolvedValue({ ok: true });
  getActiveOrganizationForUser.mockResolvedValue({
    organization: { id: 21, timezone: "Europe/Lisbon" },
    membership: { role: "OWNER" },
  });
  prisma.profile.findUnique.mockResolvedValue({ id: "user-1" });
  prisma.availabilitySchedule.findFirst.mockResolvedValue(null);
  prisma.$transaction.mockImplementation(async (fn: any) => fn(prisma));

  POST = (await import("@/app/api/org/[orgId]/reservas/disponibilidade/route")).POST;
});

describe("POST /api/org/[orgId]/reservas/disponibilidade", () => {
  it("bloqueia writes diretos e exige changeset", async () => {
    const req = new NextRequest("http://localhost/api/org/21/reservas/disponibilidade", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        mode: "SCHEDULE",
        scopeType: "ORGANIZATION",
        startDate: "2099-02-01",
        cloneFromScheduleId: 9999,
      }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.ok).toBe(false);
    expect(body.errorCode).toBe("AVAILABILITY_CHANGESET_REQUIRED");
    expect(prisma.availabilitySchedule.create).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
