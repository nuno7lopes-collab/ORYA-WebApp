import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const prismaPairingFindMany = vi.hoisted(() => vi.fn());
const enforcePublicRateLimit = vi.hoisted(() => vi.fn(async () => null));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    padelPairing: { findMany: prismaPairingFindMany },
  },
}));

vi.mock("@/lib/padel/publicRateLimit", () => ({
  enforcePublicRateLimit: (...args: unknown[]) => enforcePublicRateLimit(...args),
}));

vi.mock("@/domain/padelRegistration", () => ({
  INACTIVE_REGISTRATION_STATUSES: ["CANCELLED", "WITHDRAWN"],
  checkPadelRegistrationWindow: vi.fn(() => ({ ok: true })),
}));

describe("GET /api/padel/public/open-pairings", () => {
  beforeEach(() => {
    prismaPairingFindMany.mockReset();
    enforcePublicRateLimit.mockClear();
    prismaPairingFindMany.mockResolvedValue([]);
  });

  it("aplica city no filtro de evento", async () => {
    const { GET } = await import("@/app/api/padel/public/open-pairings/route");
    const req = new NextRequest("http://localhost/api/padel/public/open-pairings?city=Lisboa");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.result?.ok ?? body.ok).toBe(true);
    const args = prismaPairingFindMany.mock.calls[0]?.[0];
    expect(args?.where?.event?.addressRef?.formattedAddress?.contains).toBe("Lisboa");
  });

  it("valida paymentMode inválido", async () => {
    const { GET } = await import("@/app/api/padel/public/open-pairings/route");
    const req = new NextRequest("http://localhost/api/padel/public/open-pairings?paymentMode=INVALIDO");
    const res = await GET(req);
    const body = await res.json();
    const payload = body.result ?? body;

    expect(res.status).toBe(400);
    expect(payload.error).toBe("INVALID_PAYMENT_MODE");
  });

  it("aplica filtros opcionais paymentMode/date/level", async () => {
    const { GET } = await import("@/app/api/padel/public/open-pairings/route");
    const req = new NextRequest(
      "http://localhost/api/padel/public/open-pairings?paymentMode=SPLIT&date=today&level=3",
    );
    const res = await GET(req);
    await res.json();

    expect(res.status).toBe(200);
    const args = prismaPairingFindMany.mock.calls[0]?.[0];
    expect(args?.where?.payment_mode).toBe("SPLIT");
    expect(args?.where?.event?.startsAt?.gte).toBeInstanceOf(Date);
    expect(args?.where?.event?.startsAt?.lte).toBeInstanceOf(Date);
  });

  it("exclui eventos sem policy pública e sanitiza seekingPlayers", async () => {
    prismaPairingFindMany.mockResolvedValue([
      {
        id: 101,
        payment_mode: "SPLIT",
        deadlineAt: new Date("2026-03-10T10:00:00.000Z"),
        category: { id: 7, label: "M3" },
        slots: [
          {
            id: 1,
            slotStatus: "FILLED",
            profile: { fullName: "Ana Silva", username: "ana", avatarUrl: null },
            playerProfile: { level: "3" },
          },
          {
            id: 2,
            slotStatus: "PENDING",
            profile: null,
            playerProfile: null,
          },
        ],
        event: {
          id: 900,
          slug: "evento-publico",
          title: "Evento Público",
          startsAt: new Date("2026-04-01T10:00:00.000Z"),
          status: "PUBLISHED",
          addressId: "addr_1",
          addressRef: { formattedAddress: "Lisboa", canonical: null },
          coverImageUrl: null,
          padelTournamentConfig: {
            advancedSettings: { competitionState: "DEVELOPMENT" },
            lifecycleStatus: null,
          },
          accessPolicies: [{ mode: "PUBLIC" }],
        },
      },
      {
        id: 102,
        payment_mode: "SPLIT",
        deadlineAt: new Date("2026-03-10T10:00:00.000Z"),
        category: { id: 7, label: "M3" },
        slots: [
          {
            id: 1,
            slotStatus: "FILLED",
            profile: { fullName: "Jogador Privado", username: "privado", avatarUrl: null },
            playerProfile: { level: "3" },
          },
        ],
        event: {
          id: 901,
          slug: "evento-privado",
          title: "Evento Privado",
          startsAt: new Date("2026-04-01T10:00:00.000Z"),
          status: "PUBLISHED",
          addressId: "addr_2",
          addressRef: { formattedAddress: "Porto", canonical: null },
          coverImageUrl: null,
          padelTournamentConfig: {
            advancedSettings: { competitionState: "DEVELOPMENT" },
            lifecycleStatus: null,
          },
          accessPolicies: [{ mode: "INVITE_ONLY" }],
        },
      },
    ]);

    const { GET } = await import("@/app/api/padel/public/open-pairings/route");
    const req = new NextRequest("http://localhost/api/padel/public/open-pairings");
    const res = await GET(req);
    const body = await res.json();
    const payload = body.result ?? body;
    const items = payload.items ?? [];

    expect(res.status).toBe(200);
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe(101);
    expect(items[0].seekingPlayers).toHaveLength(1);
    expect(items[0].seekingPlayers[0]).toMatchObject({
      displayName: "Ana Silva",
      username: "ana",
      avatarUrl: null,
      level: "3",
    });
    expect(items[0].seekingPlayers[0]).not.toHaveProperty("profileId");
    expect(items[0].seekingPlayers[0]).not.toHaveProperty("playerProfileId");
    expect(items[0].seekingPlayers[0]).not.toHaveProperty("preferredSide");
    expect(items[0].seekingPlayers[0]).not.toHaveProperty("gender");
    expect(items[0].averageLevel).toBe(3);
  });
});
