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
const resolveIncidentAuthority = vi.hoisted(() => vi.fn());
const listTournamentDirectorUserIds = vi.hoisted(() => vi.fn());
const createNotification = vi.hoisted(() => vi.fn());
const shouldNotify = vi.hoisted(() => vi.fn(async () => true));

const prisma = vi.hoisted(() => ({
  eventMatchSlot: { findUnique: vi.fn() },
  padelPairing: { findUnique: vi.fn() },
  padelTournamentConfig: { findUnique: vi.fn() },
  padelTournamentRoleAssignment: { findMany: vi.fn() },
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
vi.mock("@/domain/padel/incidentGovernance", () => ({
  resolveIncidentAuthority,
  listTournamentDirectorUserIds,
}));
vi.mock("@/lib/notifications", () => ({ createNotification, shouldNotify }));
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
  resolveIncidentAuthority.mockReset();
  listTournamentDirectorUserIds.mockReset();
  createNotification.mockReset();
  shouldNotify.mockReset();
  prisma.eventMatchSlot.findUnique.mockReset();
  prisma.padelPairing.findUnique.mockReset();
  prisma.padelTournamentConfig.findUnique.mockReset();
  prisma.padelTournamentRoleAssignment.findMany.mockReset();
  prisma.$transaction.mockClear();
  shouldNotify.mockResolvedValue(true);
  resolveIncidentAuthority.mockResolvedValue({
    ok: true,
    confirmedByRole: "DIRETOR_PROVA",
    confirmationSource: "WEB_ORGANIZATION",
    isCriticalRound: false,
    actorTournamentRoles: ["DIRETOR_PROVA"],
  });
  listTournamentDirectorUserIds.mockResolvedValue([]);
  vi.resetModules();
  POST = (await import("@/app/api/padel/matches/[id]/walkover/route")).POST;
});

describe("padel match walkover route", () => {
  it("bloqueia sem permissão EDIT", async () => {
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
      membership: { role: "STAFF", rolePack: null },
    });
    ensureMemberModuleAccess.mockResolvedValue({ ok: false });

    const req = new NextRequest("http://localhost/api/padel/matches/1/walkover", {
      method: "POST",
      body: JSON.stringify({
        winner: "A",
        confirmedByRole: "DIRETOR_PROVA",
        confirmationSource: "WEB_ORGANIZATION",
      }),
    });

    const res = await POST(req, { params: Promise.resolve({ id: "1" }) });
    expect(res.status).toBe(403);
  });

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
    prisma.padelTournamentRoleAssignment.findMany.mockResolvedValue([{ userId: "u-dir" }]);
    updatePadelMatch.mockResolvedValue({
      match: { id: 1, eventId: 5, status: "DONE" },
    });

    const req = new NextRequest("http://localhost/api/padel/matches/1/walkover", {
      method: "POST",
      body: JSON.stringify({
        winner: "A",
        confirmedByRole: "DIRETOR_PROVA",
        confirmationSource: "WEB_ORGANIZATION",
      }),
    });

    const res = await POST(req, { params: Promise.resolve({ id: "1" }) });
    expect(res.status).toBe(200);
    expect(updatePadelMatch).toHaveBeenCalled();
    expect(recordOrganizationAuditSafe).toHaveBeenCalledWith(
      expect.objectContaining({ action: "PADEL_MATCH_WALKOVER" }),
    );
  });

  it("falha fechado quando falta diretor de prova no torneio", async () => {
    createSupabaseServer.mockResolvedValue({
      auth: { getUser: vi.fn(async () => ({ data: { user: { id: "u1" } } })) },
    });
    prisma.eventMatchSlot.findUnique.mockResolvedValue({
      id: 1,
      pairingAId: 11,
      pairingBId: 12,
      eventId: 5,
      status: "PENDING",
      roundType: "KNOCKOUT",
      roundLabel: "FINAL",
      event: { organizationId: 99 },
    });
    getActiveOrganizationForUser.mockResolvedValue({
      organization: { id: 99 },
      membership: { role: "ADMIN", rolePack: null },
    });
    ensureMemberModuleAccess.mockResolvedValue({ ok: true });
    resolveIncidentAuthority.mockResolvedValue({
      ok: false,
      status: 409,
      error: "MISSING_TOURNAMENT_DIRECTOR",
    });

    const req = new NextRequest("http://localhost/api/padel/matches/1/walkover", {
      method: "POST",
      body: JSON.stringify({
        winner: "A",
        confirmedByRole: "DIRETOR_PROVA",
        confirmationSource: "WEB_ORGANIZATION",
      }),
    });

    const res = await POST(req, { params: Promise.resolve({ id: "1" }) });
    expect(res.status).toBe(409);
  });

  it("exige metadados canónicos de confirmação", async () => {
    createSupabaseServer.mockResolvedValue({
      auth: { getUser: vi.fn(async () => ({ data: { user: { id: "u1" } } })) },
    });
    prisma.eventMatchSlot.findUnique.mockResolvedValue({
      id: 1,
      pairingAId: 11,
      pairingBId: 12,
      eventId: 5,
      status: "PENDING",
      roundType: "GROUPS",
      roundLabel: "G1",
      event: { organizationId: 99 },
    });

    const req = new NextRequest("http://localhost/api/padel/matches/1/walkover", {
      method: "POST",
      body: JSON.stringify({ winner: "A" }),
    });
    const res = await POST(req, { params: Promise.resolve({ id: "1" }) });
    expect(res.status).toBe(400);
  });

  it("notifica DIRETOR_PROVA quando confirmação vem de REFEREE", async () => {
    createSupabaseServer.mockResolvedValue({
      auth: { getUser: vi.fn(async () => ({ data: { user: { id: "u-ref" } } })) },
    });
    prisma.eventMatchSlot.findUnique.mockResolvedValue({
      id: 1,
      pairingAId: 11,
      pairingBId: 12,
      eventId: 5,
      status: "PENDING",
      roundType: "GROUPS",
      roundLabel: "G1",
      event: { organizationId: 99 },
    });
    getActiveOrganizationForUser.mockResolvedValue({
      organization: { id: 99 },
      membership: { role: "STAFF", rolePack: null },
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
    resolveIncidentAuthority.mockResolvedValue({
      ok: true,
      confirmedByRole: "REFEREE",
      confirmationSource: "WEB_ORGANIZATION",
      isCriticalRound: false,
      actorTournamentRoles: ["REFEREE"],
    });
    listTournamentDirectorUserIds.mockResolvedValue(["u-dir"]);
    const req = new NextRequest("http://localhost/api/padel/matches/1/walkover", {
      method: "POST",
      body: JSON.stringify({
        winner: "A",
        confirmedByRole: "REFEREE",
        confirmationSource: "WEB_ORGANIZATION",
      }),
    });

    const res = await POST(req, { params: Promise.resolve({ id: "1" }) });
    expect(res.status).toBe(200);
    expect(createNotification).toHaveBeenCalled();
  });
});
