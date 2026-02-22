import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const createSupabaseServer = vi.hoisted(() => vi.fn());
const ensureAuthenticated = vi.hoisted(() => vi.fn());
const isUnauthenticatedError = vi.hoisted(() => vi.fn(() => false));
const getUserWithPolicy = vi.hoisted(() => vi.fn());
const getActiveOrganizationForUser = vi.hoisted(() => vi.fn());
const resolveOrganizationIdFromRequest = vi.hoisted(() => vi.fn());
const parseOrganizationId = vi.hoisted(() => vi.fn());
const ensureMemberModuleAccess = vi.hoisted(() => vi.fn());
const ensureOrganizationWriteAccess = vi.hoisted(() => vi.fn());
const ensureOrganizationEmailVerified = vi.hoisted(() => vi.fn());
const ensureReservasModuleAccess = vi.hoisted(() => vi.fn());
const getEffectiveOrganizationMember = vi.hoisted(() => vi.fn());
const listEffectiveOrganizationMembers = vi.hoisted(() => vi.fn());
const createNotification = vi.hoisted(() => vi.fn());
const getAgendaItemsForOrganization = vi.hoisted(() => vi.fn());
const buildClassSessionsForSeries = vi.hoisted(() => vi.fn());
const getAvailableSlotsForScopeMock = vi.hoisted(() =>
  vi.fn((params: any) => {
    const startsAt = new Date("2026-03-03T10:00:00.000Z");
    const endsAt = new Date(startsAt.getTime() + params.durationMinutes * 60 * 1000);
    const hasConflict = (params.blocks ?? []).some((block: any) => {
      if (params.scopeType === "PROFESSIONAL" && block.professionalId !== params.scopeId) return false;
      return startsAt < block.end && endsAt > block.start;
    });
    if (hasConflict) return [];
    return [{ startsAt, durationMinutes: params.durationMinutes }];
  }),
);

