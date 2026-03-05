import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const createSupabaseServer = vi.hoisted(() => vi.fn());
const ensureAuthenticated = vi.hoisted(() => vi.fn());
const isUnauthenticatedError = vi.hoisted(() => vi.fn(() => false));
const getActiveOrganizationForUser = vi.hoisted(() => vi.fn());
const resolveOrganizationIdFromRequest = vi.hoisted(() => vi.fn());
const ensureReservasModuleAccess = vi.hoisted(() => vi.fn());
const ensureReservasOperationalOpen = vi.hoisted(() => vi.fn());
const getOrganizationBookingPolicy = vi.hoisted(() => vi.fn());
const validateStartAtAgainstPolicy = vi.hoisted(() => vi.fn());
const validateDurationAgainstPolicy = vi.hoisted(() => vi.fn());
const createBooking = vi.hoisted(() => vi.fn());
const recordOrganizationAudit = vi.hoisted(() => vi.fn());
const getAvailableSlotsForScope = vi.hoisted(() => vi.fn());
const evaluateCandidate = vi.hoisted(() => vi.fn(() => ({ allowed: true })));

const prisma = vi.hoisted(() => ({
  profile: { findUnique: vi.fn() },
  service: { findFirst: vi.fn() },
  reservationProfessional: { findFirst: vi.fn(), findMany: vi.fn() },
  reservationResource: { findFirst: vi.fn(), findMany: vi.fn(), findUnique: vi.fn() },
  courtBookingConfig: { findFirst: vi.fn() },
  padelClubCourt: { findFirst: vi.fn() },
  availabilitySchedule: { findMany: vi.fn() },
  weeklyAvailabilityTemplate: { findMany: vi.fn() },
  availabilityOverride: { findMany: vi.fn() },
  booking: { findMany: vi.fn() },
  agendaResourceClaim: { findMany: vi.fn() },
  classSession: { findMany: vi.fn() },
  address: { findUnique: vi.fn() },
  serviceDurationPrice: { findFirst: vi.fn() },
  $executeRaw: vi.fn(),
  $transaction: vi.fn(),
}));

vi.mock("@/lib/supabaseServer", () => ({ createSupabaseServer }));
vi.mock("@/lib/security", () => ({ ensureAuthenticated, isUnauthenticatedError }));
vi.mock("@/lib/organizationContext", () => ({ getActiveOrganizationForUser }));
vi.mock("@/lib/organizationId", () => ({ resolveOrganizationIdFromRequest }));
vi.mock("@/lib/reservas/access", () => ({ ensureReservasModuleAccess }));
vi.mock("@/lib/reservas/operationalState", () => ({ ensureReservasOperationalOpen }));
vi.mock("@/lib/reservas/gridPolicy", () => ({
  getOrganizationBookingPolicy,
  validateStartAtAgainstPolicy,
  validateDurationAgainstPolicy,
}));
vi.mock("@/domain/bookings/commands", () => ({ createBooking }));
vi.mock("@/lib/organizationAudit", () => ({ recordOrganizationAudit }));
vi.mock("@/lib/reservas/availabilitySelect", () => ({ getAvailableSlotsForScope }));
vi.mock("@/domain/agenda/conflictEngine", () => ({
  evaluateCandidate,
}));
vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/lib/http/withApiEnvelope", () => ({
  withApiEnvelope: (handler: unknown) => handler,
}));

let POST: typeof import("@/app/api/org/[orgId]/reservas/route").POST;

