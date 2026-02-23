import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const createSupabaseServer = vi.hoisted(() => vi.fn());
const getUserWithPolicy = vi.hoisted(() => vi.fn());
const getActiveOrganizationForUser = vi.hoisted(() => vi.fn());
const ensureMemberModuleAccess = vi.hoisted(() => vi.fn());
const recordOrganizationAuditSafe = vi.hoisted(() => vi.fn());
const applyMatchSlotUpdate = vi.hoisted(() => vi.fn());

const prisma = vi.hoisted(() => ({
  event: { findUnique: vi.fn() },
  eventMatchSlot: { findMany: vi.fn() },
  padelClubCourt: { findMany: vi.fn() },
  calendarBlock: { findMany: vi.fn() },
  booking: { findMany: vi.fn() },
  softBlock: { findMany: vi.fn() },
  classSession: { findMany: vi.fn() },
}));

vi.mock("@/lib/supabaseServer", () => ({ createSupabaseServer }));
vi.mock("@/lib/auth/getUserWithPolicy", () => ({ getUserWithPolicy }));
vi.mock("@/lib/organizationContext", () => ({ getActiveOrganizationForUser }));
vi.mock("@/lib/organizationMemberAccess", () => ({ ensureMemberModuleAccess }));
vi.mock("@/lib/organizationAudit", () => ({ recordOrganizationAuditSafe }));
vi.mock("@/domain/padel/matchSlots/commands", () => ({ applyMatchSlotUpdate }));
vi.mock("@/lib/prisma", () => ({ prisma }));

let POST: typeof import("@/app/api/padel/calendar/matches/bulk-reschedule/route").POST;

const unwrapPayload = (body: unknown) => {
  if (!body || typeof body !== "object") return {} as Record<string, unknown>;
  const record = body as Record<string, unknown>;
  if (record.result && typeof record.result === "object") return record.result as Record<string, unknown>;
  if (record.data && typeof record.data === "object") return record.data as Record<string, unknown>;
  return record;
};

beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();

  createSupabaseServer.mockResolvedValue({});
  getUserWithPolicy.mockResolvedValue({ data: { user: { id: "admin-1" } }, error: null });
  getActiveOrganizationForUser.mockResolvedValue({
    organization: { id: 101 },
    membership: { role: "ADMIN", rolePack: null },
  });
  ensureMemberModuleAccess.mockResolvedValue({ ok: true });
  prisma.event.findUnique.mockResolvedValue({ id: 44, organizationId: 101, templateType: "PADEL" });
  prisma.padelClubCourt.findMany.mockResolvedValue([{ id: 7, name: "Campo 1", displayOrder: 0 }]);
  prisma.calendarBlock.findMany.mockResolvedValue([]);
  prisma.booking.findMany.mockResolvedValue([]);
  prisma.softBlock.findMany.mockResolvedValue([]);
  prisma.classSession.findMany.mockResolvedValue([]);
  recordOrganizationAuditSafe.mockResolvedValue(undefined);
  applyMatchSlotUpdate.mockResolvedValue({
    ok: true,
    data: {
      match: {
        id: 501,
        eventId: 44,
        status: "PENDING",
        plannedStartAt: new Date("2026-02-22T10:00:00.000Z"),
        plannedEndAt: new Date("2026-02-22T11:00:00.000Z"),
        plannedDurationMinutes: 60,
        startTime: null,
        courtId: 7,
      },
      eventLogId: "evt-1",
    },
  });

  POST = (await import("@/app/api/padel/calendar/matches/bulk-reschedule/route")).POST;
});

