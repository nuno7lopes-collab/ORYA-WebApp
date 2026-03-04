import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const createSupabaseServer = vi.hoisted(() => vi.fn());
const ensureAuthenticated = vi.hoisted(() => vi.fn());
const isUnauthenticatedError = vi.hoisted(() => vi.fn(() => false));
const getActiveOrganizationForUser = vi.hoisted(() => vi.fn());
const resolveOrganizationIdFromRequest = vi.hoisted(() => vi.fn());
const ensureReservasModuleAccess = vi.hoisted(() => vi.fn());
const ensureOrganizationWriteAccess = vi.hoisted(() => vi.fn());
const getOrganizationBookingPolicy = vi.hoisted(() => vi.fn());
const validateStartMinuteAgainstPolicy = vi.hoisted(() => vi.fn());
const validateClassSessionsAgainstAvailability = vi.hoisted(() => vi.fn());

const prisma = vi.hoisted(() => ({
  profile: { findUnique: vi.fn() },
  service: { findFirst: vi.fn() },
  classSeries: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  classSession: { createMany: vi.fn(), updateMany: vi.fn(), findMany: vi.fn(), update: vi.fn() },
  reservationProfessional: { findFirst: vi.fn() },
  padelClubCourt: { findFirst: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock("@/lib/supabaseServer", () => ({ createSupabaseServer }));
vi.mock("@/lib/security", () => ({ ensureAuthenticated, isUnauthenticatedError }));
vi.mock("@/lib/organizationContext", () => ({ getActiveOrganizationForUser }));
vi.mock("@/lib/organizationId", () => ({ resolveOrganizationIdFromRequest }));
vi.mock("@/lib/reservas/access", () => ({ ensureReservasModuleAccess }));
vi.mock("@/lib/organizationWriteAccess", () => ({ ensureOrganizationWriteAccess }));
vi.mock("@/lib/reservas/gridPolicy", () => ({
  getOrganizationBookingPolicy,
  validateStartMinuteAgainstPolicy,
}));
vi.mock("@/lib/reservas/classSeriesAvailability", () => ({
  validateClassSessionsAgainstAvailability,
}));
vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/lib/http/withApiEnvelope", () => ({
  withApiEnvelope: (handler: unknown) => handler,
}));

let POST_SERIES: typeof import("@/app/api/org/[orgId]/servicos/[id]/class-series/route").POST;
let PATCH_SERIES: typeof import("@/app/api/org/[orgId]/servicos/[id]/class-series/[seriesId]/route").PATCH;

beforeEach(async () => {
  vi.resetModules();
  createSupabaseServer.mockReset();
  ensureAuthenticated.mockReset();
  isUnauthenticatedError.mockReset();
  getActiveOrganizationForUser.mockReset();
  resolveOrganizationIdFromRequest.mockReset();
  ensureReservasModuleAccess.mockReset();
  ensureOrganizationWriteAccess.mockReset();
  getOrganizationBookingPolicy.mockReset();
  validateStartMinuteAgainstPolicy.mockReset();
  validateClassSessionsAgainstAvailability.mockReset();
  prisma.profile.findUnique.mockReset();
  prisma.service.findFirst.mockReset();
  prisma.classSeries.findFirst.mockReset();
  prisma.classSeries.create.mockReset();
  prisma.classSeries.update.mockReset();
  prisma.classSession.createMany.mockReset();
  prisma.classSession.updateMany.mockReset();
  prisma.classSession.findMany.mockReset();
  prisma.classSession.update.mockReset();
  prisma.reservationProfessional.findFirst.mockReset();
  prisma.padelClubCourt.findFirst.mockReset();
  prisma.$transaction.mockReset();

  createSupabaseServer.mockResolvedValue({});
  ensureAuthenticated.mockResolvedValue({ id: "actor_user" });
  isUnauthenticatedError.mockReturnValue(false);
  resolveOrganizationIdFromRequest.mockReturnValue(21);
  getActiveOrganizationForUser.mockResolvedValue({
    organization: { id: 21 },
    membership: { role: "OWNER" },
  });
  ensureReservasModuleAccess.mockResolvedValue({ ok: true });
  ensureOrganizationWriteAccess.mockReturnValue({ ok: true });
  getOrganizationBookingPolicy.mockResolvedValue({ gridMinutes: 30, allowedDurations: [60, 90] });
  validateStartMinuteAgainstPolicy.mockReturnValue({ ok: true });
  validateClassSessionsAgainstAvailability.mockResolvedValue({ ok: true });
  prisma.profile.findUnique.mockResolvedValue({ id: "actor_user" });
  prisma.reservationProfessional.findFirst.mockResolvedValue({ id: 88 });
  prisma.padelClubCourt.findFirst.mockResolvedValue({ id: 44 });
  prisma.classSession.findMany.mockResolvedValue([]);
  prisma.classSeries.create.mockResolvedValue({ id: 501 });
  prisma.classSeries.update.mockResolvedValue({ id: 777 });
  prisma.classSession.createMany.mockResolvedValue({ count: 0 });
  prisma.classSession.updateMany.mockResolvedValue({ count: 0 });
  prisma.classSession.update.mockResolvedValue({ id: 1 });
  prisma.$transaction.mockImplementation(async (fn: (tx: typeof prisma) => unknown) => await fn(prisma));

  POST_SERIES = (await import("@/app/api/org/[orgId]/servicos/[id]/class-series/route")).POST;
  PATCH_SERIES = (await import("@/app/api/org/[orgId]/servicos/[id]/class-series/[seriesId]/route")).PATCH;
});

describe("class-series routes regression", () => {
  it("POST cria série dentro de transação", async () => {
    prisma.service.findFirst.mockResolvedValue({
      id: 11,
      kind: "CLASS",
      organization: { timezone: "Europe/Lisbon" },
    });

    const req = new NextRequest("http://localhost/api/org/21/servicos/11/class-series", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        dayOfWeek: 2,
        startMinute: 600,
        durationMinutes: 60,
        capacity: 4,
        validFrom: "2030-01-01",
        validUntil: null,
        isActive: false,
      }),
    });
    const res = await POST_SERIES(req, { params: Promise.resolve({ id: "11" }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.classSeries.create).toHaveBeenCalledTimes(1);
  });

  it("POST devolve CLASS_SLOT_UNAVAILABLE quando a disponibilidade falha", async () => {
    prisma.service.findFirst.mockResolvedValue({
      id: 11,
      kind: "CLASS",
      organization: { timezone: "Europe/Lisbon" },
    });
    validateClassSessionsAgainstAvailability.mockResolvedValue({
      ok: false,
      conflict: {
        date: "2030-01-08",
        start: "11:00",
        end: "12:00",
        reason: "outside_scope_availability",
        scopeType: "PROFESSIONAL",
        scopeId: 88,
      },
    });

    const req = new NextRequest("http://localhost/api/org/21/servicos/11/class-series", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        dayOfWeek: 2,
        startMinute: 660,
        durationMinutes: 60,
        capacity: 4,
        validFrom: "2026-03-01",
        validUntil: null,
        professionalId: 88,
        isActive: true,
      }),
    });
    const res = await POST_SERIES(req, { params: Promise.resolve({ id: "11" }) });
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.ok).toBe(false);
    expect(body.errorCode).toBe("CLASS_SLOT_UNAVAILABLE");
    expect(prisma.classSeries.create).not.toHaveBeenCalled();
  });

  it("PATCH permite limpar professionalId/courtId com null explícito", async () => {
    prisma.classSeries.findFirst.mockResolvedValue({
      id: 777,
      serviceId: 11,
      organizationId: 21,
      dayOfWeek: 2,
      startMinute: 600,
      durationMinutes: 60,
      capacity: 4,
      validFrom: new Date("2030-01-01T00:00:00.000Z"),
      validUntil: null,
      professionalId: 88,
      courtId: 44,
      isActive: true,
      service: { kind: "CLASS", organization: { timezone: "Europe/Lisbon" } },
    });

    const req = new NextRequest("http://localhost/api/org/21/servicos/11/class-series/777", {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-orya-academy-bridge": "1" },
      body: JSON.stringify({
        professionalId: null,
        courtId: null,
        isActive: false,
      }),
    });
    const res = await PATCH_SERIES(req, { params: Promise.resolve({ id: "11", seriesId: "777" }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.classSeries.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          professionalId: null,
          courtId: null,
        }),
      }),
    );
  });
});
