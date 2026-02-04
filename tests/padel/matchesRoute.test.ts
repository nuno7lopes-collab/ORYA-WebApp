import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const createSupabaseServer = vi.hoisted(() => vi.fn());
const getActiveOrganizationForUser = vi.hoisted(() => vi.fn());
const ensureMemberModuleAccess = vi.hoisted(() => vi.fn());
const updatePadelMatch = vi.hoisted(() => vi.fn());
const recordOrganizationAuditSafe = vi.hoisted(() => vi.fn());
const isValidScore = vi.hoisted(() => vi.fn(() => true));
const normalizePadelScoreRules = vi.hoisted(() => vi.fn(() => null));
const resolvePadelMatchStats = vi.hoisted(() => vi.fn(() => null));

const prisma = vi.hoisted(() => ({
  event: { findUnique: vi.fn() },
  eventMatchSlot: { findUnique: vi.fn() },
  padelTournamentConfig: { findUnique: vi.fn() },
  padelClubCourt: { findFirst: vi.fn() },
}));

vi.mock("@/lib/supabaseServer", () => ({ createSupabaseServer }));
vi.mock("@/lib/organizationContext", () => ({ getActiveOrganizationForUser }));
vi.mock("@/lib/organizationMemberAccess", () => ({ ensureMemberModuleAccess }));
vi.mock("@/domain/padel/matches/commands", () => ({ updatePadelMatch }));
vi.mock("@/lib/organizationAudit", () => ({ recordOrganizationAuditSafe }));
vi.mock("@/lib/padel/validation", () => ({ isValidScore }));
vi.mock("@/domain/padel/score", () => ({
  normalizePadelScoreRules: (...args: any[]) => normalizePadelScoreRules(...args),
  resolvePadelMatchStats: (...args: any[]) => resolvePadelMatchStats(...args),
}));
vi.mock("@/lib/prisma", () => ({ prisma }));

let POST: typeof import("@/app/api/padel/matches/route").POST;

beforeEach(async () => {
  createSupabaseServer.mockReset();
  getActiveOrganizationForUser.mockReset();
  ensureMemberModuleAccess.mockReset();
  updatePadelMatch.mockReset();
  recordOrganizationAuditSafe.mockReset();
  isValidScore.mockReset();
  normalizePadelScoreRules.mockReset();
  resolvePadelMatchStats.mockReset();
  prisma.event.findUnique.mockReset();
  prisma.eventMatchSlot.findUnique.mockReset();
  prisma.padelTournamentConfig.findUnique.mockReset();
  prisma.padelClubCourt.findFirst.mockReset();
  vi.resetModules();
  POST = (await import("@/app/api/padel/matches/route")).POST;
});

describe("padel matches route", () => {
  it("rejeita sem autenticação", async () => {
    createSupabaseServer.mockResolvedValue({
      auth: { getUser: vi.fn(async () => ({ data: { user: null } })) },
    });
    const req = new NextRequest("http://localhost/api/padel/matches", {
      method: "POST",
      body: JSON.stringify({ id: 10, status: "IN_PROGRESS" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("bloqueia update sem permissão EDIT", async () => {
    createSupabaseServer.mockResolvedValue({
      auth: { getUser: vi.fn(async () => ({ data: { user: { id: "u1" } } })) },
    });
    prisma.eventMatchSlot.findUnique.mockResolvedValue({
      id: 10,
      eventId: 5,
      status: "PENDING",
      score: {},
      scoreSets: null,
      pairingAId: 1,
      pairingBId: 2,
      winnerPairingId: null,
      startTime: null,
      courtId: null,
      courtNumber: null,
      event: { organizationId: 99 },
    });
    getActiveOrganizationForUser.mockResolvedValue({
      organization: { id: 99 },
      membership: { role: "STAFF", rolePack: null },
    });
    ensureMemberModuleAccess.mockResolvedValue({ ok: false });

    const req = new NextRequest("http://localhost/api/padel/matches", {
      method: "POST",
      body: JSON.stringify({ id: 10, status: "IN_PROGRESS" }),
    });
    const res = await POST(req);

    expect(res.status).toBe(403);
  });

  it("atualiza match quando permissões são válidas", async () => {
    createSupabaseServer.mockResolvedValue({
      auth: { getUser: vi.fn(async () => ({ data: { user: { id: "u1" } } })) },
    });
    prisma.eventMatchSlot.findUnique.mockResolvedValue({
      id: 10,
      eventId: 5,
      status: "PENDING",
      score: {},
      scoreSets: null,
      pairingAId: 1,
      pairingBId: 2,
      winnerPairingId: null,
      startTime: null,
      courtId: null,
      courtNumber: null,
      event: { organizationId: 99 },
    });
    getActiveOrganizationForUser.mockResolvedValue({
      organization: { id: 99 },
      membership: { role: "ADMIN", rolePack: null },
    });
    ensureMemberModuleAccess.mockResolvedValue({ ok: true });
    updatePadelMatch.mockResolvedValue({
      match: { id: 10, eventId: 5, status: "IN_PROGRESS", winnerPairingId: null },
      outboxEventId: "evt-1",
    });

    const req = new NextRequest("http://localhost/api/padel/matches", {
      method: "POST",
      body: JSON.stringify({ id: 10, status: "IN_PROGRESS" }),
    });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(updatePadelMatch).toHaveBeenCalled();
    expect(recordOrganizationAuditSafe).toHaveBeenCalledWith(
      expect.objectContaining({ action: "PADEL_MATCH_RESULT" }),
    );
    expect(json.data?.match?.id ?? json.match?.id).toBe(10);
  });
});
