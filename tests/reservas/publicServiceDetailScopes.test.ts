import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const prisma = vi.hoisted(() => ({
  service: { findFirst: vi.fn() },
  reservationProfessional: { findMany: vi.fn() },
  reservationResource: { findMany: vi.fn() },
  organizationPolicy: { findFirst: vi.fn() },
  courtBookingConfig: { findFirst: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/lib/organizationPayments", () => ({
  getPaidSalesGate: () => ({ ok: true }),
}));

function unwrapEnvelope(payload: Record<string, unknown>) {
  return (payload.result as Record<string, unknown> | undefined) ?? payload;
}

describe("GET /api/servicos/[id] - scope filters", () => {
  beforeEach(() => {
    vi.resetModules();
    prisma.service.findFirst.mockReset();
    prisma.reservationProfessional.findMany.mockReset();
    prisma.reservationResource.findMany.mockReset();
    prisma.organizationPolicy.findFirst.mockReset();
    prisma.courtBookingConfig.findFirst.mockReset();

    prisma.service.findFirst.mockResolvedValue({
      id: 50,
      policyId: 11,
      kind: "GENERAL",
      assignmentMode: "PROFESSIONAL_AND_RESOURCE",
      partySizeRequired: true,
      partySizeMin: 2,
      partySizeMax: 4,
      partySizeStep: 1,
      instructorId: null,
      title: "Serviço teste",
      description: "desc",
      durationMinutes: 60,
      unitPriceCents: 0,
      currency: "EUR",
      coverImageUrl: null,
      categoryId: 1,
      categoryTag: null,
      category: { id: 1, slug: "servicos", label: "Serviços", domain: "SERVICE" },
      locationMode: "FIXED",
      addressId: null,
      addressRef: null,
      professionalLinks: [
        { professionalId: 101, professional: { isActive: true } },
        { professionalId: 102, professional: { isActive: false } },
      ],
      resourceLinks: [
        { resourceId: 201, resource: { isActive: true } },
        { resourceId: 202, resource: { isActive: false } },
      ],
      policy: {
        id: 11,
        name: "Moderada",
        policyType: "MODERATE",
        cancellationWindowMinutes: 120,
        guestBookingAllowed: true,
      },
      instructor: null,
      organization: {
        id: 10,
        publicName: "Org",
        businessName: "Org Lda",
        username: "org",
        brandingAvatarUrl: null,
        publicDescription: null,
        publicWebsite: null,
        publicInstagram: null,
        timezone: "Europe/Lisbon",
        reservationAssignmentMode: "PROFESSIONAL_AND_RESOURCE",
        addressId: null,
        addressRef: null,
        orgType: "CLUB",
        stripeAccountId: null,
        stripeChargesEnabled: false,
        stripePayoutsEnabled: false,
        officialEmail: null,
        officialEmailVerifiedAt: null,
      },
      addons: [],
      packages: [],
      durationPrices: [],
    });
    prisma.reservationProfessional.findMany.mockResolvedValue([
      { id: 101, name: "Pro A", roleTitle: null, user: null },
    ]);
    prisma.reservationResource.findMany.mockResolvedValue([
      { id: 201, label: "Recurso A", capacity: 4, priority: 1, courtId: null },
    ]);
    prisma.courtBookingConfig.findFirst.mockResolvedValue(null);
  });

  it("filtra profissionais e recursos pelos links ativos do serviço", async () => {
    const { GET } = await import("@/app/api/servicos/[id]/route");
    const req = new NextRequest("http://localhost/api/servicos/50");
    const res = await GET(req, { params: Promise.resolve({ id: "50" }) });
    const raw = await res.json();
    const json = unwrapEnvelope(raw as Record<string, unknown>);
    const service = json.service as Record<string, unknown>;

    expect(res.status).toBe(200);
    expect(prisma.reservationProfessional.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: 10,
          isActive: true,
          id: { in: [101] },
        }),
      }),
    );
    expect(prisma.reservationResource.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: 10,
          isActive: true,
          id: { in: [201] },
        }),
      }),
    );
    expect(service.professionals).toHaveLength(1);
    expect(service.resources).toHaveLength(1);
  });
});
