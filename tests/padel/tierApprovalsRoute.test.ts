import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const createSupabaseServer = vi.hoisted(() => vi.fn());
const getActiveOrganizationForUser = vi.hoisted(() => vi.fn());
const ensureMemberModuleAccess = vi.hoisted(() => vi.fn());

const prisma = vi.hoisted(() => ({
  event: { findUnique: vi.fn() },
  padelTournamentTierApproval: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  $transaction: vi.fn(),
}));

vi.mock("@/lib/supabaseServer", () => ({ createSupabaseServer }));
vi.mock("@/lib/organizationContext", () => ({ getActiveOrganizationForUser }));
vi.mock("@/lib/organizationMemberAccess", () => ({ ensureMemberModuleAccess }));
vi.mock("@/lib/prisma", () => ({ prisma }));

let REQUEST_POST: typeof import("@/app/api/padel/tournaments/tier-approvals/request/route").POST;
let APPROVE_POST: typeof import("@/app/api/padel/tournaments/tier-approvals/[id]/approve/route").POST;
let REJECT_POST: typeof import("@/app/api/padel/tournaments/tier-approvals/[id]/reject/route").POST;

beforeEach(async () => {
  vi.resetModules();
  createSupabaseServer.mockReset();
  getActiveOrganizationForUser.mockReset();
  ensureMemberModuleAccess.mockReset();
  prisma.event.findUnique.mockReset();
  prisma.padelTournamentTierApproval.findUnique.mockReset();
  prisma.padelTournamentTierApproval.update.mockReset();
  prisma.$transaction.mockReset();

  createSupabaseServer.mockResolvedValue({
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: "u1" } } })) },
  });
  getActiveOrganizationForUser.mockResolvedValue({
    organization: { id: 99 },
    membership: { role: "ADMIN", rolePack: null },
  });
  ensureMemberModuleAccess.mockResolvedValue({ ok: true });

  REQUEST_POST = (await import("@/app/api/padel/tournaments/tier-approvals/request/route")).POST;
  APPROVE_POST = (await import("@/app/api/padel/tournaments/tier-approvals/[id]/approve/route")).POST;
  REJECT_POST = (await import("@/app/api/padel/tournaments/tier-approvals/[id]/reject/route")).POST;
});

describe("tier approvals routes", () => {
  it("request cria/atualiza approval PENDING para tier governado", async () => {
    prisma.event.findUnique.mockResolvedValue({
      id: 10,
      organizationId: 99,
      templateType: "PADEL",
    });

    const tx = {
      padelTournamentConfig: {
        findUnique: vi.fn().mockResolvedValue({ id: 101, advancedSettings: {} }),
        update: vi.fn(),
      },
      padelTournamentTierApproval: {
        upsert: vi.fn().mockResolvedValue({
          id: 55,
          eventId: 10,
          organizationId: 99,
          requestedTier: "OURO",
          status: "PENDING",
        }),
      },
    };
    prisma.$transaction.mockImplementation(async (fn: any) => fn(tx));

    const req = new NextRequest("http://localhost/api/padel/tournaments/tier-approvals/request", {
      method: "POST",
      body: JSON.stringify({ eventId: 10, tier: "OURO", reason: "Circuito oficial" }),
    });

    const res = await REQUEST_POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.approval.status).toBe("PENDING");
    expect(tx.padelTournamentConfig.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          advancedSettings: expect.objectContaining({ tournamentTier: "OURO" }),
        }),
      }),
    );
  });

  it("approve marca approval como APPROVED", async () => {
    prisma.padelTournamentTierApproval.findUnique.mockResolvedValue({
      id: 55,
      eventId: 10,
      organizationId: 99,
      requestedTier: "OURO",
    });

    const tx = {
      padelTournamentConfig: {
        findUnique: vi.fn().mockResolvedValue({ id: 101, advancedSettings: {} }),
        update: vi.fn(),
      },
      padelTournamentTierApproval: {
        update: vi.fn().mockResolvedValue({
          id: 55,
          status: "APPROVED",
          approvedTier: "OURO",
        }),
      },
    };
    prisma.$transaction.mockImplementation(async (fn: any) => fn(tx));

    const req = new NextRequest("http://localhost/api/padel/tournaments/tier-approvals/55/approve", {
      method: "POST",
      body: JSON.stringify({}),
    });

    const res = await APPROVE_POST(req, { params: Promise.resolve({ id: "55" }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.approval.status).toBe("APPROVED");
    expect(tx.padelTournamentTierApproval.update).toHaveBeenCalledTimes(1);
  });

  it("reject marca approval como REJECTED", async () => {
    prisma.padelTournamentTierApproval.findUnique.mockResolvedValue({
      id: 55,
      eventId: 10,
      organizationId: 99,
    });
    prisma.padelTournamentTierApproval.update.mockResolvedValue({
      id: 55,
      status: "REJECTED",
      approvedTier: null,
    });

    const req = new NextRequest("http://localhost/api/padel/tournaments/tier-approvals/55/reject", {
      method: "POST",
      body: JSON.stringify({ reason: "Critérios insuficientes" }),
    });

    const res = await REJECT_POST(req, { params: Promise.resolve({ id: "55" }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.approval.status).toBe("REJECTED");
    expect(prisma.padelTournamentTierApproval.update).toHaveBeenCalledTimes(1);
  });
});
