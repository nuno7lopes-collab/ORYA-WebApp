import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const createSupabaseServer = vi.hoisted(() => vi.fn(async () => ({})));
const getUserWithPolicy = vi.hoisted(() => vi.fn());
const prismaPadelPairingFindMany = vi.hoisted(() => vi.fn());

vi.mock("@/lib/http/withApiEnvelope", () => ({
  withApiEnvelope: (handler: unknown) => handler,
}));

vi.mock("@/lib/supabaseServer", () => ({ createSupabaseServer }));

vi.mock("@/lib/auth/getUserWithPolicy", () => ({
  getUserWithPolicy: (...args: unknown[]) => getUserWithPolicy(...args),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    padelPairing: {
      findMany: (...args: unknown[]) => prismaPadelPairingFindMany(...args),
    },
  },
}));

describe("GET /api/padel/pairings/my", () => {
  beforeEach(() => {
    createSupabaseServer.mockClear();
    getUserWithPolicy.mockReset();
    prismaPadelPairingFindMany.mockReset();
  });

  it("devolve 401 quando nao autenticado", async () => {
    getUserWithPolicy.mockResolvedValue({
      data: { user: null },
      error: { message: "UNAUTHENTICATED" },
    });

    const { GET } = await import("@/app/api/padel/pairings/my/route");
    const req = new NextRequest("http://localhost/api/padel/pairings/my");
    const res = await GET(req);
    const body = await res.json();
    const payload = body.result ?? body.data ?? body;

    expect(res.status).toBe(401);
    expect(payload.error).toBe("UNAUTHENTICATED");
  });

  it("lista pairings do utilizador e filtra registos inativos", async () => {
    getUserWithPolicy.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    prismaPadelPairingFindMany.mockResolvedValue([
      {
        id: 10,
        eventId: 2229,
        categoryId: 42,
        payment_mode: "SPLIT",
        pairingStatus: "INCOMPLETE",
        pairingJoinMode: "LOOKING_FOR_PARTNER",
        partnerInviteToken: "abc-token",
        createdByUserId: "user-1",
        registration: { status: "PENDING_PARTNER" },
        slots: [
          {
            id: 1,
            slot_role: "CAPTAIN",
            slotStatus: "FILLED",
            paymentStatus: "PAID",
            profileId: "user-1",
            invitedUserId: null,
            invitedContact: null,
            registrationLines: [
              {
                saleLines: [
                  {
                    entitlements: [
                      { ticket: { id: "tk_999", status: "PAID", stripePaymentIntentId: "pi_123" } },
                    ],
                  },
                ],
              },
            ],
          },
        ],
        event: {
          id: 2229,
          slug: "torneio-top-padel",
          title: "Top Padel Open",
          organizationId: 2,
          templateType: "PADEL",
        },
        category: { label: "M3" },
      },
      {
        id: 11,
        eventId: 2229,
        categoryId: 42,
        payment_mode: "SPLIT",
        pairingStatus: "CANCELLED",
        pairingJoinMode: "LOOKING_FOR_PARTNER",
        partnerInviteToken: null,
        createdByUserId: "user-1",
        registration: { status: "CANCELLED" },
        slots: [],
        event: {
          id: 2229,
          slug: "torneio-top-padel",
          title: "Top Padel Open",
          organizationId: 2,
          templateType: "PADEL",
        },
        category: { label: "M3" },
      },
    ]);

    const { GET } = await import("@/app/api/padel/pairings/my/route");
    const req = new NextRequest("http://localhost/api/padel/pairings/my?eventId=2229");
    const res = await GET(req);
    const body = await res.json();
    const payload = body.result ?? body.data ?? body;

    expect(res.status).toBe(200);
    expect(prismaPadelPairingFindMany).toHaveBeenCalledTimes(1);
    const queryArg = prismaPadelPairingFindMany.mock.calls[0]?.[0];
    expect(queryArg?.where?.eventId).toBe(2229);
    expect(payload.pairings).toHaveLength(1);
    expect(payload.pairings[0]).toMatchObject({
      id: 10,
      eventId: 2229,
      categoryId: 42,
      paymentMode: "SPLIT",
      inviteToken: "abc-token",
      category: { label: "M3" },
      event: {
        id: 2229,
        slug: "torneio-top-padel",
      },
    });
    expect(payload.pairings[0]?.slots?.[0]?.ticket).toMatchObject({
      id: "tk_999",
      status: "PAID",
      stripePaymentIntentId: "pi_123",
    });
  });
});
