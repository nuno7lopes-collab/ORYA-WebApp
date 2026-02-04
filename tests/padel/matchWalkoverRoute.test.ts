import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const createSupabaseServer = vi.hoisted(() => vi.fn());
const getActiveOrganizationForUser = vi.hoisted(() => vi.fn());
const ensureMemberModuleAccess = vi.hoisted(() => vi.fn());
const canMarkWalkover = vi.hoisted(() => vi.fn(() => true));
const buildWalkoverSets = vi.hoisted(() => vi.fn(() => []));
const updatePadelMatch = vi.hoisted(() => vi.fn());
const normalizePadelScoreRules = vi.hoisted(() => vi.fn(() => null));
const recordOrganizationAuditSafe = vi.hoisted(() => vi.fn());

const prisma = vi.hoisted(() => ({
  eventMatchSlot: { findUnique: vi.fn() },
  padelPairing: { findUnique: vi.fn() },
  padelTournamentConfig: { findUnique: vi.fn() },
  $transaction: vi.fn(async (fn: any) => fn({})),
}));

vi.mock("@/lib/supabaseServer", () => ({ createSupabaseServer }));
vi.mock("@/lib/organizationContext", () => ({ getActiveOrganizationForUser }));
vi.mock("@/lib/organizationMemberAccess", () => ({ ensureMemberModuleAccess }));
vi.mock("@/domain/padel/pairingPolicy", () => ({ canMarkWalkover }));
vi.mock("@/domain/padel/score", () => ({
  buildWalkoverSets: (...args: any[]) => buildWalkoverSets(...args),
  normalizePadelScoreRules: (...args: any[]) => normalizePadelScoreRules(...args),
}));
vi.mock("@/domain/padel/matches/commands", () => ({ updatePadelMatch }));
vi.mock("@/lib/organizationAudit", () => ({ recordOrganizationAuditSafe }));
vi.mock("@/lib/prisma", () => ({ prisma }));

let POST: typeof import("@/app/api/padel/matches/[id]/walkover/route").POST;

beforeEach(async () => {
  createSupabaseServer.mockReset();
  getActiveOrganizationForUser.mockReset();
  ensureMemberModuleAccess.mockReset();
  canMarkWalkover.mockReset();
  buildWalkoverSets.mockReset();
  updatePadelMatch.mockReset();
  normalizePadelScoreRules.mockReset();
  recordOrganizationAuditSafe.mockReset();
  prisma.eventMatchSlot.findUnique.mockReset();
  prisma.padelPairing.findUnique.mockReset();
  prisma.padelTournamentConfig.findUnique.mockReset();
  prisma.$transaction.mockClear();
  vi.resetModules();
  POST = (await import("@/app/api/padel/matches/[id]/walkover/route")).POST;
});

describe("padel match walkover route", () => {
  it("marca walkover e grava audit", async () => {
    createSupabaseServer.mockResolvedValue({
      auth: { getUser: vi.fn(async () => ({ data: { user: { id: "u1" } } })) },
    });
    prisma.eventMatchSlot.findUnique.mockResolvedValue({
      id: 1,
      pairingAId: 11,
      pairingBId: 12,
      eventId: 5,
      status: "PENDING",
      event: { organizationId: 99 },
    });
    getActiveOrganizationForUser.mockResolvedValue({
      organization: { id: 99 },
      membership: { role: "ADMIN", rolePack: null },
    });
    ensureMemberModuleAccess.mockResolvedValue({ ok: true });
    prisma.padelPairing.findUnique.mockResolvedValue({
      payment_mode: "SPLIT",
      registration: { status: "CONFIRMED" },
    });
    prisma.padelTournamentConfig.findUnique.mockResolvedValue({ advancedSettings: {} });
    updatePadelMatch.mockResolvedValue({
      match: { id: 1, eventId: 5, status: "DONE" },
    });

    const req = new NextRequest("http://localhost/api/padel/matches/1/walkover", {
      method: "POST",
      body: JSON.stringify({ winner: "A" }),
    });

    const res = await POST(req, { params: Promise.resolve({ id: "1" }) });
    expect(res.status).toBe(200);
    expect(updatePadelMatch).toHaveBeenCalled();
    expect(recordOrganizationAuditSafe).toHaveBeenCalledWith(
      expect.objectContaining({ action: "PADEL_MATCH_WALKOVER" }),
    );
  });
});