describe("POST /api/padel/calendar/matches/bulk-reschedule", () => {
  it("rejeita mode inválido em vez de cair para APPLY", async () => {
    const req = new NextRequest("http://localhost/api/padel/calendar/matches/bulk-reschedule", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        eventId: 44,
        mode: "preview_now",
        partialMode: "ALLOW_PARTIAL",
        updates: [
          {
            matchId: 501,
            courtId: 7,
            startAt: "2026-02-22T10:00:00.000Z",
            endAt: "2026-02-22T11:00:00.000Z",
          },
        ],
      }),
    });

    const res = await POST(req);
    const body = await res.json();
    const payload = unwrapPayload(body);
    const root = body as Record<string, unknown>;

    expect(res.status).toBe(400);
    expect((payload.ok ?? root.ok) as boolean).toBe(false);
    expect(
      (payload.errorCode ?? payload.error ?? root.errorCode ?? root.error) as string,
    ).toBe("INVALID_MODE");
    expect(prisma.event.findUnique).not.toHaveBeenCalled();
  });

  it("rejeita partialMode inválido", async () => {
    const req = new NextRequest("http://localhost/api/padel/calendar/matches/bulk-reschedule", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        eventId: 44,
        mode: "PREVIEW",
        partialMode: "sometimes",
        updates: [
          {
            matchId: 501,
            courtId: 7,
            startAt: "2026-02-22T10:00:00.000Z",
            endAt: "2026-02-22T11:00:00.000Z",
          },
        ],
      }),
    });

    const res = await POST(req);
    const body = await res.json();
    const payload = unwrapPayload(body);
    const root = body as Record<string, unknown>;

    expect(res.status).toBe(400);
    expect((payload.ok ?? root.ok) as boolean).toBe(false);
    expect(
      (payload.errorCode ?? payload.error ?? root.errorCode ?? root.error) as string,
    ).toBe("INVALID_PARTIAL_MODE");
    expect(prisma.event.findUnique).not.toHaveBeenCalled();
  });

  it("rejeita eventId decimal sem truncar", async () => {
    const req = new NextRequest("http://localhost/api/padel/calendar/matches/bulk-reschedule", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        eventId: 44.5,
        mode: "PREVIEW",
        partialMode: "ALLOW_PARTIAL",
        updates: [
          {
            matchId: 501,
            courtId: 7,
            startAt: "2026-02-22T10:00:00.000Z",
            endAt: "2026-02-22T11:00:00.000Z",
          },
        ],
      }),
    });

    const res = await POST(req);
    const body = await res.json();
    const payload = unwrapPayload(body);
    const root = body as Record<string, unknown>;

    expect(res.status).toBe(400);
    expect((payload.ok ?? root.ok) as boolean).toBe(false);
    expect(
      (payload.errorCode ?? payload.error ?? root.errorCode ?? root.error) as string,
    ).toBe("INVALID_EVENT");
    expect(prisma.event.findUnique).not.toHaveBeenCalled();
  });

  it("rejeita updates com matchId decimal sem truncar", async () => {
    const req = new NextRequest("http://localhost/api/padel/calendar/matches/bulk-reschedule", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        eventId: 44,
        mode: "PREVIEW",
        partialMode: "ALLOW_PARTIAL",
        updates: [
          {
            matchId: 501.5,
            courtId: 7,
            startAt: "2026-02-22T10:00:00.000Z",
            endAt: "2026-02-22T11:00:00.000Z",
          },
        ],
      }),
    });

    const res = await POST(req);
    const body = await res.json();
    const payload = unwrapPayload(body);
    const root = body as Record<string, unknown>;

    expect(res.status).toBe(400);
    expect((payload.ok ?? root.ok) as boolean).toBe(false);
    expect(
      (payload.errorCode ?? payload.error ?? root.errorCode ?? root.error) as string,
    ).toBe("INVALID_UPDATES");
    expect(prisma.eventMatchSlot.findMany).not.toHaveBeenCalled();
  });

  it("em PREVIEW devolve conflito de CLASS_SESSION por match", async () => {
    prisma.eventMatchSlot.findMany
      .mockResolvedValueOnce([
        {
          id: 501,
          status: "PENDING",
          updatedAt: new Date("2026-02-22T09:00:00.000Z"),
          courtId: null,
          plannedStartAt: null,
          plannedEndAt: null,
          plannedDurationMinutes: null,
          startTime: null,
        },
      ])
      .mockResolvedValueOnce([]);
    prisma.classSession.findMany.mockResolvedValueOnce([
      {
        id: 7001,
        courtId: 7,
        startsAt: new Date("2026-02-22T10:00:00.000Z"),
        endsAt: new Date("2026-02-22T11:00:00.000Z"),
      },
    ]);

    const req = new NextRequest("http://localhost/api/padel/calendar/matches/bulk-reschedule", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        eventId: 44,
        mode: "PREVIEW",
        partialMode: "ALLOW_PARTIAL",
        updates: [
          {
            matchId: 501,
            courtId: 7,
            startAt: "2026-02-22T10:00:00.000Z",
            endAt: "2026-02-22T11:00:00.000Z",
            durationMinutes: 60,
            version: "2026-02-22T09:00:00.000Z",
          },
        ],
      }),
    });

    const res = await POST(req);
    const body = await res.json();
    const payload = unwrapPayload(body);
    const root = body as Record<string, unknown>;

    expect(res.status).toBe(200);
    expect((payload.ok ?? root.ok) as boolean).toBe(true);
    expect((payload.scheduledCount ?? root.scheduledCount) as number).toBe(0);
    expect((payload.skippedCount ?? root.skippedCount) as number).toBe(1);
    const unscheduledByReason = (payload.unscheduledByReason ?? root.unscheduledByReason) as Record<string, number> | undefined;
    const skippedByMatch = (payload.skippedByMatch ?? root.skippedByMatch) as Array<Record<string, unknown>> | undefined;
    expect(unscheduledByReason?.CLASS_SESSION_CONFLICT).toBe(1);
    expect(skippedByMatch?.[0]?.blockedByType).toBe("CLASS_SESSION");
    expect(applyMatchSlotUpdate).not.toHaveBeenCalled();
  });

  it("em APPLY + REQUIRE_FULL devolve 409 sem writes quando há conflito", async () => {
    prisma.eventMatchSlot.findMany
      .mockResolvedValueOnce([
        {
          id: 501,
          status: "PENDING",
          updatedAt: new Date("2026-02-22T09:00:00.000Z"),
          courtId: null,
          plannedStartAt: null,
          plannedEndAt: null,
          plannedDurationMinutes: null,
          startTime: null,
        },
      ])
      .mockResolvedValueOnce([]);
    prisma.classSession.findMany.mockResolvedValueOnce([
      {
        id: 7001,
        courtId: 7,
        startsAt: new Date("2026-02-22T10:00:00.000Z"),
        endsAt: new Date("2026-02-22T11:00:00.000Z"),
      },
    ]);

    const req = new NextRequest("http://localhost/api/padel/calendar/matches/bulk-reschedule", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        eventId: 44,
        mode: "APPLY",
        partialMode: "REQUIRE_FULL",
        updates: [
          {
            matchId: 501,
            courtId: 7,
            startAt: "2026-02-22T10:00:00.000Z",
            endAt: "2026-02-22T11:00:00.000Z",
            durationMinutes: 60,
            version: "2026-02-22T09:00:00.000Z",
          },
        ],
      }),
    });

    const res = await POST(req);
    const body = await res.json();
    const payload = unwrapPayload(body);
    const root = body as Record<string, unknown>;

    expect(res.status).toBe(409);
    expect((payload.ok ?? root.ok) as boolean).toBe(false);
    expect((payload.error ?? root.error) as string).toBe("BULK_RESCHEDULE_INFEASIBLE");
    expect(applyMatchSlotUpdate).not.toHaveBeenCalled();
  });

  it("em APPLY + ALLOW_PARTIAL aplica válidos e marca AGENDA_WRITE_FAILED quando write falha", async () => {
    prisma.eventMatchSlot.findMany
      .mockResolvedValueOnce([
        {
          id: 501,
          status: "PENDING",
          updatedAt: new Date("2026-02-22T09:00:00.000Z"),
          courtId: null,
          plannedStartAt: null,
          plannedEndAt: null,
          plannedDurationMinutes: null,
          startTime: null,
        },
        {
          id: 502,
          status: "PENDING",
          updatedAt: new Date("2026-02-22T09:00:00.000Z"),
          courtId: null,
          plannedStartAt: null,
          plannedEndAt: null,
          plannedDurationMinutes: null,
          startTime: null,
        },
      ])
      .mockResolvedValueOnce([]);

    applyMatchSlotUpdate
      .mockResolvedValueOnce({
        ok: true,
        data: {
          match: {
            id: 501,
            eventId: 44,
            status: "PENDING",
            plannedStartAt: new Date("2026-02-22T10:00:00.000Z"),
            plannedEndAt: new Date("2026-02-22T11:00:00.000Z"),
            plannedDurationMinutes: 60,
            startTime: null,
            courtId: 7,
          },
          eventLogId: "evt-1",
        },
      })
      .mockResolvedValueOnce({ ok: false, error: "MATCH_NOT_FOUND" });

    const req = new NextRequest("http://localhost/api/padel/calendar/matches/bulk-reschedule", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        eventId: 44,
        mode: "APPLY",
        partialMode: "ALLOW_PARTIAL",
        updates: [
          {
            matchId: 501,
            courtId: 7,
            startAt: "2026-02-22T10:00:00.000Z",
            endAt: "2026-02-22T11:00:00.000Z",
            durationMinutes: 60,
            version: "2026-02-22T09:00:00.000Z",
          },
          {
            matchId: 502,
            courtId: 7,
            startAt: "2026-02-22T11:00:00.000Z",
            endAt: "2026-02-22T12:00:00.000Z",
            durationMinutes: 60,
            version: "2026-02-22T09:00:00.000Z",
          },
        ],
      }),
    });

    const res = await POST(req);
    const body = await res.json();
    const payload = unwrapPayload(body);
    const root = body as Record<string, unknown>;

    expect(res.status).toBe(200);
    expect((payload.ok ?? root.ok) as boolean).toBe(true);
    expect((payload.scheduledCount ?? root.scheduledCount) as number).toBe(1);
    const unscheduledByReason = (payload.unscheduledByReason ?? root.unscheduledByReason) as Record<string, number> | undefined;
    const skippedByMatch = (payload.skippedByMatch ?? root.skippedByMatch) as Array<Record<string, unknown>> | undefined;
    expect(unscheduledByReason?.AGENDA_WRITE_FAILED).toBe(1);
    expect(
      (skippedByMatch ?? []).some((item) => item.reason === "AGENDA_WRITE_FAILED"),
    ).toBe(true);
    expect(recordOrganizationAuditSafe).toHaveBeenCalledTimes(1);
  });
});
