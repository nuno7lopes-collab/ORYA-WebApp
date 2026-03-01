import { describe, expect, it } from "vitest";
import {
  buildCampaignAbWinners,
  buildLoyaltyUserLeaderboard,
  buildRetentionCohorts,
  buildSegmentPerformance,
  summarizeLoyaltyByType,
} from "@/lib/crm/insightsMetrics";

describe("crm insights metrics", () => {
  it("calcula coortes de retenção com elegibilidade", () => {
    const result = buildRetentionCohorts({
      now: new Date("2026-03-01T00:00:00.000Z"),
      cohortMonths: 4,
      profiles: [
        {
          createdAt: new Date("2025-12-05T12:00:00.000Z"),
          lastMatchAt: new Date("2026-02-20T12:00:00.000Z"),
        },
        {
          createdAt: new Date("2025-12-10T12:00:00.000Z"),
          lastMatchAt: new Date("2025-12-25T12:00:00.000Z"),
        },
        {
          createdAt: new Date("2026-02-10T12:00:00.000Z"),
          lastMatchAt: new Date("2026-02-28T12:00:00.000Z"),
        },
      ],
    });

    const dec = result.cohorts.find((item) => item.month === "2025-12");
    expect(dec).toBeTruthy();
    expect(dec?.size).toBe(2);
    expect(dec?.rate30).toBe(0.5);
    expect(dec?.rate60).toBe(0.5);

    const feb = result.cohorts.find((item) => item.month === "2026-02");
    expect(feb?.eligible30).toBe(false);
    expect(feb?.rate30).toBeNull();
  });

  it("resume desempenho por segmento com campanhas A/B", () => {
    const result = buildSegmentPerformance({
      segments: [
        { id: "s1", name: "Inativos 60d", sizeCache: 120 },
        { id: "s2", name: "Competitivos", sizeCache: 60 },
      ],
      campaigns: [
        {
          segmentId: "s1",
          sentCount: 100,
          openedCount: 40,
          clickedCount: 10,
          failedCount: 5,
          payload: {
            abTest: {
              enabled: true,
              variants: [
                { id: "A", weight: 1 },
                { id: "B", weight: 1 },
              ],
            },
          },
        },
        {
          segmentId: "s1",
          sentCount: 50,
          openedCount: 20,
          clickedCount: 4,
          failedCount: 2,
          payload: {},
        },
      ],
    });

    const segment = result.segments.find((item) => item.segmentId === "s1");
    expect(segment).toBeTruthy();
    expect(segment?.campaignsSent).toBe(2);
    expect(segment?.campaignsWithAb).toBe(1);
    expect(segment?.sent).toBe(150);
    expect(segment?.openRate).toBeCloseTo(0.4, 4);
  });

  it("determina winners de A/B por CTR", () => {
    const winners = buildCampaignAbWinners([
      {
        campaignId: "c1",
        campaignName: "Reativação",
        variantId: "A",
        sent: 100,
        opened: 30,
        clicked: 8,
        failed: 0,
        openRate: 0.3,
        ctr: 0.08,
      },
      {
        campaignId: "c1",
        campaignName: "Reativação",
        variantId: "B",
        sent: 100,
        opened: 25,
        clicked: 5,
        failed: 0,
        openRate: 0.25,
        ctr: 0.05,
      },
    ]);

    expect(winners).toHaveLength(1);
    expect(winners[0]?.winnerVariantId).toBe("A");
    expect(winners[0]?.upliftCtr).toBe(0.03);
  });

  it("resume loyalty por tipo e leaderboard por utilizador", () => {
    const summary = summarizeLoyaltyByType([
      { entryType: "EARN", points: 200 },
      { entryType: "SPEND", points: 80 },
      { entryType: "EXPIRE", points: 10 },
      { entryType: "ADJUST", points: -5 },
    ]);

    expect(summary.earnedPoints).toBe(200);
    expect(summary.spentPoints).toBe(80);
    expect(summary.expiredPoints).toBe(10);
    expect(summary.netPoints).toBe(105);

    const leaderboard = buildLoyaltyUserLeaderboard([
      { userId: "u1", entryType: "EARN", points: 120 },
      { userId: "u1", entryType: "SPEND", points: 20 },
      { userId: "u2", entryType: "EARN", points: 90 },
      { userId: "u2", entryType: "SPEND", points: 10 },
    ]);

    expect(leaderboard[0]?.userId).toBe("u1");
    expect(leaderboard[0]?.netPoints).toBe(100);
    expect(leaderboard[1]?.userId).toBe("u2");
  });
});
