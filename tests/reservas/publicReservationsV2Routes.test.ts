import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const prismaOrganizationFindFirst = vi.hoisted(() => vi.fn());
const prismaServiceFindFirst = vi.hoisted(() => vi.fn());
const prismaServiceFindMany = vi.hoisted(() => vi.fn());
const prismaReservationProfessionalFindMany = vi.hoisted(() => vi.fn());
const prismaReservationResourceFindMany = vi.hoisted(() => vi.fn());
const prismaCourtBookingConfigFindFirst = vi.hoisted(() => vi.fn());
const prismaCourtBookingConfigFindMany = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({
  prisma: {
    organization: { findFirst: prismaOrganizationFindFirst },
    service: { findFirst: prismaServiceFindFirst, findMany: prismaServiceFindMany },
    reservationProfessional: { findMany: prismaReservationProfessionalFindMany },
    reservationResource: { findMany: prismaReservationResourceFindMany },
    courtBookingConfig: { findFirst: prismaCourtBookingConfigFindFirst, findMany: prismaCourtBookingConfigFindMany },
  },
}));

const unwrapEnvelope = <T extends Record<string, unknown>>(payload: T) =>
  (payload.result as Record<string, unknown> | undefined) ?? payload;

describe("Public reservas V2 routes", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.resetModules();
    prismaOrganizationFindFirst.mockReset();
    prismaServiceFindFirst.mockReset();
    prismaServiceFindMany.mockReset();
    prismaReservationProfessionalFindMany.mockReset();
    prismaReservationResourceFindMany.mockReset();
    prismaCourtBookingConfigFindFirst.mockReset();
    prismaCourtBookingConfigFindMany.mockReset();

    prismaOrganizationFindFirst.mockResolvedValue({
      id: 10,
      username: "top-padel",
      timezone: "Europe/Lisbon",
      settings: { bookingAcceptNewReservations: true },
      status: "ACTIVE",
      publicName: "Top Padel",
      businessName: "Top Padel Club",
      reservationAssignmentMode: "PROFESSIONAL_AND_RESOURCE",
      orgType: "CLUB",
      stripeAccountId: null,
      stripeChargesEnabled: false,
      stripePayoutsEnabled: false,
      officialEmail: null,
      officialEmailVerifiedAt: null,
    });
    prismaServiceFindFirst.mockResolvedValue({ id: 50 });
    prismaServiceFindMany.mockResolvedValue([]);
    prismaReservationProfessionalFindMany.mockResolvedValue([]);
    prismaReservationResourceFindMany.mockResolvedValue([]);
    prismaCourtBookingConfigFindFirst.mockResolvedValue(null);
    prismaCourtBookingConfigFindMany.mockResolvedValue([]);
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, result: {} }), {
        status: 200,
        headers: { "content-type": "application/json; charset=utf-8" },
      }),
    );
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("GET campos/calendario devolve COURT_CONFIG_MISSING quando mapping não existe", async () => {
    const { GET } = await import("@/app/api/public/org/[username]/reservas/campos/calendario/route");
    const req = new NextRequest("http://localhost/api/public/org/top-padel/reservas/campos/calendario?courtId=12");
    const res = await GET(req, { params: Promise.resolve({ username: "top-padel" }) });
    const json = unwrapEnvelope(await res.json());

    expect(res.status).toBe(409);
    expect(json.ok).toBe(false);
    expect(json.error).toBe("COURT_CONFIG_MISSING");
  });

  it("GET campos/calendario faz proxy para o serviceId interno com courtId", async () => {
    prismaCourtBookingConfigFindFirst.mockResolvedValueOnce({
      isActive: true,
      backingService: { id: 77, kind: "COURT", isActive: true },
    });
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify({ ok: true, result: { days: [] } }), {
        status: 200,
        headers: { "content-type": "application/json; charset=utf-8" },
      }),
    );

    const { GET } = await import("@/app/api/public/org/[username]/reservas/campos/calendario/route");
    const req = new NextRequest(
      "http://localhost/api/public/org/top-padel/reservas/campos/calendario?courtId=12&month=2026-03&serviceId=999",
    );
    const res = await GET(req, { params: Promise.resolve({ username: "top-padel" }) });
    const json = await res.json();
    const [url] = (global.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [URL | string];
    const calledUrl = String(url);

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(calledUrl).toContain("/api/servicos/77/calendario?");
    expect(calledUrl).toContain("courtId=12");
    expect(calledUrl).toContain("month=2026-03");
    expect(calledUrl).not.toContain("serviceId=999");
  });

  it("POST campos/reservar faz proxy com courtId e remove serviceId do payload", async () => {
    prismaCourtBookingConfigFindFirst.mockResolvedValueOnce({
      isActive: true,
      backingService: { id: 77, kind: "COURT", isActive: true },
    });
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify({ ok: true, result: { booking: { id: 1001 } } }), {
        status: 200,
        headers: { "content-type": "application/json; charset=utf-8" },
      }),
    );

    const { POST } = await import("@/app/api/public/org/[username]/reservas/campos/reservar/route");
    const req = new NextRequest("http://localhost/api/public/org/top-padel/reservas/campos/reservar", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        courtId: 12,
        serviceId: 999,
        startsAt: "2026-03-10T10:00:00.000Z",
      }),
    });
    const res = await POST(req, { params: Promise.resolve({ username: "top-padel" }) });
    const json = await res.json();
    const [url, init] = (global.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [
      URL | string,
      { body?: string }
    ];
    const calledUrl = String(url);
    const body = init?.body ? JSON.parse(init.body) : {};

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(calledUrl).toContain("/api/servicos/77/reservar");
    expect(body.courtId).toBe(12);
    expect(body.serviceId).toBeUndefined();
  });

  it("POST aulas/reservar devolve SERVICE_NOT_FOUND quando não existe aula válida", async () => {
    prismaServiceFindFirst.mockResolvedValueOnce(null);

    const { POST } = await import("@/app/api/public/org/[username]/reservas/aulas/reservar/route");
    const req = new NextRequest("http://localhost/api/public/org/top-padel/reservas/aulas/reservar", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        serviceId: 301,
        startsAt: "2026-03-10T10:00:00.000Z",
      }),
    });
    const res = await POST(req, { params: Promise.resolve({ username: "top-padel" }) });
    const json = unwrapEnvelope(await res.json());

    expect(res.status).toBe(404);
    expect(json.ok).toBe(false);
    expect(json.error).toBe("SERVICE_NOT_FOUND");
  });

  it("GET hub separa COURT/CLASS/SERVICE em secções distintas", async () => {
    prismaServiceFindMany.mockResolvedValueOnce([
      {
        id: 77,
        title: "Campo 1",
        description: "Court",
        kind: "COURT",
        durationMinutes: 90,
        unitPriceCents: 2000,
        currency: "EUR",
        categoryTag: "Campo",
        coverImageUrl: null,
        locationMode: "FIXED",
        addressId: null,
        addressRef: null,
        assignmentMode: "PROFESSIONAL_AND_RESOURCE",
        partySizeRequired: true,
        partySizeMin: 2,
        partySizeMax: 4,
        partySizeStep: 1,
        category: { id: 1, slug: "campo", label: "Campo", domain: "COURT" },
        durationPrices: [],
      },
      {
        id: 88,
        title: "Aula avançada",
        description: "Class",
        kind: "CLASS",
        durationMinutes: 60,
        unitPriceCents: 1500,
        currency: "EUR",
        categoryTag: "Aula",
        coverImageUrl: null,
        locationMode: "FIXED",
        addressId: null,
        addressRef: null,
        assignmentMode: "PROFESSIONAL_ONLY",
        partySizeRequired: false,
        partySizeMin: 1,
        partySizeMax: 8,
        partySizeStep: 1,
        category: { id: 2, slug: "aula", label: "Aula", domain: "CLASS" },
        durationPrices: [],
      },
      {
        id: 99,
        title: "Massagem desportiva",
        description: "Service",
        kind: "GENERAL",
        durationMinutes: 45,
        unitPriceCents: 1200,
        currency: "EUR",
        categoryTag: "Serviço",
        coverImageUrl: null,
        locationMode: "FIXED",
        addressId: null,
        addressRef: null,
        assignmentMode: "PROFESSIONAL_ONLY",
        partySizeRequired: false,
        partySizeMin: 1,
        partySizeMax: 1,
        partySizeStep: 1,
        category: { id: 3, slug: "servico", label: "Serviço", domain: "SERVICE" },
        durationPrices: [],
      },
    ]);
    prismaCourtBookingConfigFindMany.mockResolvedValueOnce([
      {
        id: 501,
        courtId: 12,
        backingServiceId: 77,
        categoryId: 1,
        displayName: "Campo Central",
        displayDescription: "Indoor",
        coverImageUrl: null,
        isActive: true,
        category: { id: 1, slug: "campo", label: "Campo", domain: "COURT" },
        court: { id: 12, name: "Campo 1", isActive: true },
      },
    ]);

    const { GET } = await import("@/app/api/public/org/[username]/reservas/hub/route");
    const req = new NextRequest("http://localhost/api/public/org/top-padel/reservas/hub");
    const res = await GET(req, { params: Promise.resolve({ username: "top-padel" }) });
    const raw = await res.json();
    const json = unwrapEnvelope(raw);
    const ok = (raw?.result?.ok as boolean | undefined) ?? (raw?.ok as boolean | undefined) ?? (json.ok as boolean | undefined);
    const sections = (json.sections as {
      courts: Array<{ id: number; serviceId: number }>;
      classes: Array<{ id: number }>;
      services: Array<{ id: number }>;
    }) ?? { courts: [], classes: [], services: [] };

    expect(res.status).toBe(200);
    expect(ok).toBe(true);
    expect(sections.courts).toHaveLength(1);
    expect(sections.courts[0]).toEqual(expect.objectContaining({ id: 12, serviceId: 77 }));
    expect(sections.classes.map((item) => item.id)).toEqual([88]);
    expect(sections.services.map((item) => item.id)).toEqual([99]);
  });
});
