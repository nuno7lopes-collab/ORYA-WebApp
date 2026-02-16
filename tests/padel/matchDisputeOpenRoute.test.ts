import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const createSupabaseServer = vi.hoisted(() => vi.fn());
const getActiveOrganizationForUser = vi.hoisted(() => vi.fn());
const ensureMemberModuleAccess = vi.hoisted(() => vi.fn());
const recordOrganizationAuditSafe = vi.hoisted(() => vi.fn());
const updatePadelMatch = vi.hoisted(() => vi.fn());
const reconcilePadelDisputeAntiFraud = vi.hoisted(() => vi.fn());

const prisma = vi.hoisted(() => ({
  eventMatchSlot: { findUnique: vi.fn() },
  padelTournamentConfig: { findUnique: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock("@/lib/supabaseServer", () => ({ createSupabaseServer }));
vi.mock("@/lib/organizationContext", () => ({ getActiveOrganizationForUser }));
vi.mock("@/lib/organizationMemberAccess", () => ({ ensureMemberModuleAccess }));
vi.mock("@/lib/organizationAudit", () => ({ recordOrganizationAuditSafe }));
vi.mock("@/domain/padel/matches/commands", () => ({ updatePadelMatch }));
vi.mock("@/domain/padel/ratingAntiFraud", () => ({ reconcilePadelDisputeAntiFraud }));
vi.mock("@/lib/prisma", () => ({ prisma }));

let POST: typeof import("@/app/api/padel/matches/[id]/dispute/route").POST;

beforeEach(async () => {
  createSupabaseServer.mockReset();
  getActiveOrganizationForUser.mockReset();
  ensureMemberModuleAccess.mockReset();
  recordOrganizationAuditSafe.mockReset();
  updatePadelMatch.mockReset();
  reconcilePadelDisputeAntiFraud.mockReset();
  prisma.eventMatchSlot.findUnique.mockReset();
  prisma.padelTournamentConfig.findUnique.mockReset();
  prisma.$transaction.mockReset();

  prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(prisma));
  reconcilePadelDisputeAntiFraud.mockResolvedValue([]);

  vi.resetModules();
  POST = (await import("@/app/api/padel/matches/[id]/dispute/route")).POST;
});

describe("padel match dispute open route", () => {
  it("exige clientRequestId", async () => {
    createSupabaseServer.mockResolvedValue({
      auth: { getUser: vi.fn(async () => ({ data: { user: { id: "u1" } } })) },
    });
    prisma.eventMatchSlot.findUnique.mockResolvedValue({
      id: 12,
      status: "OFFICIAL",
      score: {},
      event: { id: 7, organizationId: 99 },
      pairingA: { slots: [] },
      pairingB: { slots: [] },
    });
    getActiveOrganizationForUser.mockResolvedValue({
      organization: { id: 99 },
      membership: { role: "ADMIN", rolePack: null },
    });
    ensureMemberModuleAccess.mockResolvedValue({ ok: true });

    const req = new NextRequest("http://localhost/api/padel/matches/12/dispute", {
      method: "POST",
      body: JSON.stringify({
        reason: "resultado errado",
        confirmationSource: "WEB_PUBLIC",
      }),
    });

    const res = await POST(req, { params: Promise.resolve({ id: "12" }) });
    expect(res.status).toBe(400);
  });

  it("responde idempotent replay quando já processado no mesmo scope", async () => {
    createSupabaseServer.mockResolvedValue({
      auth: { getUser: vi.fn(async () => ({ data: { user: { id: "u1" } } })) },
    });
    prisma.eventMatchSlot.findUnique.mockResolvedValue({
      id: 12,
      status: "DISPUTED",
      score: {
        liveWorkflow: {
          idempotency: {
            "7:12:dispute_result:u1:req-replay": {
              action: "dispute_result",
              actorId: "u1",
              scopeKey: "7:12:dispute_result:u1:req-replay",
              status: "DISPUTED",
              at: "2026-02-16T12:00:00.000Z",
            },
          },
        },
      },
      event: { id: 7, organizationId: 99 },
      pairingA: { slots: [] },
      pairingB: { slots: [] },
    });

    const req = new NextRequest("http://localhost/api/padel/matches/12/dispute", {
      method: "POST",
      body: JSON.stringify({
        reason: "resultado errado",
        confirmationSource: "WEB_PUBLIC",
        clientRequestId: "req-replay",
      }),
    });

    const res = await POST(req, { params: Promise.resolve({ id: "12" }) });
    expect(res.status).toBe(200);
    const payload = await res.json();
    expect(payload?.idempotentReplay).toBe(true);
    expect(updatePadelMatch).not.toHaveBeenCalled();
  });

  it("abre disputa com payload canónico e idempotência", async () => {
    createSupabaseServer.mockResolvedValue({
      auth: { getUser: vi.fn(async () => ({ data: { user: { id: "u1" } } })) },
    });
    prisma.eventMatchSlot.findUnique.mockResolvedValue({
      id: 14,
      status: "OFFICIAL",
      score: { resultType: "NORMAL" },
      event: { id: 9, organizationId: 55 },
      pairingA: { slots: [] },
      pairingB: { slots: [] },
    });
    getActiveOrganizationForUser.mockResolvedValue({
      organization: { id: 55 },
      membership: { role: "ADMIN", rolePack: null },
    });
    ensureMemberModuleAccess.mockResolvedValue({ ok: true });
    updatePadelMatch.mockResolvedValue({
      match: { id: 14, eventId: 9, status: "DISPUTED", score: { disputeStatus: "OPEN" } },
    });

    const req = new NextRequest("http://localhost/api/padel/matches/14/dispute", {
      method: "POST",
      body: JSON.stringify({
        reason: "score nao confere",
        confirmationSource: "WEB_PUBLIC",
        clientRequestId: "req-open-dispute",
      }),
    });

    const res = await POST(req, { params: Promise.resolve({ id: "14" }) });
    expect(res.status).toBe(200);
    expect(updatePadelMatch).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "DISPUTED",
          score: expect.objectContaining({
            disputeStatus: "OPEN",
            disputeReason: "score nao confere",
          }),
        }),
      }),
    );
  });
});
