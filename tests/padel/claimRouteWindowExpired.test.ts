import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const createSupabaseServer = vi.hoisted(() => vi.fn());
const ensurePadelPlayerProfileId = vi.hoisted(() => vi.fn());
const isPadelClaimWindowExpiredError = vi.hoisted(() => vi.fn());
const ensurePadelRatingActionAllowed = vi.hoisted(() => vi.fn());
const checkPadelCategoryLimit = vi.hoisted(() => vi.fn());
const checkPadelCategoryPlayerCapacity = vi.hoisted(() => vi.fn());
const checkPadelRegistrationWindow = vi.hoisted(() => vi.fn());
const validateEligibility = vi.hoisted(() => vi.fn());
const getPadelOnboardingMissing = vi.hoisted(() => vi.fn());
const isPadelOnboardingComplete = vi.hoisted(() => vi.fn());
const validatePadelCategoryAccess = vi.hoisted(() => vi.fn());

const prisma = vi.hoisted(() => ({
  padelPairing: { findFirst: vi.fn() },
  event: { findUnique: vi.fn() },
  padelTournamentConfig: { findUnique: vi.fn() },
  profile: { findUnique: vi.fn() },
  padelCategory: { findUnique: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock("@/lib/supabaseServer", () => ({ createSupabaseServer }));
vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/domain/padel/playerProfile", () => ({
  ensurePadelPlayerProfileId,
  isPadelClaimWindowExpiredError,
}));
vi.mock("@/app/api/padel/_ratingGate", () => ({ ensurePadelRatingActionAllowed }));
vi.mock("@/domain/padelCategoryLimit", () => ({ checkPadelCategoryLimit }));
vi.mock("@/domain/padelCategoryCapacity", () => ({ checkPadelCategoryPlayerCapacity }));
vi.mock("@/domain/padelEligibility", () => ({ validateEligibility }));
vi.mock("@/domain/padelOnboarding", () => ({ getPadelOnboardingMissing, isPadelOnboardingComplete }));
vi.mock("@/domain/padelCategoryAccess", () => ({ validatePadelCategoryAccess }));
vi.mock("@/domain/padelRegistration", () => ({
  checkPadelRegistrationWindow,
  INACTIVE_REGISTRATION_STATUSES: ["CANCELLED", "EXPIRED", "REFUNDED"],
  mapRegistrationToPairingLifecycle: vi.fn(() => "PENDING_PARTNER"),
  resolvePartnerActionStatus: vi.fn(() => "CONFIRMED"),
  upsertPadelRegistrationForPairing: vi.fn(async () => ({})),
}));
vi.mock("@/domain/tournaments/ensureEntriesForConfirmedPairing", () => ({
  ensureEntriesForConfirmedPairing: vi.fn(async () => ({})),
}));
vi.mock("@/lib/padel/eventSnapshot", () => ({
  buildPadelEventSnapshot: vi.fn(async () => ({})),
}));

let POST: typeof import("@/app/api/padel/pairings/claim/[token]/route").POST;

beforeEach(async () => {
  vi.resetModules();
  createSupabaseServer.mockReset();
  ensurePadelPlayerProfileId.mockReset();
  isPadelClaimWindowExpiredError.mockReset();
  ensurePadelRatingActionAllowed.mockReset();
  checkPadelCategoryLimit.mockReset();
  checkPadelCategoryPlayerCapacity.mockReset();
  checkPadelRegistrationWindow.mockReset();
  validateEligibility.mockReset();
  getPadelOnboardingMissing.mockReset();
  isPadelOnboardingComplete.mockReset();
  validatePadelCategoryAccess.mockReset();
  prisma.padelPairing.findFirst.mockReset();
  prisma.event.findUnique.mockReset();
  prisma.padelTournamentConfig.findUnique.mockReset();
  prisma.profile.findUnique.mockReset();
  prisma.padelCategory.findUnique.mockReset();
  prisma.$transaction.mockReset();

  createSupabaseServer.mockResolvedValue({
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: "u1", email: "u1@example.com" } } })) },
  });
  ensurePadelRatingActionAllowed.mockResolvedValue({ ok: true });
  checkPadelRegistrationWindow.mockReturnValue({ ok: true });
  checkPadelCategoryLimit.mockResolvedValue({ ok: true });
  checkPadelCategoryPlayerCapacity.mockResolvedValue({ ok: true });
  validateEligibility.mockReturnValue({ ok: true });
  getPadelOnboardingMissing.mockReturnValue([]);
  isPadelOnboardingComplete.mockReturnValue(true);
  validatePadelCategoryAccess.mockReturnValue({ ok: true });
  isPadelClaimWindowExpiredError.mockImplementation(
    (err: unknown) => err instanceof Error && err.message === "CLAIM_WINDOW_EXPIRED",
  );
  ensurePadelPlayerProfileId.mockRejectedValue(new Error("CLAIM_WINDOW_EXPIRED"));

  prisma.padelPairing.findFirst
    .mockResolvedValueOnce({
      id: 77,
      eventId: 10,
      organizationId: 99,
      categoryId: null,
      player1UserId: "captain-1",
      player2UserId: null,
      pairingStatus: "PENDING",
      registration: { status: "PENDING_PARTNER" },
      payment_mode: "SPLIT",
      partnerLinkExpiresAt: null,
      deadlineAt: null,
      graceUntilAt: null,
      guaranteeStatus: "PENDING",
      slots: [
        {
          id: 701,
          slotStatus: "PENDING",
          paymentStatus: "PENDING",
          slot_role: "PARTNER",
          profileId: null,
          invitedContact: null,
        },
      ],
    })
    .mockResolvedValueOnce(null);
  prisma.event.findUnique.mockResolvedValue({
    status: "PUBLISHED",
    startsAt: new Date("2026-02-13T10:00:00.000Z"),
  });
  prisma.padelTournamentConfig.findUnique
    .mockResolvedValueOnce({ advancedSettings: {}, lifecycleStatus: "PUBLISHED" })
    .mockResolvedValueOnce({ eligibilityType: "OPEN" });
  prisma.profile.findUnique
    .mockResolvedValueOnce({ gender: "MALE" })
    .mockResolvedValueOnce({
      gender: "FEMALE",
      fullName: "Partner User",
      username: "partner.user",
      contactPhone: "+351111111111",
      padelLevel: "4",
      padelPreferredSide: "DIREITA",
    });
  prisma.padelCategory.findUnique.mockResolvedValue(null);
  prisma.$transaction.mockImplementation(async (fn: any) => fn({}));

  POST = (await import("@/app/api/padel/pairings/claim/[token]/route")).POST;
});

describe("POST /api/padel/pairings/claim/[token]", () => {
  it("devolve 409 CLAIM_WINDOW_EXPIRED quando claim retroativo está fora da janela", async () => {
    const req = new NextRequest("http://localhost/api/padel/pairings/claim/token-1", {
      method: "POST",
    });

    const res = await POST(req, { params: Promise.resolve({ token: "token-1" }) });
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.ok).toBe(false);
    expect(body.error).toBe("CLAIM_WINDOW_EXPIRED");
    expect(ensurePadelPlayerProfileId).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ retroactiveClaimMonths: 6 }),
    );
  });
});
