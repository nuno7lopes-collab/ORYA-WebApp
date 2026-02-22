import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const getAvailableSlotsForScope = vi.hoisted(() => vi.fn());
const createBooking = vi.hoisted(() => vi.fn());
const recordOrganizationAudit = vi.hoisted(() => vi.fn());
const ingestCrmInteraction = vi.hoisted(() => vi.fn());

const prisma = vi.hoisted(() => ({
  service: { findFirst: vi.fn() },
  organizationSettings: { findUnique: vi.fn() },
  reservationProfessional: { findMany: vi.fn(), findFirst: vi.fn() },
  reservationResource: { findMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn() },
  availabilitySchedule: { findMany: vi.fn() },
  weeklyAvailabilityTemplate: { findMany: vi.fn() },
  availabilityOverride: { findMany: vi.fn() },
  booking: { findMany: vi.fn(), count: vi.fn() },
  classSession: { findMany: vi.fn() },
  serviceDurationPrice: { findFirst: vi.fn() },
  address: { findUnique: vi.fn() },
  bookingPackage: { create: vi.fn() },
  bookingAddon: { createMany: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/lib/reservas/availabilitySelect", () => ({ getAvailableSlotsForScope }));
vi.mock("@/domain/bookings/commands", () => ({ createBooking }));
vi.mock("@/lib/organizationAudit", () => ({ recordOrganizationAudit }));
vi.mock("@/lib/crm/ingest", () => ({ ingestCrmInteraction }));
vi.mock("@/lib/supabaseServer", () => ({
  createSupabaseServer: async () => ({
    auth: {
      getUser: async () => ({ data: { user: null }, error: null }),
    },
  }),
}));
vi.mock("@/lib/security", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/security")>();
  return {
    ...original,
    isUnauthenticatedError: () => false,
  };
});

function formatLisbonYmd(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Lisbon",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

beforeEach(() => {
  vi.resetModules();
  getAvailableSlotsForScope.mockReset();
  createBooking.mockReset();
  recordOrganizationAudit.mockReset();
  ingestCrmInteraction.mockReset();

  prisma.service.findFirst.mockReset();
  prisma.organizationSettings.findUnique.mockReset();
  prisma.reservationProfessional.findMany.mockReset();
  prisma.reservationProfessional.findFirst.mockReset();
  prisma.reservationResource.findMany.mockReset();
  prisma.reservationResource.findFirst.mockReset();
  prisma.reservationResource.findUnique.mockReset();
  prisma.availabilitySchedule.findMany.mockReset();
  prisma.weeklyAvailabilityTemplate.findMany.mockReset();
  prisma.availabilityOverride.findMany.mockReset();
  prisma.booking.findMany.mockReset();
  prisma.booking.count.mockReset();
  prisma.classSession.findMany.mockReset();
  prisma.serviceDurationPrice.findFirst.mockReset();
  prisma.address.findUnique.mockReset();
  prisma.bookingPackage.create.mockReset();
  prisma.bookingAddon.createMany.mockReset();
  prisma.$transaction.mockReset();

  prisma.availabilitySchedule.findMany.mockResolvedValue([]);
  prisma.weeklyAvailabilityTemplate.findMany.mockResolvedValue([]);
  prisma.availabilityOverride.findMany.mockResolvedValue([]);
  prisma.booking.findMany.mockResolvedValue([]);
  prisma.classSession.findMany.mockResolvedValue([]);
  prisma.organizationSettings.findUnique.mockResolvedValue({
    bookingGridMinutes: 30,
    bookingAllowedDurations: [60, 90],
    bookingAllowCustomDuration: false,
  });
  prisma.serviceDurationPrice.findFirst.mockImplementation(async ({ where }: { where?: { durationMinutes?: number } }) => ({
    durationMinutes: where?.durationMinutes ?? 60,
    priceCents: 0,
    isActive: true,
  }));
  prisma.booking.count.mockResolvedValue(0);
  prisma.address.findUnique.mockResolvedValue({ sourceProvider: "APPLE_MAPS" });
  prisma.$transaction.mockImplementation(async (fn: any) => fn(prisma));

  createBooking.mockResolvedValue({
    booking: { id: 123, status: "PENDING_CONFIRMATION", pendingExpiresAt: new Date("2030-01-01T10:10:00.000Z") },
  });
});

describe("GET /api/servicos/[id]/calendario (HYBRID)", () => {
  it("retorna slots apenas quando existe intersecao profissional+recurso", async () => {
    const day = formatLisbonYmd(new Date(Date.now() + 24 * 60 * 60 * 1000));
    const slot = new Date(`${day}T10:00:00.000Z`);
    prisma.service.findFirst.mockResolvedValue({
      id: 1,
      organizationId: 10,
      kind: "COURT",
      assignmentMode: "PROFESSIONAL_AND_RESOURCE",
      partySizeRequired: true,
      partySizeMin: 2,
      partySizeMax: 4,
      partySizeStep: 1,
      durationMinutes: 90,
      unitPriceCents: 0,
      currency: "EUR",
      locationMode: "FIXED",
      addressId: "addr_1",
      organization: {
        id: 10,
        status: "ACTIVE",
        timezone: "Europe/Lisbon",
        reservationAssignmentMode: null,
        orgType: "CLUB",
      },
      professionalLinks: [],
      resourceLinks: [],
    });
    prisma.reservationProfessional.findMany.mockResolvedValue([{ id: 1, priority: 1 }]);
    prisma.reservationResource.findMany.mockResolvedValue([{ id: 2, capacity: 4, priority: 1, courtId: 99 }]);

    getAvailableSlotsForScope.mockImplementation((args: any) => {
      if (args.scopeType === "PROFESSIONAL" && args.scopeId === 1) {
        return [{ startsAt: slot, durationMinutes: 90 }];
      }
      if (args.scopeType === "RESOURCE" && args.scopeId === 2) {
        return [{ startsAt: slot, durationMinutes: 90 }];
      }
      return [];
    });

    const { GET } = await import("@/app/api/servicos/[id]/calendario/route");
    const req = new NextRequest(`http://localhost/api/servicos/1/calendario?day=${day}&partySize=2`);
    const res = await GET(req, { params: Promise.resolve({ id: "1" }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.items.length).toBe(1);
    expect(body.items[0].startsAt).toBe(slot.toISOString());
  });

  it("filtra slots fora da grelha da organização", async () => {
    const day = formatLisbonYmd(new Date(Date.now() + 24 * 60 * 60 * 1000));
    const slot = new Date(`${day}T10:05:00.000Z`);
    prisma.service.findFirst.mockResolvedValue({
      id: 1,
      organizationId: 10,
      kind: "COURT",
      assignmentMode: "PROFESSIONAL_AND_RESOURCE",
      partySizeRequired: true,
      partySizeMin: 2,
      partySizeMax: 4,
      partySizeStep: 1,
      durationMinutes: 90,
      unitPriceCents: 0,
      currency: "EUR",
      locationMode: "FIXED",
      addressId: "addr_1",
      organization: {
        id: 10,
        status: "ACTIVE",
        timezone: "Europe/Lisbon",
        reservationAssignmentMode: null,
        orgType: "CLUB",
      },
      professionalLinks: [],
      resourceLinks: [],
    });
    prisma.reservationProfessional.findMany.mockResolvedValue([{ id: 1, priority: 1 }]);
    prisma.reservationResource.findMany.mockResolvedValue([{ id: 2, capacity: 4, priority: 1, courtId: 99 }]);

    getAvailableSlotsForScope.mockImplementation((args: any) => {
      if (args.scopeType === "PROFESSIONAL" && args.scopeId === 1) {
        return [{ startsAt: slot, durationMinutes: 90 }];
      }
      if (args.scopeType === "RESOURCE" && args.scopeId === 2) {
        return [{ startsAt: slot, durationMinutes: 90 }];
      }
      return [];
    });

    const { GET } = await import("@/app/api/servicos/[id]/calendario/route");
    const req = new NextRequest(`http://localhost/api/servicos/1/calendario?day=${day}&partySize=2`);
    const res = await GET(req, { params: Promise.resolve({ id: "1" }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.items).toEqual([]);
  });

  it("nao retorna slots quando nao existe par simultaneo", async () => {
    const day = formatLisbonYmd(new Date(Date.now() + 24 * 60 * 60 * 1000));
    const slot = new Date(`${day}T10:00:00.000Z`);
    const slotAlt = new Date(`${day}T10:05:00.000Z`);
    prisma.service.findFirst.mockResolvedValue({
      id: 1,
      organizationId: 10,
      kind: "COURT",
      assignmentMode: "PROFESSIONAL_AND_RESOURCE",
      partySizeRequired: true,
      partySizeMin: 2,
      partySizeMax: 4,
      partySizeStep: 1,
      durationMinutes: 90,
      unitPriceCents: 0,
      currency: "EUR",
      locationMode: "FIXED",
      addressId: "addr_1",
      organization: {
        id: 10,
        status: "ACTIVE",
        timezone: "Europe/Lisbon",
        reservationAssignmentMode: null,
        orgType: "CLUB",
      },
      professionalLinks: [],
      resourceLinks: [],
    });
    prisma.reservationProfessional.findMany.mockResolvedValue([{ id: 1, priority: 1 }]);
    prisma.reservationResource.findMany.mockResolvedValue([{ id: 2, capacity: 4, priority: 1, courtId: 99 }]);

    getAvailableSlotsForScope.mockImplementation((args: any) => {
      if (args.scopeType === "PROFESSIONAL" && args.scopeId === 1) {
        return [{ startsAt: slot, durationMinutes: 90 }];
      }
      if (args.scopeType === "RESOURCE" && args.scopeId === 2) {
        return [{ startsAt: slotAlt, durationMinutes: 90 }];
      }
      return [];
    });

    const { GET } = await import("@/app/api/servicos/[id]/calendario/route");
    const req = new NextRequest(`http://localhost/api/servicos/1/calendario?day=${day}&partySize=2`);
    const res = await GET(req, { params: Promise.resolve({ id: "1" }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.items).toEqual([]);
  });
});

describe("GET aliases /api/servicos/[id]/slots e /api/servicos/[id]/disponibilidade", () => {
  it("delegam para o calendário e devolvem items", async () => {
    const day = formatLisbonYmd(new Date(Date.now() + 24 * 60 * 60 * 1000));
    const slot = new Date(`${day}T11:00:00.000Z`);
    prisma.service.findFirst.mockResolvedValue({
      id: 1,
      organizationId: 10,
      kind: "COURT",
      assignmentMode: "PROFESSIONAL_AND_RESOURCE",
      partySizeRequired: true,
      partySizeMin: 2,
      partySizeMax: 4,
      partySizeStep: 1,
      durationMinutes: 90,
      unitPriceCents: 0,
      currency: "EUR",
      locationMode: "FIXED",
      addressId: "addr_1",
      organization: {
        id: 10,
        status: "ACTIVE",
        timezone: "Europe/Lisbon",
        reservationAssignmentMode: null,
        orgType: "CLUB",
      },
      professionalLinks: [],
      resourceLinks: [],
    });
    prisma.reservationProfessional.findMany.mockResolvedValue([{ id: 1, priority: 1 }]);
    prisma.reservationResource.findMany.mockResolvedValue([{ id: 2, capacity: 4, priority: 1, courtId: 99 }]);
    getAvailableSlotsForScope.mockImplementation((args: any) => {
      if (args.scopeType === "PROFESSIONAL" && args.scopeId === 1) {
        return [{ startsAt: slot, durationMinutes: 90 }];
      }
      if (args.scopeType === "RESOURCE" && args.scopeId === 2) {
        return [{ startsAt: slot, durationMinutes: 90 }];
      }
      return [];
    });

    const { GET: SlotsGet } = await import("@/app/api/servicos/[id]/slots/route");
    const slotsReq = new NextRequest(`http://localhost/api/servicos/1/slots?day=${day}&partySize=2`);
    const slotsRes = await SlotsGet(slotsReq, { params: Promise.resolve({ id: "1" }) });
    const slotsBody = await slotsRes.json();

    expect(slotsRes.status).toBe(200);
    expect(slotsBody.ok).toBe(true);
    expect(slotsBody.items.length).toBe(1);
    expect(slotsBody.items[0].startsAt).toBe(slot.toISOString());

    const { GET: DisponibilidadeGet } = await import("@/app/api/servicos/[id]/disponibilidade/route");
    const disponibilidadeReq = new NextRequest(
      `http://localhost/api/servicos/1/disponibilidade?day=${day}&partySize=2`,
    );
    const disponibilidadeRes = await DisponibilidadeGet(disponibilidadeReq, {
      params: Promise.resolve({ id: "1" }),
    });
    const disponibilidadeBody = await disponibilidadeRes.json();

    expect(disponibilidadeRes.status).toBe(200);
    expect(disponibilidadeBody.ok).toBe(true);
    expect(disponibilidadeBody.items.length).toBe(1);
    expect(disponibilidadeBody.items[0].startsAt).toBe(slot.toISOString());
  });
});

describe("POST /api/servicos/[id]/reservar (HYBRID)", () => {
  it("cria booking com professionalId e resourceId", async () => {
    const day = formatLisbonYmd(new Date(Date.now() + 24 * 60 * 60 * 1000));
    const slot = new Date(`${day}T10:00:00.000Z`);
    prisma.service.findFirst.mockResolvedValue({
      id: 1,
      organizationId: 10,
      kind: "COURT",
      assignmentMode: "PROFESSIONAL_AND_RESOURCE",
      partySizeRequired: true,
      partySizeMin: 2,
      partySizeMax: 4,
      partySizeStep: 1,
      durationMinutes: 90,
      unitPriceCents: 0,
      currency: "EUR",
      locationMode: "FIXED",
      addressId: "addr_1",
      policy: { guestBookingAllowed: true },
      organization: {
        id: 10,
        status: "ACTIVE",
        timezone: "Europe/Lisbon",
        reservationAssignmentMode: null,
        orgType: "CLUB",
        officialEmail: null,
        officialEmailVerifiedAt: null,
        stripeAccountId: null,
        stripeChargesEnabled: false,
        stripePayoutsEnabled: false,
        addressId: "addr_1",
      },
      professionalLinks: [],
      resourceLinks: [],
    });
    prisma.reservationProfessional.findMany.mockResolvedValue([{ id: 1, priority: 1 }]);
    prisma.reservationResource.findMany.mockResolvedValue([{ id: 2, capacity: 4, priority: 1, courtId: 99 }]);

    getAvailableSlotsForScope.mockImplementation((args: any) => {
      if (args.scopeType === "PROFESSIONAL" && args.scopeId === 1) {
        return [{ startsAt: slot, durationMinutes: 90 }];
      }
      if (args.scopeType === "RESOURCE" && args.scopeId === 2) {
        return [{ startsAt: slot, durationMinutes: 90 }];
      }
      return [];
    });

    const { POST } = await import("@/app/api/servicos/[id]/reservar/route");
    const req = new NextRequest("http://localhost/api/servicos/1/reservar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startsAt: slot.toISOString(),
        partySize: 2,
        guest: { name: "Guest", email: "guest@example.com", phone: "+351912345678", consent: true },
      }),
    });
    const res = await POST(req, { params: Promise.resolve({ id: "1" }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(createBooking).toHaveBeenCalledTimes(1);
    const args = createBooking.mock.calls[0]?.[0];
    expect(args?.data?.professionalId).toBe(1);
    expect(args?.data?.resourceId).toBe(2);
    expect(args?.data?.courtId).toBe(99);
  });
});