const prismaMock = vi.hoisted(() => ({
  profile: { findUnique: vi.fn() },
  trainerProfile: { findUnique: vi.fn(), upsert: vi.fn(), update: vi.fn(), findMany: vi.fn() },
  reservationProfessional: { upsert: vi.fn(), findFirst: vi.fn(), findMany: vi.fn() },
  service: { findFirst: vi.fn() },
  organizationSettings: { findUnique: vi.fn() },
  classSeries: { create: vi.fn() },
  classSession: { createMany: vi.fn(), findMany: vi.fn() },
  padelClub: { findFirst: vi.fn() },
  padelClubCourt: { findFirst: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock("@/lib/supabaseServer", () => ({ createSupabaseServer }));
vi.mock("@/lib/security", () => ({ ensureAuthenticated, isUnauthenticatedError }));
vi.mock("@/lib/auth/getUserWithPolicy", () => ({ getUserWithPolicy }));
vi.mock("@/lib/organizationContext", () => ({ getActiveOrganizationForUser }));
vi.mock("@/lib/organizationId", () => ({ resolveOrganizationIdFromRequest, parseOrganizationId }));
vi.mock("@/lib/organizationMemberAccess", () => ({ ensureMemberModuleAccess }));
vi.mock("@/lib/organizationWriteAccess", () => ({ ensureOrganizationWriteAccess, ensureOrganizationEmailVerified }));
vi.mock("@/lib/reservas/access", () => ({ ensureReservasModuleAccess }));
vi.mock("@/lib/organizationMembers", () => ({ getEffectiveOrganizationMember, listEffectiveOrganizationMembers }));
vi.mock("@/lib/notifications", () => ({ createNotification }));
vi.mock("@/domain/agendaReadModel/query", () => ({ getAgendaItemsForOrganization }));
vi.mock("@/lib/reservas/classSeries", () => ({ buildClassSessionsForSeries }));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/reservas/availabilitySelect", () => ({
  getAvailableSlotsForScope: getAvailableSlotsForScopeMock,
}));

let trainersPATCH: typeof import("@/app/api/org/[orgId]/trainers/route").PATCH;
let classSeriesPOST: typeof import("@/app/api/org/[orgId]/servicos/[id]/class-series/route").POST;
let agendaGET: typeof import("@/app/api/org/[orgId]/agenda/route").GET;
let confirmPendingBooking: typeof import("@/lib/reservas/confirmBooking").confirmPendingBooking;

const createdClassSessions: Array<{
  organizationId: number;
  serviceId: number;
  courtId: number | null;
  professionalId: number | null;
  startsAt: Date;
  endsAt: Date;
  capacity: number;
  status: string;
}> = [];

beforeEach(async () => {
  vi.resetModules();

  createdClassSessions.length = 0;

  createSupabaseServer.mockReset();
  ensureAuthenticated.mockReset();
  isUnauthenticatedError.mockReset();
  getUserWithPolicy.mockReset();
  getActiveOrganizationForUser.mockReset();
  resolveOrganizationIdFromRequest.mockReset();
  parseOrganizationId.mockReset();
  ensureMemberModuleAccess.mockReset();
  ensureOrganizationWriteAccess.mockReset();
  ensureOrganizationEmailVerified.mockReset();
  ensureReservasModuleAccess.mockReset();
  getEffectiveOrganizationMember.mockReset();
  listEffectiveOrganizationMembers.mockReset();
  createNotification.mockReset();
  getAgendaItemsForOrganization.mockReset();
  buildClassSessionsForSeries.mockReset();
  getAvailableSlotsForScopeMock.mockClear();

  prismaMock.profile.findUnique.mockReset();
  prismaMock.trainerProfile.findUnique.mockReset();
  prismaMock.trainerProfile.upsert.mockReset();
  prismaMock.trainerProfile.update.mockReset();
  prismaMock.trainerProfile.findMany.mockReset();
  prismaMock.reservationProfessional.upsert.mockReset();
  prismaMock.reservationProfessional.findFirst.mockReset();
  prismaMock.reservationProfessional.findMany.mockReset();
  prismaMock.service.findFirst.mockReset();
  prismaMock.organizationSettings.findUnique.mockReset();
  prismaMock.classSeries.create.mockReset();
  prismaMock.classSession.createMany.mockReset();
  prismaMock.classSession.findMany.mockReset();
  prismaMock.padelClub.findFirst.mockReset();
  prismaMock.padelClubCourt.findFirst.mockReset();
  prismaMock.$transaction.mockReset();

  createSupabaseServer.mockResolvedValue({});
  ensureAuthenticated.mockResolvedValue({ id: "owner-1" });
  isUnauthenticatedError.mockReturnValue(false);
  getUserWithPolicy.mockResolvedValue({ data: { user: { id: "owner-1" } }, error: null });

  resolveOrganizationIdFromRequest.mockReturnValue(77);
  parseOrganizationId.mockImplementation((value: unknown) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  });

  getActiveOrganizationForUser.mockResolvedValue({
    organization: { id: 77, publicName: "ORYA Club", timezone: "Europe/Lisbon" },
    membership: { role: "OWNER", rolePack: null },
  });

  ensureMemberModuleAccess.mockResolvedValue({ ok: true });
  ensureOrganizationWriteAccess.mockReturnValue({ ok: true });
  ensureOrganizationEmailVerified.mockReturnValue({ ok: true });
  ensureReservasModuleAccess.mockResolvedValue({ ok: true });
  getEffectiveOrganizationMember.mockResolvedValue({ userId: "coach-1", role: "STAFF", rolePack: null });
  listEffectiveOrganizationMembers.mockResolvedValue([]);
  createNotification.mockResolvedValue(undefined);

  prismaMock.profile.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) => ({
    id: where.id,
    fullName: where.id === "coach-1" ? "Coach One" : "Owner One",
    username: where.id === "coach-1" ? "coach_one" : "owner_one",
  }));
  prismaMock.trainerProfile.findUnique.mockResolvedValue({
    id: 500,
    reviewStatus: "DRAFT",
    reservationProfessionalId: null,
  });
  prismaMock.trainerProfile.upsert.mockResolvedValue({
    id: 500,
    organizationId: 77,
    userId: "coach-1",
    reviewStatus: "APPROVED",
    reservationProfessionalId: null,
    isPublished: true,
  });
  prismaMock.trainerProfile.update.mockResolvedValue({
    id: 500,
    organizationId: 77,
    userId: "coach-1",
    reviewStatus: "APPROVED",
    reservationProfessionalId: 700,
    isPublished: true,
  });
  prismaMock.reservationProfessional.upsert.mockResolvedValue({ id: 700, isActive: true });

  prismaMock.service.findFirst.mockResolvedValue({
    id: 901,
    kind: "CLASS",
    organization: { timezone: "Europe/Lisbon" },
  });
  prismaMock.organizationSettings.findUnique.mockResolvedValue({
    bookingGridMinutes: 30,
    bookingAllowedDurations: [60, 90],
    bookingAllowCustomDuration: false,
  });
  prismaMock.reservationProfessional.findFirst.mockResolvedValue({ id: 700 });
  prismaMock.padelClubCourt.findFirst.mockResolvedValue({ id: 44, padelClubId: 9 });
  prismaMock.classSeries.create.mockResolvedValue({
    id: 800,
    organizationId: 77,
    serviceId: 901,
    dayOfWeek: 2,
    startMinute: 600,
    durationMinutes: 60,
    capacity: 8,
    isActive: true,
  });
  prismaMock.classSession.createMany.mockImplementation(async ({ data }: { data: typeof createdClassSessions }) => {
    createdClassSessions.push(...data);
    return { count: data.length };
  });

  buildClassSessionsForSeries.mockReturnValue([
    {
      startsAt: new Date("2026-03-03T10:00:00.000Z"),
      endsAt: new Date("2026-03-03T11:00:00.000Z"),
    },
  ]);

  getAgendaItemsForOrganization.mockImplementation(async () =>
    createdClassSessions.map((session, idx) => ({
      id: `class-${idx + 1}`,
      sourceType: "CLASS_SESSION",
      title: "Aula recorrente",
      startsAt: session.startsAt,
      endsAt: session.endsAt,
      courtId: session.courtId,
      professionalId: session.professionalId,
    })),
  );

  prismaMock.$transaction.mockImplementation(async (callback: (tx: typeof prismaMock) => unknown) => callback(prismaMock));

  trainersPATCH = (await import("@/app/api/org/[orgId]/trainers/route")).PATCH;
  classSeriesPOST = (await import("@/app/api/org/[orgId]/servicos/[id]/class-series/route")).POST;
  agendaGET = (await import("@/app/api/org/[orgId]/agenda/route")).GET;
  confirmPendingBooking = (await import("@/lib/reservas/confirmBooking")).confirmPendingBooking;
});

