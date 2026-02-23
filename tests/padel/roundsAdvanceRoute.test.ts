import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const createSupabaseServer = vi.hoisted(() => vi.fn());
const getActiveOrganizationForUser = vi.hoisted(() => vi.fn());
const ensureMemberModuleAccess = vi.hoisted(() => vi.fn());
const recordOrganizationAuditSafe = vi.hoisted(() => vi.fn());

const prisma = vi.hoisted(() => ({
  event: { findUnique: vi.fn() },
  padelEventCategoryLink: { findFirst: vi.fn() },
  eventMatchSlot: { findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
  padelTournamentParticipant: { create: vi.fn(), findFirst: vi.fn() },
  padelMatchParticipant: { createMany: vi.fn() },
  padelTournamentConfig: { update: vi.fn() },
  calendarAvailability: { findMany: vi.fn() },
  calendarBlock: { findMany: vi.fn() },
}));

vi.mock("@/lib/supabaseServer", () => ({ createSupabaseServer }));
vi.mock("@/lib/organizationContext", () => ({ getActiveOrganizationForUser }));
vi.mock("@/lib/organizationMemberAccess", () => ({ ensureMemberModuleAccess }));
vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/lib/organizationAudit", () => ({ recordOrganizationAuditSafe }));

let POST: typeof import("@/app/api/padel/rounds/advance/route").POST;

beforeEach(async () => {
  vi.resetModules();
  createSupabaseServer.mockReset();
  getActiveOrganizationForUser.mockReset();
  ensureMemberModuleAccess.mockReset();
  recordOrganizationAuditSafe.mockReset();
  prisma.event.findUnique.mockReset();
  prisma.padelEventCategoryLink.findFirst.mockReset();

  createSupabaseServer.mockResolvedValue({
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: "admin-user" } } })) },
  });
  getActiveOrganizationForUser.mockResolvedValue({
    organization: { id: 2 },
    membership: { role: "ADMIN", rolePack: null },
  });
  ensureMemberModuleAccess.mockResolvedValue({ ok: true });
  recordOrganizationAuditSafe.mockResolvedValue(undefined);

  POST = (await import("@/app/api/padel/rounds/advance/route")).POST;
});

describe("POST /api/padel/rounds/advance", () => {
  it("rejeita autoSchedule.partialMode inválido", async () => {
    const req = new NextRequest("http://localhost/api/padel/rounds/advance", {
      method: "POST",
      body: JSON.stringify({
        eventId: 281,
        autoSchedule: { partialMode: "sometimes" },
      }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(body.errorCode ?? body.error).toBe("INVALID_PARTIAL_MODE");
    expect(prisma.event.findUnique).not.toHaveBeenCalled();
  });

  it("rejeita autoSchedule.executionMode inválido", async () => {
    const req = new NextRequest("http://localhost/api/padel/rounds/advance", {
      method: "POST",
      body: JSON.stringify({
        eventId: 281,
        autoSchedule: { executionMode: "queued" },
      }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(body.errorCode ?? body.error).toBe("INVALID_EXECUTION_MODE");
    expect(prisma.event.findUnique).not.toHaveBeenCalled();
  });

  it("rejeita autoSchedule.strategy inválida", async () => {
    const req = new NextRequest("http://localhost/api/padel/rounds/advance", {
      method: "POST",
      body: JSON.stringify({
        eventId: 281,
        autoSchedule: { strategy: "smart" },
      }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(body.errorCode ?? body.error).toBe("INVALID_STRATEGY");
    expect(prisma.event.findUnique).not.toHaveBeenCalled();
  });

  it("returns ROUND_STATE_NOT_FOUND for NON_STOP ACTIVE_QUEUE without runtime state", async () => {
    prisma.event.findUnique.mockResolvedValue({
      id: 281,
      organizationId: 2,
      templateType: "PADEL",
      startsAt: new Date("2026-04-28T11:00:00.000Z"),
      endsAt: new Date("2026-04-28T19:00:00.000Z"),
      padelTournamentConfig: {
        format: "NON_STOP",
        advancedSettings: {
          formatProfilesByCategory: {
            global: {
              format: "NON_STOP",
              nonStopMode: "ACTIVE_QUEUE",
            },
          },
        },
        padelClubId: 11,
        partnerClubIds: [],
      },
    });

    const req = new NextRequest("http://localhost/api/padel/rounds/advance", {
      method: "POST",
      body: JSON.stringify({
        eventId: 281,
      }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.ok).toBe(false);
    expect(body.error).toBe("ROUND_STATE_NOT_FOUND");
  });

  it("supports NON_STOP HARD_CAP_WAITLIST round advance in dry-run mode", async () => {
    prisma.event.findUnique.mockResolvedValue({
      id: 281,
      organizationId: 2,
      templateType: "PADEL",
      startsAt: new Date("2026-04-28T11:00:00.000Z"),
      endsAt: new Date("2026-04-28T19:00:00.000Z"),
      padelTournamentConfig: {
        format: "NON_STOP",
        advancedSettings: {
          formatProfilesByCategory: {
            global: {
              format: "NON_STOP",
              nonStopMode: "HARD_CAP_WAITLIST",
            },
          },
          nonStopRuntimeByCategory: {
            global: {
              mode: "HARD_CAP_WAITLIST",
              round: 1,
              roundsTotal: 3,
              activeCourtsCount: 1,
              queue: [],
              activePairs: [[11, 12]],
            },
          },
        },
        padelClubId: 11,
        partnerClubIds: [],
      },
    });
    prisma.eventMatchSlot.findMany.mockResolvedValue([
      {
        id: 100,
        roundLabel: "R1.C1",
        status: "OFFICIAL",
        pairingAId: 11,
        pairingBId: 12,
        winnerPairingId: 11,
        courtId: 901,
        courtNumber: 1,
        courtName: "Campo 1",
      },
    ]);

    const req = new NextRequest("http://localhost/api/padel/rounds/advance", {
      method: "POST",
      body: JSON.stringify({
        eventId: 281,
        dryRun: true,
      }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.generated).toBe(1);
    expect(body.roundState?.mode).toBe("HARD_CAP_WAITLIST");
  });
});
