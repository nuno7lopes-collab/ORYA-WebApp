import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const createSupabaseServer = vi.hoisted(() => vi.fn());
const getUserWithPolicy = vi.hoisted(() => vi.fn());
const ensurePadelRatingActionAllowed = vi.hoisted(() => vi.fn());

const prisma = vi.hoisted(() => ({
  padelPairing: {
    findUnique: vi.fn(),
  },
  profile: {
    findUnique: vi.fn(),
  },
  $transaction: vi.fn(),
  padelPairingSlot: {
    update: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/lib/supabaseServer", () => ({ createSupabaseServer }));
vi.mock("@/lib/auth/getUserWithPolicy", () => ({ getUserWithPolicy }));
vi.mock("@/app/api/padel/_ratingGate", () => ({ ensurePadelRatingActionAllowed }));

describe("Idempotência pairings invite actions", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    createSupabaseServer.mockResolvedValue({});
    getUserWithPolicy.mockResolvedValue({
      data: { user: { id: "user-1", email: "user@example.com" } },
    });
    ensurePadelRatingActionAllowed.mockResolvedValue({ ok: true });
    prisma.profile.findUnique.mockResolvedValue({ username: "user1" });
  });

  it("accept devolve 200 idempotentReplay quando já aceite pelo mesmo utilizador", async () => {
    prisma.padelPairing.findUnique.mockResolvedValue({
      id: 42,
      organizationId: 9,
      eventId: 300,
      categoryId: null,
      player1UserId: "captain-1",
      player2UserId: "user-1",
      pairingStatus: "OPEN",
      payment_mode: "SPLIT",
      deadlineAt: null,
      guaranteeStatus: "PENDING",
      graceUntilAt: null,
      registration: null,
      slots: [],
    });

    const { POST } = await import("@/app/api/padel/pairings/[id]/accept/route");
    const req = new NextRequest("http://localhost/api/padel/pairings/42/accept", { method: "POST" });
    const res = await POST(req, { params: Promise.resolve({ id: "42" }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.idempotentReplay).toBe(true);
  });

  it("decline devolve 200 idempotentReplay quando a pairing já está cancelada", async () => {
    prisma.padelPairing.findUnique.mockResolvedValue({
      id: 99,
      pairingStatus: "CANCELLED",
      player1UserId: "captain-1",
      player2UserId: "user-1",
      slots: [],
    });

    const { POST } = await import("@/app/api/padel/pairings/[id]/decline/route");
    const req = new NextRequest("http://localhost/api/padel/pairings/99/decline", { method: "POST" });
    const res = await POST(req, { params: Promise.resolve({ id: "99" }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.idempotentReplay).toBe(true);
  });

  it("decline devolve 200 idempotentReplay quando já não existe convite pendente", async () => {
    prisma.padelPairing.findUnique.mockResolvedValue({
      id: 100,
      pairingStatus: "OPEN",
      player1UserId: "captain-1",
      player2UserId: null,
      slots: [
        {
          id: 1,
          slot_role: "PARTNER",
          slotStatus: "FILLED",
          paymentStatus: "UNPAID",
          invitedUserId: null,
          invitedContact: null,
        },
      ],
    });

    const { POST } = await import("@/app/api/padel/pairings/[id]/decline/route");
    const req = new NextRequest("http://localhost/api/padel/pairings/100/decline", { method: "POST" });
    const res = await POST(req, { params: Promise.resolve({ id: "100" }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.idempotentReplay).toBe(true);
  });
});
