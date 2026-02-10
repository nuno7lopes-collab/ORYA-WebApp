import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaUserEventSignalFindMany = vi.hoisted(() => vi.fn());
const prismaTicketFindMany = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({
  prisma: {
    userEventSignal: {
      findMany: prismaUserEventSignalFindMany,
    },
    ticket: {
      findMany: prismaTicketFindMany,
    },
  },
}));

const getOrganizationFollowingSet = vi.hoisted(() => vi.fn(async () => new Set<number>()));
const getUserMutualSet = vi.hoisted(() => vi.fn(async () => new Set<string>()));

vi.mock("@/domain/social/follows", () => ({
  getOrganizationFollowingSet: (...args: any[]) => getOrganizationFollowingSet(...args),
  getUserMutualSet: (...args: any[]) => getUserMutualSet(...args),
}));

import { rankEvents } from "@/domain/ranking/eventRanker";

const baseEvent = (overrides: Partial<any> = {}) => ({
  id: 1,
  type: "EVENT" as const,
  slug: "evento-1",
  title: "Evento 1",
  description: null,
  shortDescription: null,
  startsAt: new Date().toISOString(),
  endsAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
  templateType: "OTHER",
  interestTags: [],
  location: {
    city: "Lisboa",
    addressId: null,
    lat: 38.72,
    lng: -9.13,
    formattedAddress: "Lisboa",
  },
  coverImageUrl: null,
  isGratis: false,
  priceFrom: null,
  categories: [],
  hostName: null,
  hostUsername: null,
  status: "ACTIVE" as const,
  isHighlighted: false,
  ...overrides,
});

beforeEach(() => {
  prismaUserEventSignalFindMany.mockReset();
  prismaTicketFindMany.mockReset();
  getOrganizationFollowingSet.mockReset();
  getUserMutualSet.mockReset();
  prismaTicketFindMany.mockResolvedValue([]);
  getOrganizationFollowingSet.mockResolvedValue(new Set());
  getUserMutualSet.mockResolvedValue(new Set());
});

describe("rankEvents", () => {
  it("prefere eventos com match de interesse", async () => {
    prismaUserEventSignalFindMany.mockResolvedValue([]);

    const eventA = baseEvent({ id: 1, interestTags: ["concertos"] });
    const eventB = baseEvent({ id: 2, interestTags: ["gastronomia"] });

    const ranked = await rankEvents([eventA, eventB], {
      userId: "user-1",
      favouriteCategories: ["concertos"],
    });

    const scoreA = ranked.find((item) => item.event.id === 1)?.rank.score ?? 0;
    const scoreB = ranked.find((item) => item.event.id === 2)?.rank.score ?? 0;
    expect(scoreA).toBeGreaterThan(scoreB);
  });

  it("compra pesa mais do que preferência", async () => {
    prismaUserEventSignalFindMany.mockImplementation(({ where }: any) => {
      const types = where?.signalType?.in ?? [];
      if (types.includes("PURCHASE")) {
        return [{ eventId: 2, signalType: "PURCHASE", signalValue: null }];
      }
      return [];
    });

    const eventA = baseEvent({ id: 1, interestTags: ["concertos"] });
    const eventB = baseEvent({ id: 2, interestTags: ["gastronomia"] });

    const ranked = await rankEvents([eventA, eventB], {
      userId: "user-1",
      favouriteCategories: ["concertos"],
    });

    const scoreA = ranked.find((item) => item.event.id === 1)?.rank.score ?? 0;
    const scoreB = ranked.find((item) => item.event.id === 2)?.rank.score ?? 0;
    expect(scoreB).toBeGreaterThan(scoreA);
  });

  it("hide_event remove do ranking", async () => {
    prismaUserEventSignalFindMany.mockImplementation(({ where }: any) => {
      const types = where?.signalType?.in ?? [];
      if (types.includes("HIDE_EVENT")) {
        return [{ eventId: 1, organizationId: null, metadata: null, signalType: "HIDE_EVENT" }];
      }
      return [];
    });

    const eventA = baseEvent({ id: 1 });
    const ranked = await rankEvents([eventA], {
      userId: "user-1",
      favouriteCategories: [],
    });

    expect(ranked[0]?.hidden).toBe(true);
    expect(ranked[0]?.rank.reasons[0]?.code).toBe("NEGATIVE_HIDE_EVENT");
  });

  it("seguindo a organização adiciona razão social", async () => {
    getOrganizationFollowingSet.mockResolvedValue(new Set([88]));
    prismaUserEventSignalFindMany.mockResolvedValue([]);

    const eventA = baseEvent({ id: 1, organizationId: 88 });
    const ranked = await rankEvents([eventA], {
      userId: "user-1",
      favouriteCategories: [],
    });

    const reasons = ranked[0]?.rank.reasons.map((r) => r.code) ?? [];
    expect(reasons).toContain("SOCIAL_ORG_FOLLOW");
  });
});
