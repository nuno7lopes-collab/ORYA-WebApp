import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const createSupabaseServer = vi.hoisted(() => vi.fn());
const ensureOrganizationEmailVerified = vi.hoisted(() => vi.fn());
const ensureGroupMemberModuleAccess = vi.hoisted(() => vi.fn());
const resolveRegistrationStatusFromSlots = vi.hoisted(() => vi.fn(() => "PENDING"));
const upsertPadelRegistrationForPairing = vi.hoisted(() => vi.fn());
const recordOrganizationAuditSafe = vi.hoisted(() => vi.fn());
const cancelActiveHold = vi.hoisted(() => vi.fn());
const checkPadelRegistrationWindow = vi.hoisted(() => vi.fn(() => ({ ok: false })));

const prisma = vi.hoisted(() => {
  const padelPairingSlotUpdate = vi.fn();
  const padelPairingSlotUpdateMany = vi.fn();
  const padelPairingUpdate = vi.fn();
  return {
    event: { findUnique: vi.fn() },
    padelPairing: { findUnique: vi.fn(), findMany: vi.fn(), update: padelPairingUpdate },
    padelPairingSlot: { update: padelPairingSlotUpdate, updateMany: padelPairingSlotUpdateMany },
    padelTournamentConfig: { findUnique: vi.fn() },
    $transaction: vi.fn(async (fn: any) =>
      fn({
        padelPairingSlot: { update: padelPairingSlotUpdate, updateMany: padelPairingSlotUpdateMany },
        padelPairing: { update: padelPairingUpdate },
      }),
    ),
  };
});

vi.mock("@/lib/supabaseServer", () => ({ createSupabaseServer }));
vi.mock("@/lib/organizationWriteAccess", () => ({ ensureOrganizationEmailVerified }));
vi.mock("@/lib/organizationMemberAccess", () => ({ ensureGroupMemberModuleAccess }));
vi.mock("@/domain/padelRegistration", () => ({
  resolveRegistrationStatusFromSlots: (...args: any[]) => resolveRegistrationStatusFromSlots(...args),
  upsertPadelRegistrationForPairing: (...args: any[]) => upsertPadelRegistrationForPairing(...args),
  checkPadelRegistrationWindow: (...args: any[]) => checkPadelRegistrationWindow(...args),
}));
vi.mock("@/lib/organizationAudit", () => ({ recordOrganizationAuditSafe }));
vi.mock("@/domain/padelPairingHold", () => ({ cancelActiveHold }));
vi.mock("@/lib/prisma", () => ({ prisma }));

let swapPOST: typeof import("@/app/api/organizacao/padel/pairings/swap/route").POST;
let cancelPOST: typeof import("@/app/api/padel/pairings/[id]/cancel/route").POST;

beforeEach(async () => {
  createSupabaseServer.mockReset();
  ensureOrganizationEmailVerified.mockReset();
  ensureGroupMemberModuleAccess.mockReset();
  resolveRegistrationStatusFromSlots.mockReset();
  upsertPadelRegistrationForPairing.mockReset();
  recordOrganizationAuditSafe.mockReset();
  cancelActiveHold.mockReset();
  checkPadelRegistrationWindow.mockReset();
  prisma.event.findUnique.mockReset();
  prisma.padelPairing.findUnique.mockReset();
  prisma.padelPairing.findMany.mockReset();
  prisma.padelPairingSlot.update.mockReset();
  prisma.padelPairingSlot.updateMany.mockReset();
  prisma.padelTournamentConfig.findUnique.mockReset();
  prisma.$transaction.mockClear();
  vi.resetModules();
  swapPOST = (await import("@/app/api/organizacao/padel/pairings/swap/route")).POST;
  cancelPOST = (await import("@/app/api/padel/pairings/[id]/cancel/route")).POST;
});

