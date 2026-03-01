import { describe, expect, it } from "vitest";
import { matchesLoyaltyConditions, resolveLoyaltyTriggerForInteraction } from "@/lib/loyalty/engine";

describe("loyalty engine padel conditions", () => {
  it("mapeia eventos padel para triggers de loyalty", () => {
    expect(resolveLoyaltyTriggerForInteraction("PADEL_MATCH_PLAYED")).toBe("BOOKING_COMPLETED");
    expect(resolveLoyaltyTriggerForInteraction("PADEL_CLASS_ATTENDED")).toBe("EVENT_CHECKIN");
    expect(resolveLoyaltyTriggerForInteraction("PADEL_TOURNAMENT_PODIUM")).toBe("TOURNAMENT_PARTICIPATION");
  });

  it("valida condições padel-first", () => {
    const ok = matchesLoyaltyConditions(
      {
        requiredInteractionTypes: ["PADEL_MATCH_PLAYED"],
        minMatches30d: 3,
        maxNoShowRate90d: 0.1,
        requiredActivityStatuses: ["ACTIVE", "WARM"],
        requiredCompetitiveTiers: ["INTERMEDIATE", "ADVANCED", "COMPETITIVE"],
        requireFairPlay: true,
      },
      {
        organizationId: 1,
        userId: "u1",
        interactionType: "PADEL_MATCH_PLAYED",
        sourceId: "m1",
        occurredAt: new Date("2026-03-01T10:00:00.000Z"),
        amountCents: null,
        customerSnapshot: {
          totalSpentCents: 0,
          totalOrders: 0,
          totalBookings: 0,
          totalAttendances: 0,
          totalTournaments: 0,
          totalStoreOrders: 0,
          tags: ["vip"],
          matches30d: 5,
          noShowRate90d: 0.02,
          winRate90d: 0.65,
          activityStatus: "ACTIVE",
          competitiveTier: "ADVANCED",
        },
      },
    );

    expect(ok).toBe(true);
  });

  it("falha quando fair-play não cumpre", () => {
    const ok = matchesLoyaltyConditions(
      {
        requiredInteractionTypes: ["PADEL_MATCH_PLAYED"],
        requireFairPlay: true,
        maxNoShowRate90d: 0.1,
      },
      {
        organizationId: 1,
        userId: "u1",
        interactionType: "PADEL_MATCH_PLAYED",
        sourceId: "m1",
        occurredAt: new Date("2026-03-01T10:00:00.000Z"),
        amountCents: null,
        customerSnapshot: {
          totalSpentCents: 0,
          totalOrders: 0,
          totalBookings: 0,
          totalAttendances: 0,
          totalTournaments: 0,
          totalStoreOrders: 0,
          tags: [],
          matches30d: 5,
          noShowRate90d: 0.2,
          winRate90d: 0.4,
          activityStatus: "ACTIVE",
          competitiveTier: "INTERMEDIATE",
        },
      },
    );

    expect(ok).toBe(false);
  });
});
