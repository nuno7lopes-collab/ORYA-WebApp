import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const createSupabaseServer = vi.hoisted(() => vi.fn());
const getActiveOrganizationForUser = vi.hoisted(() => vi.fn());
const ensureMemberModuleAccess = vi.hoisted(() => vi.fn());
const recordOrganizationAuditSafe = vi.hoisted(() => vi.fn());
const updatePadelMatch = vi.hoisted(() => vi.fn());
const resolveIncidentAuthority = vi.hoisted(() => vi.fn());
const listTournamentDirectorUserIds = vi.hoisted(() => vi.fn());
const createNotification = vi.hoisted(() => vi.fn());
const shouldNotify = vi.hoisted(() => vi.fn(async () => true));

const prisma = vi.hoisted(() => ({
  eventMatchSlot: { findUnique: vi.fn() },
  padelTournamentConfig: { findUnique: vi.fn() },
  padelTournamentRoleAssignment: { findMany: vi.fn() },
}));

vi.mock("@/lib/supabaseServer", () => ({ createSupabaseServer }));
vi.mock("@/lib/organizationContext", () => ({ getActiveOrganizationForUser }));
vi.mock("@/lib/organizationMemberAccess", () => ({ ensureMemberModuleAccess }));
vi.mock("@/lib/organizationAudit", () => ({ recordOrganizationAuditSafe }));
vi.mock("@/domain/padel/matches/commands", () => ({ updatePadelMatch }));
vi.mock("@/domain/padel/incidentGovernance", () => ({
  resolveIncidentAuthority,
  listTournamentDirectorUserIds,
}));
vi.mock("@/lib/notifications", () => ({ createNotification, shouldNotify }));
vi.mock("@/lib/prisma", () => ({ prisma }));

let PATCH: typeof import("@/app/api/padel/matches/[id]/dispute/route").PATCH;

beforeEach(async () => {
  createSupabaseServer.mockReset();
  getActiveOrganizationForUser.mockReset();
  ensureMemberModuleAccess.mockReset();
  recordOrganizationAuditSafe.mockReset();
  updatePadelMatch.mockReset();
  resolveIncidentAuthority.mockReset();
  listTournamentDirectorUserIds.mockReset();
  createNotification.mockReset();
  shouldNotify.mockReset();
  prisma.eventMatchSlot.findUnique.mockReset();
  prisma.padelTournamentConfig.findUnique.mockReset();
  prisma.padelTournamentRoleAssignment.findMany.mockReset();

  resolveIncidentAuthority.mockResolvedValue({
    ok: true,
    confirmedByRole: "DIRETOR_PROVA",
    confirmationSource: "WEB_ORGANIZATION",
    isCriticalRound: false,
    actorTournamentRoles: ["DIRETOR_PROVA"],
  });
  listTournamentDirectorUserIds.mockResolvedValue([]);
  shouldNotify.mockResolvedValue(true);

  vi.resetModules();
  PATCH = (await import("@/app/api/padel/matches/[id]/dispute/route")).PATCH;
});

