import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const createSupabaseServer = vi.hoisted(() => vi.fn());
const getUserWithPolicy = vi.hoisted(() => vi.fn());
const getActiveOrganizationForUser = vi.hoisted(() => vi.fn());
const ensureMemberModuleAccess = vi.hoisted(() => vi.fn());
const resolvePadelCourtSelection = vi.hoisted(() => vi.fn());
const resolvePartnershipScheduleConstraints = vi.hoisted(() => vi.fn());
const computeSchedulerV2Plan = vi.hoisted(() => vi.fn());
const resolveAllowPlaceholderMatches = vi.hoisted(() => vi.fn(() => false));
const resolveMinParticipantsPerSide = vi.hoisted(() => vi.fn(() => 2));
const handlePadelOutboxEvent = vi.hoisted(() => vi.fn());
const recordOutboxEvent = vi.hoisted(() => vi.fn());
const appendEventLog = vi.hoisted(() => vi.fn());
const recordOrganizationAuditSafe = vi.hoisted(() => vi.fn());

const prisma = vi.hoisted(() => ({
  event: { findFirst: vi.fn() },
  padelEventCategoryLink: { findMany: vi.fn() },
  eventMatchSlot: { findMany: vi.fn() },
  calendarAvailability: { findMany: vi.fn() },
  calendarBlock: { findMany: vi.fn() },
  booking: { findMany: vi.fn() },
  softBlock: { findMany: vi.fn() },
  classSession: { findMany: vi.fn() },
  padelScheduleRun: { create: vi.fn(), update: vi.fn() },
  padelScheduleRunDecision: { createMany: vi.fn() },
}));

vi.mock("@/lib/supabaseServer", () => ({ createSupabaseServer }));
vi.mock("@/lib/auth/getUserWithPolicy", () => ({ getUserWithPolicy }));
vi.mock("@/lib/organizationContext", () => ({ getActiveOrganizationForUser }));
vi.mock("@/lib/organizationMemberAccess", () => ({ ensureMemberModuleAccess }));
vi.mock("@/domain/padel/courtSelection", () => ({ resolvePadelCourtSelection }));
vi.mock("@/domain/padel/partnershipSchedulePolicy", () => ({ resolvePartnershipScheduleConstraints }));
vi.mock("@/domain/padel/schedulerV2/planner", () => ({ computeSchedulerV2Plan }));
vi.mock("@/domain/padel/schedulerV2/formatAdapters", () => ({
  resolveAllowPlaceholderMatches,
  resolveMinParticipantsPerSide,
}));
vi.mock("@/domain/padel/outbox", () => ({ handlePadelOutboxEvent }));
vi.mock("@/domain/outbox/producer", () => ({ recordOutboxEvent }));
vi.mock("@/domain/eventLog/append", () => ({ appendEventLog }));
vi.mock("@/lib/organizationAudit", () => ({ recordOrganizationAuditSafe }));
vi.mock("@/lib/prisma", () => ({ prisma }));

let POST: typeof import("@/app/api/padel/calendar/auto-schedule/route").POST;

