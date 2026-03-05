import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const prisma = vi.hoisted(() => ({
  service: { findFirst: vi.fn() },
  reservationProfessional: { findMany: vi.fn() },
  reservationResource: { findMany: vi.fn() },
  organizationPolicy: { findFirst: vi.fn() },
  courtBookingConfig: { findMany: vi.fn() },
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
    prisma.courtBookingConfig.findMany.mockReset();

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
    prisma.courtBookingConfig.findMany.mockResolvedValue([]);
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

  it("sem courtId e com múltiplos campos COURT não escolhe campo arbitrário", async () => {
    prisma.service.findFirst.mockResolvedValueOnce({
      id: 70,
      policyId: 11,
      kind: "COURT",
      assignmentMode: "RESOURCE_ONLY",
      partySizeRequired: true,
      partySizeMin: 2,
      partySizeMax: 4,
      partySizeStep: 1,
      instructorId: null,
      title: "Campo base",
      description: "Descrição base",
      durationMinutes: 60,
      unitPriceCents: 2500,
      currency: "EUR",
      coverImageUrl: "/covers/base.jpg",
      categoryId: 1,
      categoryTag: null,
      category: { id: 1, slug: "campo", label: "Campo", domain: "COURT" },
      locationMode: "FIXED",
      addressId: null,
      addressRef: null,
      professionalLinks: [],
      resourceLinks: [],
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
        reservationAssignmentMode: "RESOURCE_ONLY",
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
    prisma.courtBookingConfig.findMany.mockResolvedValueOnce([
      {
        courtId: 12,
        displayName: "Campo A",
        displayDescription: "Indoor",
        coverImageUrl: "/covers/a.jpg",
        category: { id: 1, slug: "campo", label: "Campo", domain: "COURT" },
      },
      {
        courtId: 13,
        displayName: "Campo B",
        displayDescription: "Outdoor",
        coverImageUrl: "/covers/b.jpg",
        category: { id: 1, slug: "campo", label: "Campo", domain: "COURT" },
      },
    ]);
    prisma.reservationResource.findMany.mockResolvedValueOnce([
      { id: 301, label: "Campo A", capacity: 4, priority: 1, courtId: 12 },
      { id: 302, label: "Campo B", capacity: 4, priority: 2, courtId: 13 },
    ]);

    const { GET } = await import("@/app/api/servicos/[id]/route");
    const req = new NextRequest("http://localhost/api/servicos/70");
    const res = await GET(req, { params: Promise.resolve({ id: "70" }) });
    const raw = await res.json();
    const json = unwrapEnvelope(raw as Record<string, unknown>);
    const service = json.service as Record<string, unknown>;

    expect(res.status).toBe(200);
    expect(service.courtId).toBeNull();
    expect(service.title).toBe("Campo base");
    expect(service.description).toBe("Descrição base");
    expect(service.coverImageUrl).toBe("/covers/base.jpg");
  });

  it("com courtId devolve metadados do campo certo", async () => {
    prisma.service.findFirst.mockResolvedValueOnce({
      id: 71,
      policyId: 11,
      kind: "COURT",
      assignmentMode: "RESOURCE_ONLY",
      partySizeRequired: true,
      partySizeMin: 2,
      partySizeMax: 4,
      partySizeStep: 1,
      instructorId: null,
      title: "Campo base",
      description: "Descrição base",
      durationMinutes: 60,
      unitPriceCents: 2500,
      currency: "EUR",
      coverImageUrl: "/covers/base.jpg",
      categoryId: 1,
      categoryTag: null,
      category: { id: 1, slug: "campo", label: "Campo", domain: "COURT" },
      locationMode: "FIXED",
      addressId: null,
      addressRef: null,
      professionalLinks: [],
      resourceLinks: [],
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
        reservationAssignmentMode: "RESOURCE_ONLY",
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
    prisma.courtBookingConfig.findMany.mockResolvedValueOnce([
      {
        courtId: 12,
        displayName: "Campo A",
        displayDescription: "Indoor",
        coverImageUrl: "/covers/a.jpg",
        category: { id: 1, slug: "campo", label: "Campo", domain: "COURT" },
      },
      {
        courtId: 13,
        displayName: "Campo B",
        displayDescription: "Outdoor",
        coverImageUrl: "/covers/b.jpg",
        category: { id: 1, slug: "campo", label: "Campo", domain: "COURT" },
      },
    ]);
    prisma.reservationResource.findMany.mockResolvedValueOnce([
      { id: 302, label: "Campo B", capacity: 4, priority: 1, courtId: 13 },
    ]);

    const { GET } = await import("@/app/api/servicos/[id]/route");
    const req = new NextRequest("http://localhost/api/servicos/71?courtId=13");
    const res = await GET(req, { params: Promise.resolve({ id: "71" }) });
    const raw = await res.json();
    const json = unwrapEnvelope(raw as Record<string, unknown>);
    const service = json.service as Record<string, unknown>;

    expect(res.status).toBe(200);
    expect(service.courtId).toBe(13);
    expect(service.title).toBe("Campo B");
    expect(service.description).toBe("Outdoor");
    expect(service.coverImageUrl).toBe("/covers/b.jpg");
  });
});
