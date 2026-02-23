import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const createSupabaseServer = vi.hoisted(() => vi.fn());
const getActiveOrganizationForUser = vi.hoisted(() => vi.fn());
const ensureMemberModuleAccess = vi.hoisted(() => vi.fn());
const recordOrganizationAuditSafe = vi.hoisted(() => vi.fn());
const applyMatchSlotUpdate = vi.hoisted(() => vi.fn());
const isPadelLockedForReschedule = vi.hoisted(() => vi.fn());

const prisma = vi.hoisted(() => ({
  padelScheduleRun: {
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  padelScheduleRunDecision: {
    findMany: vi.fn(),
  },
  eventMatchSlot: {
    findMany: vi.fn(),
  },
}));

vi.mock("@/lib/supabaseServer", () => ({ createSupabaseServer }));
vi.mock("@/lib/organizationContext", () => ({ getActiveOrganizationForUser }));
vi.mock("@/lib/organizationMemberAccess", () => ({ ensureMemberModuleAccess }));
vi.mock("@/lib/organizationAudit", () => ({ recordOrganizationAuditSafe }));
vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/domain/padel/matchSlots/commands", () => ({ applyMatchSlotUpdate }));
vi.mock("@/domain/padel/liveStatus", () => ({ isPadelLockedForReschedule }));

let POST: typeof import("@/app/api/padel/calendar/auto-schedule/undo/route").POST;

beforeEach(async () => {
  vi.resetModules();
  createSupabaseServer.mockReset();
  getActiveOrganizationForUser.mockReset();
  ensureMemberModuleAccess.mockReset();
  recordOrganizationAuditSafe.mockReset();
  applyMatchSlotUpdate.mockReset();
  isPadelLockedForReschedule.mockReset();

  prisma.padelScheduleRun.findFirst.mockReset();
  prisma.padelScheduleRun.update.mockReset();
  prisma.padelScheduleRunDecision.findMany.mockReset();
  prisma.eventMatchSlot.findMany.mockReset();

  createSupabaseServer.mockResolvedValue({
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: "admin-user" } } })) },
  });
  getActiveOrganizationForUser.mockResolvedValue({
    organization: { id: 2 },
    membership: { role: "ADMIN", rolePack: null },
  });
  ensureMemberModuleAccess.mockResolvedValue({ ok: true });
  recordOrganizationAuditSafe.mockResolvedValue(undefined);
  isPadelLockedForReschedule.mockReturnValue(false);

  POST = (await import("@/app/api/padel/calendar/auto-schedule/undo/route")).POST;
});

describe("POST /api/padel/calendar/auto-schedule/undo", () => {
  it("rejeita eventId inválido quando fornecido no body", async () => {
    const req = new NextRequest("http://localhost/api/padel/calendar/auto-schedule/undo", {
      method: "POST",
      body: JSON.stringify({ runId: "run-1", eventId: "1.5" }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(body.error).toBe("INVALID_EVENT");
    expect(prisma.padelScheduleRun.findFirst).not.toHaveBeenCalled();
  });

  it("devolve RUN_NOT_APPLIED quando o run não foi aplicado", async () => {
    prisma.padelScheduleRun.findFirst.mockResolvedValue({
      id: "run-1",
      eventId: 98,
      status: "DONE",
      dryRun: false,
      applied: false,
      scheduledCount: 4,
      skippedCount: 0,
    });

    const req = new NextRequest("http://localhost/api/padel/calendar/auto-schedule/undo", {
      method: "POST",
      body: JSON.stringify({ runId: "run-1", eventId: 98 }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.ok).toBe(false);
    expect(body.error).toBe("RUN_NOT_APPLIED");
  });

  it("desfaz o lote quando os jogos mantêm o snapshot do run", async () => {
    const start = new Date("2026-02-20T11:00:00.000Z");
    const end = new Date("2026-02-20T12:00:00.000Z");

    prisma.padelScheduleRun.findFirst.mockResolvedValue({
      id: "run-undo-1",
      eventId: 98,
      status: "DONE",
      dryRun: false,
      applied: true,
      scheduledCount: 1,
      skippedCount: 0,
    });
    prisma.padelScheduleRunDecision.findMany.mockResolvedValue([
      {
        id: 10,
        matchId: 501,
        courtId: 33,
        startsAt: start,
        endsAt: end,
      },
    ]);
    prisma.eventMatchSlot.findMany.mockResolvedValue([
      {
        id: 501,
        status: "PENDING",
        plannedStartAt: start,
        plannedEndAt: end,
        courtId: 33,
      },
    ]);
    applyMatchSlotUpdate.mockResolvedValue({
      ok: true,
      data: {
        match: {
          id: 501,
          eventId: 98,
          status: "PENDING",
          plannedStartAt: null,
          plannedEndAt: null,
          plannedDurationMinutes: null,
          startTime: null,
          courtId: null,
        },
        eventLogId: "evt-1",
      },
    });

    const req = new NextRequest("http://localhost/api/padel/calendar/auto-schedule/undo", {
      method: "POST",
      body: JSON.stringify({ runId: "run-undo-1", eventId: 98 }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.undoneCount).toBe(1);
    expect(body.requestedCount).toBe(1);
    expect(body.status).toBe("UNDONE");

    expect(applyMatchSlotUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        matchId: 501,
        organizationId: 2,
        eventType: "PADEL_AUTO_SCHEDULE_UNDO",
        schedule: {
          plannedStartAt: null,
          plannedEndAt: null,
          plannedDurationMinutes: null,
          courtId: null,
        },
      }),
    );

    expect(prisma.padelScheduleRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "run-undo-1" },
        data: expect.objectContaining({ status: "UNDONE", applied: false }),
      }),
    );
  });
});