beforeEach(async () => {
  vi.resetModules();

  createSupabaseServer.mockReset();
  getUserWithPolicy.mockReset();
  getActiveOrganizationForUser.mockReset();
  ensureMemberModuleAccess.mockReset();
  resolvePadelCourtSelection.mockReset();
  resolvePartnershipScheduleConstraints.mockReset();
  computeSchedulerV2Plan.mockReset();
  resolveAllowPlaceholderMatches.mockReset();
  resolveMinParticipantsPerSide.mockReset();
  handlePadelOutboxEvent.mockReset();
  recordOutboxEvent.mockReset();
  appendEventLog.mockReset();
  recordOrganizationAuditSafe.mockReset();

  prisma.event.findFirst.mockReset();
  prisma.padelEventCategoryLink.findMany.mockReset();
  prisma.eventMatchSlot.findMany.mockReset();
  prisma.calendarAvailability.findMany.mockReset();
  prisma.calendarBlock.findMany.mockReset();
  prisma.booking.findMany.mockReset();
  prisma.softBlock.findMany.mockReset();
  prisma.classSession.findMany.mockReset();
  prisma.padelScheduleRun.create.mockReset();
  prisma.padelScheduleRun.update.mockReset();
  prisma.padelScheduleRunDecision.createMany.mockReset();

  createSupabaseServer.mockResolvedValue({
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: "admin-1" } } })) },
  });
  getUserWithPolicy.mockResolvedValue({ data: { user: { id: "admin-1" } } });
  getActiveOrganizationForUser.mockResolvedValue({
    organization: { id: 101 },
    membership: { role: "ADMIN", rolePack: null },
  });
  ensureMemberModuleAccess.mockResolvedValue({ ok: true });

  prisma.event.findFirst.mockResolvedValue({
    id: 44,
    templateType: "PADEL",
    startsAt: new Date("2026-02-22T09:00:00.000Z"),
    endsAt: new Date("2026-02-22T20:00:00.000Z"),
    padelTournamentConfig: {
      padelClubId: 1,
      partnerClubIds: [],
      advancedSettings: {},
      format: "GRUPOS_ELIMINATORIAS",
    },
  });

  resolvePadelCourtSelection.mockResolvedValue({
    courts: [{ id: 7, padelClubId: 1 }],
    courtPriorityOrder: [7],
  });
  resolvePartnershipScheduleConstraints.mockResolvedValue({ ok: true, additionalCourtBlocks: [] });
  resolveAllowPlaceholderMatches.mockReturnValue(false);
  resolveMinParticipantsPerSide.mockReturnValue(2);

  prisma.eventMatchSlot.findMany
    .mockResolvedValueOnce([
      {
        id: 501,
        categoryId: 11,
        plannedDurationMinutes: 60,
        courtId: null,
        roundLabel: "R1",
        roundType: "GROUPS",
        groupLabel: "A",
        score: {},
        participants: [],
        pairingA: {
          slots: [
            { playerProfileId: 1001, playerProfile: { email: "a1@example.com" } },
            { playerProfileId: 1002, playerProfile: { email: "a2@example.com" } },
          ],
        },
        pairingB: {
          slots: [
            { playerProfileId: 2001, playerProfile: { email: "b1@example.com" } },
            { playerProfileId: 2002, playerProfile: { email: "b2@example.com" } },
          ],
        },
      },
    ])
    .mockResolvedValueOnce([]);

  prisma.calendarAvailability.findMany.mockResolvedValue([]);
  prisma.calendarBlock.findMany.mockResolvedValue([]);
  prisma.booking.findMany.mockResolvedValue([]);
  prisma.softBlock.findMany.mockResolvedValue([]);
  prisma.classSession.findMany.mockResolvedValue([
    {
      id: 7001,
      courtId: 7,
      startsAt: new Date("2026-02-22T10:00:00.000Z"),
      endsAt: new Date("2026-02-22T11:00:00.000Z"),
    },
  ]);

  computeSchedulerV2Plan.mockReturnValue({
    scheduled: [
      {
        matchId: 501,
        courtId: 7,
        start: new Date("2026-02-22T10:00:00.000Z"),
        end: new Date("2026-02-22T11:00:00.000Z"),
        durationMinutes: 60,
      },
    ],
    skipped: [],
    unscheduledByReason: {},
    byCategory: [],
  });

  POST = (await import("@/app/api/padel/calendar/auto-schedule/route")).POST;
});