describe("critical audit payloads", () => {
  it("grava audit no swap admin", async () => {
    createSupabaseServer.mockResolvedValue({
      auth: { getUser: vi.fn(async () => ({ data: { user: { id: "u1" } } })) },
    });
    ensureOrganizationEmailVerified.mockReturnValue({ ok: true });
    ensureGroupMemberModuleAccess.mockResolvedValue({ ok: true });
    prisma.event.findUnique.mockResolvedValue({
      organizationId: 99,
      templateType: "PADEL",
      organization: { officialEmail: "org@x.pt", officialEmailVerifiedAt: new Date() },
    });
    prisma.padelPairing.findMany.mockResolvedValue([
      {
        id: 1,
        eventId: 10,
        organizationId: 99,
        categoryId: 5,
        player1UserId: "capt-1",
        player2UserId: "partner-1",
        payment_mode: "SPLIT",
        pairingStatus: "INCOMPLETE",
        pairingJoinMode: "INVITE_PARTNER",
        registration: { status: "PENDING_PARTNER" },
        slots: [
          { id: 11, slot_role: "CAPTAIN", slotStatus: "FILLED", paymentStatus: "PAID" },
          {
            id: 12,
            slot_role: "PARTNER",
            slotStatus: "FILLED",
            paymentStatus: "UNPAID",
            ticketId: null,
            profileId: "profile-1",
            playerProfileId: "pp-1",
            invitedUserId: null,
            invitedContact: null,
          },
        ],
      },
      {
        id: 2,
        eventId: 10,
        organizationId: 99,
        categoryId: 5,
        player1UserId: "capt-2",
        player2UserId: "partner-2",
        payment_mode: "SPLIT",
        pairingStatus: "INCOMPLETE",
        pairingJoinMode: "INVITE_PARTNER",
        registration: { status: "PENDING_PARTNER" },
        slots: [
          { id: 21, slot_role: "CAPTAIN", slotStatus: "FILLED", paymentStatus: "PAID" },
          {
            id: 22,
            slot_role: "PARTNER",
            slotStatus: "FILLED",
            paymentStatus: "UNPAID",
            ticketId: null,
            profileId: "profile-2",
            playerProfileId: "pp-2",
            invitedUserId: null,
            invitedContact: null,
          },
        ],
      },
    ]);

    const req = new NextRequest("http://localhost/api/organizacao/padel/pairings/swap", {
      method: "POST",
      body: JSON.stringify({ eventId: 10, pairingAId: 1, pairingBId: 2 }),
    });

    const res = await swapPOST(req);
    expect(res.status).toBe(200);
    expect(recordOrganizationAuditSafe).toHaveBeenCalledWith(
      expect.objectContaining({ action: "PADEL_PAIRING_SWAP" }),
    );
  });

  it("grava audit no cancelamento", async () => {
    createSupabaseServer.mockResolvedValue({
      auth: { getUser: vi.fn(async () => ({ data: { user: { id: "capt-1" } } })) },
    });
    prisma.padelPairing.findUnique.mockResolvedValue({
      id: 5,
      organizationId: 99,
      eventId: 10,
      categoryId: 7,
      createdByUserId: "capt-1",
      pairingStatus: "INCOMPLETE",
      payment_mode: "SPLIT",
      event: { organizationId: 99 },
      slots: [
        { id: 1, slot_role: "CAPTAIN", slotStatus: "FILLED", paymentStatus: "PAID" },
        { id: 2, slot_role: "PARTNER", slotStatus: "PENDING", paymentStatus: "UNPAID" },
      ],
    });
    prisma.padelTournamentConfig.findUnique.mockResolvedValue({
      advancedSettings: { waitlistEnabled: false },
      splitDeadlineHours: 24,
      lifecycleStatus: "DRAFT",
    });
    prisma.event.findUnique.mockResolvedValue({ startsAt: new Date(), status: "DRAFT" });

    const req = new NextRequest("http://localhost/api/padel/pairings/5/cancel", {
      method: "POST",
    });
    const res = await cancelPOST(req, { params: Promise.resolve({ id: "5" }) });
    expect(res.status).toBe(200);
    expect(recordOrganizationAuditSafe).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "PADEL_PAIRING_CANCELLED",
        metadata: expect.objectContaining({ pairingId: 5, eventId: 10 }),
      }),
    );
  });
});