describe("smoke e2e reservas + aulas + treinadores", () => {
  it("executa fluxo treinador -> publish -> class sessions -> agenda -> conflito de reserva", async () => {
    const approveReq = new NextRequest("http://localhost/api/org/77/trainers", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: "coach-1", action: "APPROVE" }),
    });

    const approveRes = await trainersPATCH(approveReq);
    const approveBody = await approveRes.json();

    expect(approveRes.status).toBe(200);
    expect(approveBody.ok).toBe(true);
    expect(prismaMock.reservationProfessional.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId_userId: {
            organizationId: 77,
            userId: "coach-1",
          },
        },
      }),
    );

    const classReq = new NextRequest("http://localhost/api/org/77/servicos/901/class-series", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        dayOfWeek: 2,
        startMinute: 600,
        durationMinutes: 60,
        capacity: 8,
        validFrom: "2026-03-01",
        professionalId: 700,
        courtId: 44,
      }),
    });

    const classRes = await classSeriesPOST(classReq, { params: Promise.resolve({ id: "901" }) });
    const classBody = await classRes.json();

    expect(classRes.status).toBe(200);
    expect(classBody.ok).toBe(true);
    expect(createdClassSessions.length).toBeGreaterThan(0);

    const agendaReq = new NextRequest(
      "http://localhost/api/org/77/agenda?from=2026-03-03T00:00:00.000Z&to=2026-03-03T23:59:59.000Z",
      { method: "GET" },
    );
    const agendaRes = await agendaGET(agendaReq);
    const agendaBody = await agendaRes.json();

    expect(agendaRes.status).toBe(200);
    expect(agendaBody.ok).toBe(true);
    expect(agendaBody.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceType: "CLASS_SESSION",
        }),
      ]),
    );

    const conflictSession = createdClassSessions[0];
    const tx: any = {
      booking: {
        findUnique: vi.fn().mockResolvedValue({
          id: 100,
          organizationId: 77,
          serviceId: 901,
          userId: "client-1",
          status: "PENDING_CONFIRMATION",
          startsAt: new Date(conflictSession.startsAt),
          durationMinutes: 60,
          partySize: null,
          professionalId: 700,
          resourceId: null,
          courtId: 44,
          price: 2000,
          currency: "EUR",
          pendingExpiresAt: new Date("2026-03-03T12:00:00.000Z"),
          createdAt: new Date("2026-03-03T09:30:00.000Z"),
          snapshotTimezone: "Europe/Lisbon",
          confirmationSnapshot: {
            version: 1,
            createdAt: "2026-03-03T09:30:00.000Z",
            policySnapshot: { policyId: 1 },
          },
          confirmationSnapshotCreatedAt: new Date("2026-03-03T09:30:00.000Z"),
          confirmationSnapshotVersion: 1,
          addons: [],
          bookingPackage: null,
          policyRef: { id: 1, policyId: 1 },
          service: {
            id: 901,
            policyId: 1,
            kind: "CLASS",
            assignmentMode: "PROFESSIONAL_ONLY",
            partySizeRequired: false,
            partySizeMin: 1,
            partySizeMax: 1,
            partySizeStep: 1,
            isActive: true,
            unitPriceCents: 2000,
            currency: "EUR",
            organizationId: 77,
            professionalLinks: [{ professionalId: 700, professional: { isActive: true } }],
            resourceLinks: [],
            organization: {
              primaryModule: "RESERVAS",
              reservationAssignmentMode: "PROFESSIONAL_ONLY",
              timezone: "Europe/Lisbon",
              feeMode: "ADDED",
              platformFeeBps: 0,
              platformFeeFixedCents: 0,
              orgType: "EXTERNAL",
            },
          },
        }),
        findMany: vi.fn().mockResolvedValue([]),
        update: vi.fn(),
      },
      organizationSettings: {
        findUnique: vi.fn().mockResolvedValue({
          bookingGridMinutes: 30,
          bookingAllowedDurations: [60, 90],
          bookingAllowCustomDuration: false,
        }),
      },
      reservationProfessional: {
        findFirst: vi.fn().mockResolvedValue({ id: 700, priority: 1 }),
      },
      availabilitySchedule: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 1,
            scopeType: "ORGANIZATION",
            scopeId: 0,
            startDate: new Date("2026-01-01T00:00:00.000Z"),
            endDate: null,
            createdAt: new Date("2026-01-01T00:00:00.000Z"),
          },
        ]),
      },
      availabilityOverride: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      classSession: {
        findMany: vi.fn().mockResolvedValue([
          {
            startsAt: new Date(conflictSession.startsAt),
            endsAt: new Date(conflictSession.endsAt),
            professionalId: 700,
            resourceId: null,
            courtId: 44,
          },
        ]),
      },
      weeklyAvailabilityTemplate: {
        findMany: vi.fn().mockResolvedValue([
          {
            availabilityId: 1,
            dayOfWeek: 2,
            intervals: [{ start: "08:00", end: "22:00" }],
          },
        ]),
      },
      bookingPolicyRef: {
        create: vi.fn(),
      },
      userActivity: {
        create: vi.fn(),
      },
      $executeRaw: vi.fn(async () => undefined),
    };

    const confirmation = await confirmPendingBooking({
      tx,
      bookingId: 100,
      ignoreExpiry: true,
      now: new Date("2026-03-03T09:35:00.000Z"),
    });

    expect(confirmation.ok).toBe(false);
    if (!confirmation.ok) {
      expect(confirmation.code).toBe("SLOT_TAKEN");
    }
    expect(tx.booking.update).not.toHaveBeenCalled();
  });
});
