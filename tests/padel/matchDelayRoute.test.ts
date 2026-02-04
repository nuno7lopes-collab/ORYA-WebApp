import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const createSupabaseServer = vi.hoisted(() => vi.fn());
const getActiveOrganizationForUser = vi.hoisted(() => vi.fn());
const ensureMemberModuleAccess = vi.hoisted(() => vi.fn());
const recordOutboxEvent = vi.hoisted(() => vi.fn());
const appendEventLog = vi.hoisted(() => vi.fn());
const recordOrganizationAuditSafe = vi.hoisted(() => vi.fn());

const prisma = vi.hoisted(() => ({
  eventMatchSlot: { findUnique: vi.fn() },
  $transaction: vi.fn(async (fn: any) => fn({})),
}));

vi.mock("@/lib/supabaseServer", () => ({ createSupabaseServer }));
vi.mock("@/lib/organizationContext", () => ({ getActiveOrganizationForUser }));
vi.mock("@/lib/organizationMemberAccess", () => ({ ensureMemberModuleAccess }));
vi.mock("@/domain/outbox/producer", () => ({ recordOutboxEvent }));
vi.mock("@/domain/eventLog/append", () => ({ appendEventLog }));
vi.mock("@/lib/organizationAudit", () => ({ recordOrganizationAuditSafe }));
vi.mock("@/lib/prisma", () => ({ prisma }));

let POST: typeof import("@/app/api/padel/matches/[id]/delay/route").POST;

beforeEach(async () => {
  createSupabaseServer.mockReset();
  getActiveOrganizationForUser.mockReset();
  ensureMemberModuleAccess.mockReset();
  recordOutboxEvent.mockReset();
  appendEventLog.mockReset();
  recordOrganizationAuditSafe.mockReset();
  prisma.eventMatchSlot.findUnique.mockReset();
  prisma.$transaction.mockClear();
  vi.resetModules();
  POST = (await import("@/app/api/padel/matches/[id]/delay/route")).POST;
});

describe("padel match delay route", () => {
  it("regista audit com metadata", async () => {
    createSupabaseServer.mockResolvedValue({
      auth: { getUser: vi.fn(async () => ({ data: { user: { id: "u1" } } })) },
    });
    prisma.eventMatchSlot.findUnique.mockResolvedValue({
      id: 50,
      status: "PENDING",
      event: {
        id: 10,
        organizationId: 99,
        startsAt: new Date(),
        endsAt: new Date(),
        padelTournamentConfig: { padelClubId: null, partnerClubIds: [], advancedSettings: {} },
      },
    });
    getActiveOrganizationForUser.mockResolvedValue({
      organization: { id: 99 },
      membership: { role: "ADMIN", rolePack: null },
    });
    ensureMemberModuleAccess.mockResolvedValue({ ok: true });
    recordOutboxEvent.mockResolvedValue({ eventId: "evt-1" });

    const req = new NextRequest("http://localhost/api/padel/matches/50/delay", {
      method: "POST",
      body: JSON.stringify({ reason: "rain", clearSchedule: true, autoReschedule: false }),
    });

    const res = await POST(req, { params: Promise.resolve({ id: "50" }) });
    expect(res.status).toBe(202);
    expect(recordOrganizationAuditSafe).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "PADEL_MATCH_DELAY",
        metadata: expect.objectContaining({ matchId: 50, eventId: 10, reason: "rain" }),
      }),
    );
  });
});