describe("POST /api/padel/calendar/auto-schedule class-session conflicts", () => {
  it("rejeita partialMode inválido", async () => {
    const req = new NextRequest("http://localhost/api/padel/calendar/auto-schedule", {
      method: "POST",
      body: JSON.stringify({
        eventId: 44,
        partialMode: "sometimes",
      }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(body.errorCode ?? body.error).toBe("INVALID_PARTIAL_MODE");
    expect(prisma.event.findFirst).not.toHaveBeenCalled();
  });

  it("rejeita executionMode inválido", async () => {
    const req = new NextRequest("http://localhost/api/padel/calendar/auto-schedule", {
      method: "POST",
      body: JSON.stringify({
        eventId: 44,
        executionMode: "queued",
      }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(body.errorCode ?? body.error).toBe("INVALID_EXECUTION_MODE");
    expect(prisma.event.findFirst).not.toHaveBeenCalled();
  });

  it("rejeita strategy inválida", async () => {
    const req = new NextRequest("http://localhost/api/padel/calendar/auto-schedule", {
      method: "POST",
      body: JSON.stringify({
        eventId: 44,
        strategy: "smart",
      }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(body.errorCode ?? body.error).toBe("INVALID_STRATEGY");
    expect(prisma.event.findFirst).not.toHaveBeenCalled();
  });

  it("rejeita priority inválida", async () => {
    const req = new NextRequest("http://localhost/api/padel/calendar/auto-schedule", {
      method: "POST",
      body: JSON.stringify({
        eventId: 44,
        priority: "mixed",
      }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(body.errorCode ?? body.error).toBe("INVALID_PRIORITY");
    expect(resolvePadelCourtSelection).not.toHaveBeenCalled();
  });

  it("em ALLOW_PARTIAL devolve 200 com skippedByMatch CLASS_SESSION_CONFLICT", async () => {
    const req = new NextRequest("http://localhost/api/padel/calendar/auto-schedule", {
      method: "POST",
      body: JSON.stringify({
        eventId: 44,
        dryRun: true,
        executionMode: "SYNC",
      }),
    });

    const res = await POST(req);
    const body = await res.json();

    const payload = (body.result ?? body.data ?? body) as Record<string, any>;
    const reasons = payload.unscheduledByReason ?? body.unscheduledByReason ?? null;
    const skippedByMatch = Array.isArray(payload.skippedByMatch ?? body.skippedByMatch)
      ? (payload.skippedByMatch ?? body.skippedByMatch)
      : [];

    expect(res.status).toBe(200);
    expect(payload.ok ?? body.ok).toBe(true);
    expect(payload.scheduledCount ?? body.scheduledCount).toBe(0);
    expect(payload.skippedCount ?? body.skippedCount).toBe(1);
    expect(reasons?.CLASS_SESSION_CONFLICT).toBe(1);
    expect(skippedByMatch[0]?.reason).toBe("CLASS_SESSION_CONFLICT");
    expect(skippedByMatch[0]?.blockedByType).toBe("CLASS_SESSION");
    expect(prisma.padelScheduleRun.create).toHaveBeenCalledTimes(1);
  });

  it("usa fallback de pairings para sideA/sideB quando participants está vazio", async () => {
    prisma.classSession.findMany.mockResolvedValue([]);
    prisma.booking.findMany.mockResolvedValue([]);

    const req = new NextRequest("http://localhost/api/padel/calendar/auto-schedule", {
      method: "POST",
      body: JSON.stringify({
        eventId: 44,
        dryRun: true,
        executionMode: "SYNC",
      }),
    });

    const res = await POST(req);
    const body = await res.json();
    const payload = (body.result ?? body.data ?? body) as Record<string, any>;
    const plannerArg = computeSchedulerV2Plan.mock.calls.at(-1)?.[0];
    const firstUnscheduled = plannerArg?.unscheduledMatches?.[0];

    expect(res.status).toBe(200);
    expect(payload.ok ?? body.ok).toBe(true);
    expect(firstUnscheduled?.sideAProfileIds).toEqual([1001, 1002]);
    expect(firstUnscheduled?.sideBProfileIds).toEqual([2001, 2002]);
    expect(firstUnscheduled?.sideAEmails).toEqual(["a1@example.com", "a2@example.com"]);
    expect(firstUnscheduled?.sideBEmails).toEqual(["b1@example.com", "b2@example.com"]);
  });

  it("em ALLOW_PARTIAL devolve 200 com skippedByMatch BOOKING_CONFLICT", async () => {
    prisma.classSession.findMany.mockResolvedValue([]);
    prisma.booking.findMany.mockResolvedValue([
      {
        id: 8801,
        courtId: 7,
        startsAt: new Date("2026-02-22T10:00:00.000Z"),
        durationMinutes: 60,
        status: "CONFIRMED",
        pendingExpiresAt: null,
      },
    ]);

    const req = new NextRequest("http://localhost/api/padel/calendar/auto-schedule", {
      method: "POST",
      body: JSON.stringify({
        eventId: 44,
        dryRun: true,
        executionMode: "SYNC",
      }),
    });

    const res = await POST(req);
    const body = await res.json();

    const payload = (body.result ?? body.data ?? body) as Record<string, any>;
    const reasons = payload.unscheduledByReason ?? body.unscheduledByReason ?? null;
    const skippedByMatch = Array.isArray(payload.skippedByMatch ?? body.skippedByMatch)
      ? (payload.skippedByMatch ?? body.skippedByMatch)
      : [];

    expect(res.status).toBe(200);
    expect(payload.ok ?? body.ok).toBe(true);
    expect(payload.scheduledCount ?? body.scheduledCount).toBe(0);
    expect(payload.skippedCount ?? body.skippedCount).toBe(1);
    expect(reasons?.BOOKING_CONFLICT).toBe(1);
    expect(skippedByMatch[0]?.reason).toBe("BOOKING_CONFLICT");
    expect(skippedByMatch[0]?.blockedByType).toBe("BOOKING");
  });
});
