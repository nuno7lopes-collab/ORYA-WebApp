import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const prismaEventFindMany = vi.hoisted(() => vi.fn());
const enforcePublicRateLimit = vi.hoisted(() => vi.fn(async () => null));
const resolvePadelCompetitionState = vi.hoisted(() => vi.fn(() => "PUBLIC"));
const deriveIsFreeEvent = vi.hoisted(() => vi.fn(() => true));
const parsePadelFormat = vi.hoisted(() => vi.fn(() => null));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    event: { findMany: prismaEventFindMany },
  },
}));

vi.mock("@/lib/padel/publicRateLimit", () => ({
  enforcePublicRateLimit: (...args: unknown[]) => enforcePublicRateLimit(...args),
}));

vi.mock("@/domain/padelCompetitionState", () => ({
  resolvePadelCompetitionState: (...args: unknown[]) => resolvePadelCompetitionState(...args),
}));

vi.mock("@/domain/events/derivedIsFree", () => ({
  deriveIsFreeEvent: (...args: unknown[]) => deriveIsFreeEvent(...args),
}));

vi.mock("@/domain/padel/formatCatalog", () => ({
  parsePadelFormat: (...args: unknown[]) => parsePadelFormat(...args),
}));

describe("GET /api/padel/discover", () => {
  beforeEach(() => {
    prismaEventFindMany.mockReset();
    enforcePublicRateLimit.mockClear();
    resolvePadelCompetitionState.mockClear();
    deriveIsFreeEvent.mockClear();
    parsePadelFormat.mockClear();
    prismaEventFindMany.mockResolvedValue([]);
  });

  it("aplica filtro city no where", async () => {
    const { GET } = await import("@/app/api/padel/discover/route");
    const req = new NextRequest("http://localhost/api/padel/discover?city=Porto");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.result?.ok ?? body.ok).toBe(true);
    const args = prismaEventFindMany.mock.calls[0]?.[0];
    expect(args?.where?.AND).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          addressRef: expect.objectContaining({
            formattedAddress: expect.objectContaining({
              contains: "Porto",
            }),
          }),
        }),
      ]),
    );
  });

  it("exclui eventos sem access policy pública", async () => {
    prismaEventFindMany.mockResolvedValue([
      {
        id: 10,
        slug: "open-event",
        title: "Open",
        startsAt: new Date("2026-03-01T10:00:00.000Z"),
        endsAt: null,
        coverImageUrl: null,
        addressId: "addr_1",
        addressRef: { formattedAddress: "Lisboa", canonical: null },
        status: "PUBLISHED",
        ticketTypes: [{ price: 0, status: "ACTIVE" }],
        organization: { publicName: "Org A", username: "orga" },
        padelTournamentConfig: {
          format: "AMERICANO",
          eligibilityType: null,
          padelClubId: null,
          advancedSettings: { competitionState: "PUBLIC" },
          padelV2Enabled: true,
          splitDeadlineHours: null,
          lifecycleStatus: null,
        },
        accessPolicies: [{ mode: "PUBLIC" }],
        padelCategoryLinks: [],
      },
      {
        id: 11,
        slug: "private-event",
        title: "Private",
        startsAt: new Date("2026-03-02T10:00:00.000Z"),
        endsAt: null,
        coverImageUrl: null,
        addressId: "addr_2",
        addressRef: { formattedAddress: "Porto", canonical: null },
        status: "PUBLISHED",
        ticketTypes: [{ price: 0, status: "ACTIVE" }],
        organization: { publicName: "Org B", username: "orgb" },
        padelTournamentConfig: {
          format: "AMERICANO",
          eligibilityType: null,
          padelClubId: null,
          advancedSettings: { competitionState: "PUBLIC" },
          padelV2Enabled: true,
          splitDeadlineHours: null,
          lifecycleStatus: null,
        },
        accessPolicies: [{ mode: "INVITE_ONLY" }],
        padelCategoryLinks: [],
      },
    ]);

    const { GET } = await import("@/app/api/padel/discover/route");
    const req = new NextRequest("http://localhost/api/padel/discover");
    const res = await GET(req);
    const body = await res.json();
    const payload = body.result ?? body;
    const items = payload.items ?? [];

    expect(res.status).toBe(200);
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe(10);
  });
});