beforeEach(async () => {
  vi.resetModules();
  createSupabaseServer.mockReset();
  ensureAuthenticated.mockReset();
  isUnauthenticatedError.mockReset();
  getActiveOrganizationForUser.mockReset();
  resolveOrganizationIdFromRequest.mockReset();
  ensureReservasModuleAccess.mockReset();
  ensureReservasOperationalOpen.mockReset();
  getOrganizationBookingPolicy.mockReset();
  validateStartAtAgainstPolicy.mockReset();
  validateDurationAgainstPolicy.mockReset();
  createBooking.mockReset();
  recordOrganizationAudit.mockReset();
  getAvailableSlotsForScope.mockReset();
  evaluateCandidate.mockReset();
  prisma.profile.findUnique.mockReset();
  prisma.service.findFirst.mockReset();
  prisma.reservationProfessional.findFirst.mockReset();
  prisma.reservationProfessional.findMany.mockReset();
  prisma.reservationResource.findFirst.mockReset();
  prisma.reservationResource.findMany.mockReset();
  prisma.reservationResource.findUnique.mockReset();
  prisma.courtBookingConfig.findFirst.mockReset();
  prisma.padelClubCourt.findFirst.mockReset();
  prisma.availabilitySchedule.findMany.mockReset();
  prisma.weeklyAvailabilityTemplate.findMany.mockReset();
  prisma.availabilityOverride.findMany.mockReset();
  prisma.booking.findMany.mockReset();
  prisma.agendaResourceClaim.findMany.mockReset();
  prisma.classSession.findMany.mockReset();
  prisma.address.findUnique.mockReset();
  prisma.serviceDurationPrice.findFirst.mockReset();
  prisma.$executeRaw.mockReset();
  prisma.$transaction.mockReset();

  createSupabaseServer.mockResolvedValue({});
  ensureAuthenticated.mockResolvedValue({ id: "actor_user" });
  isUnauthenticatedError.mockReturnValue(false);
  resolveOrganizationIdFromRequest.mockReturnValue(21);
  getActiveOrganizationForUser.mockResolvedValue({
    organization: { id: 21 },
    membership: { role: "OWNER", rolePack: null },
  });
  ensureReservasModuleAccess.mockResolvedValue({ ok: true });
  ensureReservasOperationalOpen.mockResolvedValue({ ok: true });
  getOrganizationBookingPolicy.mockResolvedValue({ gridMinutes: 30, allowedDurations: [60, 90] });
  validateStartAtAgainstPolicy.mockReturnValue({ ok: true });
  validateDurationAgainstPolicy.mockReturnValue({ ok: true });
  getAvailableSlotsForScope.mockReturnValue([
    { startsAt: new Date("2030-01-01T10:00:00.000Z"), durationMinutes: 60 },
  ]);
  evaluateCandidate.mockReturnValue({ allowed: true });

  prisma.profile.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) => {
    if (where.id === "actor_user") return { id: "actor_user", contactPhone: "+351900000000" };
    if (where.id === "client_user") return { id: "client_user", contactPhone: "+351911111111" };
    return null;
  });
  prisma.reservationProfessional.findFirst.mockResolvedValue({ id: 55, priority: 1 });
  prisma.reservationProfessional.findMany.mockResolvedValue([]);
  prisma.reservationResource.findFirst.mockResolvedValue(null);
  prisma.reservationResource.findMany.mockResolvedValue([]);
  prisma.reservationResource.findUnique.mockResolvedValue({ courtId: null });
  prisma.courtBookingConfig.findFirst.mockResolvedValue(null);
  prisma.padelClubCourt.findFirst.mockResolvedValue(null);
  prisma.availabilitySchedule.findMany.mockResolvedValue([]);
  prisma.weeklyAvailabilityTemplate.findMany.mockResolvedValue([]);
  prisma.availabilityOverride.findMany.mockResolvedValue([]);
  prisma.booking.findMany.mockResolvedValue([]);
  prisma.agendaResourceClaim.findMany.mockResolvedValue([]);
  prisma.classSession.findMany.mockResolvedValue([]);
  prisma.address.findUnique.mockResolvedValue({ sourceProvider: "APPLE_MAPS" });
  prisma.serviceDurationPrice.findFirst.mockResolvedValue({
    durationMinutes: 60,
    priceCents: 4200,
    isActive: true,
  });
  prisma.$executeRaw.mockResolvedValue(undefined);
  prisma.$transaction.mockImplementation(async (fn: (tx: typeof prisma) => unknown) => await fn(prisma));

  createBooking.mockResolvedValue({
    booking: { id: 999, status: "PENDING_CONFIRMATION", pendingExpiresAt: new Date("2030-01-01T10:10:00.000Z") },
  });

  POST = (await import("@/app/api/org/[orgId]/reservas/route")).POST;
});

describe("POST /api/org/[orgId]/reservas", () => {
  it("usa preço canónico por duração em serviços COURT", async () => {
    prisma.service.findFirst.mockResolvedValue({
      id: 7,
      organizationId: 21,
      title: "Campo Central",
      kind: "COURT",
      assignmentMode: "RESOURCE_ONLY",
      partySizeRequired: false,
      partySizeMin: 1,
      partySizeMax: 1,
      partySizeStep: 1,
      durationMinutes: 60,
      unitPriceCents: 1000,
      currency: "EUR",
      locationMode: "FIXED",
      addressId: "addr_1",
      professionalLinks: [],
      resourceLinks: [{ resourceId: 77, resource: { isActive: true, courtId: 44 } }],
      organization: {
        timezone: "Europe/Lisbon",
        addressId: null,
        reservationAssignmentMode: "PROFESSIONAL_ONLY",
      },
    });
    prisma.reservationResource.findFirst.mockResolvedValue({
      id: 77,
      capacity: 4,
      priority: 1,
      courtId: 44,
    });
    prisma.courtBookingConfig.findFirst.mockResolvedValue({
      courtId: 44,
      displayName: "Campo Central",
      coverImageUrl: null,
      court: { name: "Campo Central" },
      backingService: null,
    });

    const req = new NextRequest("http://localhost/api/org/21/reservas", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        serviceId: 7,
        startsAt: "2030-01-01T10:00:00.000Z",
        userId: "client_user",
        resourceId: 77,
      }),
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(createBooking).toHaveBeenCalledTimes(1);
    expect(createBooking.mock.calls[0][0].data).toMatchObject({
      durationMinutes: 60,
      price: 4200,
    });
  });

  it("bloqueia durationMinutes override quando não é serviço COURT", async () => {
    prisma.service.findFirst.mockResolvedValue({
      id: 8,
      organizationId: 21,
      title: "Consulta Técnica",
      kind: "GENERAL",
      assignmentMode: "PROFESSIONAL_ONLY",
      partySizeRequired: false,
      partySizeMin: 1,
      partySizeMax: 1,
      partySizeStep: 1,
      durationMinutes: 60,
      unitPriceCents: 1500,
      currency: "EUR",
      locationMode: "FIXED",
      addressId: "addr_1",
      professionalLinks: [],
      resourceLinks: [],
      organization: {
        timezone: "Europe/Lisbon",
        addressId: null,
        reservationAssignmentMode: "PROFESSIONAL_ONLY",
      },
    });

    const req = new NextRequest("http://localhost/api/org/21/reservas", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        serviceId: 8,
        startsAt: "2030-01-01T10:00:00.000Z",
        userId: "client_user",
        professionalId: 55,
        durationMinutes: 90,
      }),
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(body.errorCode).toBe("INVALID_DURATION_OVERRIDE");
    expect(createBooking).not.toHaveBeenCalled();
  });
});