describe("padel match dispute resolve route", () => {
  it("falha fechado quando não existe DIRETOR_PROVA no torneio", async () => {
    createSupabaseServer.mockResolvedValue({
      auth: { getUser: vi.fn(async () => ({ data: { user: { id: "u1" } } })) },
    });
    prisma.eventMatchSlot.findUnique.mockResolvedValue({
      id: 50,
      status: "DONE",
      score: { disputeStatus: "OPEN" },
      roundType: "KNOCKOUT",
      roundLabel: "FINAL",
      event: { id: 10, organizationId: 99 },
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

    const req = new NextRequest("http://localhost/api/padel/matches/50/dispute", {
      method: "PATCH",
      body: JSON.stringify({
        resolutionStatus: "CONFIRMED",
        confirmationSource: "WEB_ORGANIZATION",
        resolutionNote: "ok",
      }),
    });

    const res = await PATCH(req, { params: Promise.resolve({ id: "50" }) });
    expect(res.status).toBe(409);
  });

  it("resolve disputa com metadados canónicos", async () => {
    createSupabaseServer.mockResolvedValue({
      auth: { getUser: vi.fn(async () => ({ data: { user: { id: "u1" } } })) },
    });
    prisma.eventMatchSlot.findUnique.mockResolvedValue({
      id: 50,
      status: "DONE",
      score: { disputeStatus: "OPEN", ruleSnapshot: { source: "DEFAULT" } },
      roundType: "GROUPS",
      roundLabel: "G1",
      event: { id: 10, organizationId: 99 },
    });
    prisma.padelTournamentConfig.findUnique.mockResolvedValue({ ruleSetId: null, ruleSetVersionId: null });
    getActiveOrganizationForUser.mockResolvedValue({
      organization: { id: 99 },
      membership: { role: "ADMIN", rolePack: null },
    });
    ensureMemberModuleAccess.mockResolvedValue({ ok: true });
    resolveIncidentAuthority.mockResolvedValue({
      ok: true,
      confirmedByRole: "DIRETOR_PROVA",
      confirmationSource: "WEB_ORGANIZATION",
      isCriticalRound: false,
      actorTournamentRoles: ["DIRETOR_PROVA"],
    });
    updatePadelMatch.mockResolvedValue({
      match: { id: 50, eventId: 10 },
    });

    const req = new NextRequest("http://localhost/api/padel/matches/50/dispute", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        resolutionStatus: "CORRECTED",
        confirmationSource: "WEB_ORGANIZATION",
        resolutionNote: "resultado corrigido",
      }),
    });

    const res = await PATCH(req, { params: Promise.resolve({ id: "50" }) });
    expect(res.status).toBe(200);
    expect(updatePadelMatch).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          score: expect.objectContaining({
            disputeStatus: "RESOLVED",
            disputeResolutionStatus: "CORRECTED",
            disputeResolvedRole: "DIRETOR_PROVA",
            disputeResolutionSource: "WEB_ORGANIZATION",
          }),
        }),
      }),
    );
    expect(recordOrganizationAuditSafe).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "PADEL_MATCH_DISPUTE_RESOLVE",
        metadata: expect.objectContaining({
          matchId: 50,
          eventId: 10,
          resolutionStatus: "CORRECTED",
        }),
      }),
    );
  });

  it("notifica DIRETOR_PROVA quando disputa é resolvida por REFEREE", async () => {
    createSupabaseServer.mockResolvedValue({
      auth: { getUser: vi.fn(async () => ({ data: { user: { id: "u-ref" } } })) },
    });
    prisma.eventMatchSlot.findUnique.mockResolvedValue({
      id: 51,
      status: "DONE",
      score: { disputeStatus: "OPEN", ruleSnapshot: { source: "DEFAULT" } },
      roundType: "GROUPS",
      roundLabel: "G2",
      event: { id: 11, organizationId: 99 },
    });
    prisma.padelTournamentConfig.findUnique.mockResolvedValue({ ruleSetId: null, ruleSetVersionId: null });
    prisma.padelTournamentRoleAssignment.findMany.mockResolvedValue([{ userId: "u-dir" }]);
    getActiveOrganizationForUser.mockResolvedValue({
      organization: { id: 99 },
      membership: { role: "STAFF", rolePack: null },
    });
    ensureMemberModuleAccess.mockResolvedValue({ ok: true });
    resolveIncidentAuthority.mockResolvedValue({
      ok: true,
      confirmedByRole: "REFEREE",
      confirmationSource: "WEB_ORGANIZATION",
      isCriticalRound: false,
      actorTournamentRoles: ["REFEREE"],
    });
    listTournamentDirectorUserIds.mockResolvedValue(["u-dir"]);
    updatePadelMatch.mockResolvedValue({
      match: { id: 51, eventId: 11 },
    });

    const req = new NextRequest("http://localhost/api/padel/matches/51/dispute", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        resolutionStatus: "CONFIRMED",
        confirmationSource: "WEB_ORGANIZATION",
      }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "51" }) });
    expect(res.status).toBe(200);
    expect(createNotification).toHaveBeenCalled();
  });
});
