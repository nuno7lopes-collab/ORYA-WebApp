import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const createSupabaseServer = vi.hoisted(() => vi.fn());
const getUserWithPolicy = vi.hoisted(() => vi.fn());
const getActiveOrganizationForUser = vi.hoisted(() => vi.fn());
const ensureMemberModuleAccess = vi.hoisted(() => vi.fn());
const computePadelIntegritySummary = vi.hoisted(() => vi.fn());

const prisma = vi.hoisted(() => ({
  event: { findUnique: vi.fn() },
  padelRegistration: { count: vi.fn() },
  padelWaitlistEntry: { count: vi.fn() },
  eventMatchSlot: { count: vi.fn() },
  padelPairing: { findMany: vi.fn() },
  padelPartnershipOverride: { count: vi.fn() },
  padelPartnershipCompensationCase: { count: vi.fn() },
  padelRatingSanction: { groupBy: vi.fn() },
  agendaResourceClaim: { count: vi.fn() },
  classSession: { aggregate: vi.fn() },
  booking: { count: vi.fn() },
  padelScheduleRun: { findMany: vi.fn(), count: vi.fn() },
  $queryRaw: vi.fn(),
}));

vi.mock("@/lib/supabaseServer", () => ({ createSupabaseServer }));
vi.mock("@/lib/auth/getUserWithPolicy", () => ({ getUserWithPolicy }));
vi.mock("@/lib/organizationContext", () => ({ getActiveOrganizationForUser }));
vi.mock("@/lib/organizationMemberAccess", () => ({ ensureMemberModuleAccess }));
vi.mock("@/domain/padel/integrity", () => ({ computePadelIntegritySummary }));
vi.mock("@/lib/prisma", () => ({ prisma }));

let GET: typeof import("@/app/api/padel/ops/summary/route").GET;

beforeEach(async () => {
  vi.resetModules();

  createSupabaseServer.mockResolvedValue({});
  getUserWithPolicy.mockResolvedValue({
    data: { user: { id: "user-1" } },
    error: null,
  });
  getActiveOrganizationForUser.mockResolvedValue({
    organization: { id: 9 },
    membership: { role: "ADMIN", rolePack: null },
  });
  ensureMemberModuleAccess.mockResolvedValue({ ok: true });
  computePadelIntegritySummary.mockReturnValue({ counts: { total: 0 } });

  prisma.event.findUnique.mockResolvedValue({
    id: 77,
    organizationId: 9,
    templateType: "PADEL",
    startsAt: new Date("2026-02-22T08:00:00.000Z"),
    endsAt: new Date("2026-02-22T20:00:00.000Z"),
  });

  prisma.padelRegistration.count
    .mockResolvedValueOnce(8)
    .mockResolvedValueOnce(12)
    .mockResolvedValueOnce(1);
  prisma.padelWaitlistEntry.count.mockResolvedValue(3);
  prisma.eventMatchSlot.count
    .mockResolvedValueOnce(10)
    .mockResolvedValueOnce(9)
    .mockResolvedValueOnce(2);
  prisma.padelPairing.findMany.mockResolvedValue([]);
  prisma.padelPartnershipOverride.count
    .mockResolvedValueOnce(2)
    .mockResolvedValueOnce(1)
    .mockResolvedValueOnce(4);
  prisma.padelPartnershipCompensationCase.count.mockResolvedValue(0);
  prisma.padelRatingSanction.groupBy.mockResolvedValue([]);
  prisma.agendaResourceClaim.count.mockResolvedValue(0);
  prisma.classSession.aggregate.mockResolvedValue({
    _sum: { capacity: 40 },
    _count: { _all: 8 },
  });
  prisma.booking.count
    .mockResolvedValueOnce(20)
    .mockResolvedValueOnce(5)
    .mockResolvedValueOnce(1);
  prisma.padelScheduleRun.findMany.mockResolvedValue([
    { unscheduledByReason: { CLASS_SESSION_CONFLICT: 2, BOOKING_CONFLICT: 1 }, errorCode: null },
    { unscheduledByReason: { CLASS_SESSION_CONFLICT: 1 }, errorCode: "AUTO_SCHEDULE_INFEASIBLE" },
    { unscheduledByReason: { CLASS_SESSION_CONFLICT: 1, BOOKING_CONFLICT: 2 }, errorCode: "AUTO_SCHEDULE_INFEASIBLE" },
    { unscheduledByReason: {}, errorCode: "AUTO_SCHEDULE_INFEASIBLE" },
  ]);
  prisma.padelScheduleRun.count.mockResolvedValue(0);

  prisma.$queryRaw
    .mockResolvedValueOnce([{ policy: "CASCADE_SAME_COURT", count: BigInt(3) }])
    .mockResolvedValueOnce([{ count: BigInt(0) }])
    .mockResolvedValueOnce([{ count: BigInt(7) }])
    .mockResolvedValueOnce([{ total_count: BigInt(10), stream_live_count: BigInt(4) }])
    .mockResolvedValueOnce([{ avg_latency_ms: 123.5 }])
    .mockResolvedValueOnce([{ count: BigInt(2) }]);

  GET = (await import("@/app/api/padel/ops/summary/route")).GET;
});

describe("GET /api/padel/ops/summary métricas operacionais", () => {
  it("calcula e expõe métricas novas + alerta de spike auto-schedule", async () => {
    const req = new NextRequest("http://localhost/api/padel/ops/summary?eventId=77");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.summary).toMatchObject({
      autoScheduleBlockedByClassSessionCount: 4,
      autoScheduleSkippedByBookingCount: 3,
      autoScheduleInfeasibleLastHourCount: 3,
      matchStartingSoonSentCount: 7,
      publicLivePayloadStreamCoverage: 0.4,
      scheduleWriteGatewayDecisionLatencyMs: 123.5,
      calendarConflictPreflightMismatchCount: 2,
    });
    expect(body.summary.alerts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "AUTO_SCHEDULE_INFEASIBLE_SPIKE" }),
      ]),
    );
  });
});
