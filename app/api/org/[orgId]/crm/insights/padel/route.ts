import { NextRequest } from "next/server";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondOk } from "@/lib/http/envelope";
import { prisma } from "@/lib/prisma";
import { resolveCrmRequest } from "@/app/api/org/[orgId]/crm/_shared";
import {
  CrmDeliveryStatus,
  CrmJourneyStepLogStatus,
  CrmJourneyStepType,
} from "@prisma/client";
import { normalizeCrmAbTestConfig, resolveCrmAbAssignment } from "@/lib/crm/abTesting";
import {
  buildCampaignAbWinners,
  buildJourneyAbWinners,
  buildLoyaltyUserLeaderboard,
  buildRetentionCohorts,
  buildSegmentPerformance,
  summarizeLoyaltyByType,
} from "@/lib/crm/insightsMetrics";

const SENT_LIKE_STATUSES: CrmDeliveryStatus[] = [
  CrmDeliveryStatus.SENT,
  CrmDeliveryStatus.OPENED,
  CrmDeliveryStatus.CLICKED,
];

function parseWindowDays(value: string | null) {
  if (!value) return 30;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 30;
  return Math.min(Math.trunc(parsed), 180);
}

function parseCohortMonths(value: string | null) {
  if (!value) return 6;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 6;
  return Math.min(Math.max(Math.trunc(parsed), 3), 18);
}

function resolveValueBand(rfmScore: number) {
  if (rfmScore >= 450) return "VIP";
  if (rfmScore >= 320) return "HIGH";
  if (rfmScore >= 220) return "MEDIUM";
  return "LOW";
}

function resolveRecommendedAction(params: {
  noShowRate90d: number;
  churnRiskScore: number;
  reactivationPropensityScore: number;
  matches30d: number;
  competitiveTier: string | null;
  activityStatus: string | null;
  rfmScore: number;
}) {
  if (params.noShowRate90d >= 0.2) return "Follow-up anti no-show em 24h";
  if (params.churnRiskScore >= 70 && params.reactivationPropensityScore >= 50) {
    return "Journey de reativação 30/60/90";
  }
  if (params.matches30d <= 1 && params.churnRiskScore >= 55) {
    return "Oferta dirigida para recuperar frequência";
  }
  if (
    params.competitiveTier === "COMPETITIVE" &&
    (params.activityStatus === "ACTIVE" || params.activityStatus === "WARM")
  ) {
    return "Convite torneio competitivo";
  }
  if (params.rfmScore >= 400) return "Upsell aulas/eventos premium";
  return "Ação manual semanal da front desk";
}

function toObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

async function _GET(req: NextRequest) {
  const ctx = getRequestContext(req);
  const access = await resolveCrmRequest({ req, required: "VIEW" });
  if (!access.ok) return access.response;

  const where = { organizationId: access.organization.id };
  const windowDays = parseWindowDays(req.nextUrl.searchParams.get("windowDays"));
  const cohortMonths = parseCohortMonths(req.nextUrl.searchParams.get("cohortMonths"));
  const now = new Date();
  const since = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000);
  const cohortStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (cohortMonths - 1), 1, 0, 0, 0, 0),
  );

  const [
    totalProfiles,
    activeProfiles,
    averages,
    activityBreakdown,
    tierBreakdown,
    topRisk,
    riskRows,
    sentCampaigns,
    journeyAbLogs,
    segmentRows,
    segmentCampaignRows,
    retentionProfiles,
    loyaltyProgram,
    topFrontDeskRaw,
  ] = await Promise.all([
    prisma.crmContactPadel.count({ where }),
    prisma.crmContactPadel.count({
      where: {
        ...where,
        activityStatus: { in: ["ACTIVE", "WARM"] },
      },
    }),
    prisma.crmContactPadel.aggregate({
      where,
      _avg: {
        matches30d: true,
        winRate90d: true,
        noShowRate90d: true,
        churnRiskScore: true,
        reactivationPropensityScore: true,
      },
    }),
    prisma.crmContactPadel.groupBy({
      by: ["activityStatus"],
      where,
      _count: { _all: true },
      orderBy: { _count: { activityStatus: "desc" } },
    }),
    prisma.crmContactPadel.groupBy({
      by: ["competitiveTier"],
      where,
      _count: { _all: true },
      orderBy: { _count: { competitiveTier: "desc" } },
    }),
    prisma.crmContactPadel.findMany({
      where,
      orderBy: [{ churnRiskScore: "desc" }, { matches30d: "asc" }, { updatedAt: "desc" }],
      take: 20,
      select: {
        contactId: true,
        churnRiskScore: true,
        reactivationPropensityScore: true,
        activityStatus: true,
        matches30d: true,
        winRate90d: true,
        noShowRate90d: true,
        contact: {
          select: {
            displayName: true,
            user: { select: { fullName: true, username: true } },
          },
        },
      },
    }),
    prisma.crmContactPadel.findMany({
      where,
      select: { churnRiskScore: true },
    }),
    prisma.crmCampaign.findMany({
      where: {
        organizationId: access.organization.id,
        sentAt: { gte: since },
      },
      select: {
        id: true,
        name: true,
        payload: true,
        sentCount: true,
      },
    }),
    prisma.crmJourneyStepLog.findMany({
      where: {
        organizationId: access.organization.id,
        stepType: CrmJourneyStepType.ACTION,
        executedAt: { gte: since },
        status: {
          in: [
            CrmJourneyStepLogStatus.COMPLETED,
            CrmJourneyStepLogStatus.SKIPPED,
            CrmJourneyStepLogStatus.FAILED,
          ],
        },
      },
      select: {
        status: true,
        metadata: true,
        stepKey: true,
        journeyRun: {
          select: {
            journeyId: true,
            journey: { select: { name: true } },
          },
        },
      },
    }),
    prisma.crmSegment.findMany({
      where: { organizationId: access.organization.id, status: "ACTIVE" },
      select: { id: true, name: true, sizeCache: true },
    }),
    prisma.crmCampaign.findMany({
      where: {
        organizationId: access.organization.id,
        sentAt: { gte: since },
        segmentId: { not: null },
      },
      select: {
        segmentId: true,
        sentCount: true,
        openedCount: true,
        clickedCount: true,
        failedCount: true,
        payload: true,
      },
    }),
    prisma.crmContactPadel.findMany({
      where: {
        organizationId: access.organization.id,
        createdAt: { gte: cohortStart },
      },
      select: {
        createdAt: true,
        lastMatchAt: true,
      },
    }),
    prisma.loyaltyProgram.findUnique({
      where: { organizationId: access.organization.id },
      select: {
        id: true,
        status: true,
        name: true,
        pointsName: true,
      },
    }),
    prisma.crmContactPadel.findMany({
      where: { organizationId: access.organization.id },
      take: 60,
      orderBy: [
        { churnRiskScore: "desc" },
        { rfmScore: "desc" },
        { reactivationPropensityScore: "desc" },
        { updatedAt: "desc" },
      ],
      select: {
        contactId: true,
        churnRiskScore: true,
        reactivationPropensityScore: true,
        rfmScore: true,
        matches30d: true,
        noShowRate90d: true,
        winRate90d: true,
        activityStatus: true,
        competitiveTier: true,
        contact: {
          select: {
            displayName: true,
            contactEmail: true,
            contactPhone: true,
            user: { select: { fullName: true, username: true } },
          },
        },
      },
    }),
  ]);

  const riskBuckets = riskRows.reduce(
    (acc, row) => {
      if (row.churnRiskScore >= 70) acc.high += 1;
      else if (row.churnRiskScore >= 40) acc.medium += 1;
      else acc.low += 1;
      return acc;
    },
    { high: 0, medium: 0, low: 0 },
  );

  const retention = buildRetentionCohorts({
    profiles: retentionProfiles,
    now,
    cohortMonths,
  });
  const segmentPerformance = buildSegmentPerformance({
    segments: segmentRows.map((item) => ({
      id: item.id,
      name: item.name,
      sizeCache: item.sizeCache ?? null,
    })),
    campaigns: segmentCampaignRows.map((item) => ({
      segmentId: item.segmentId,
      sentCount: item.sentCount,
      openedCount: item.openedCount,
      clickedCount: item.clickedCount,
      failedCount: item.failedCount,
      payload: item.payload,
    })),
  });

  const abCampaignMap = new Map<
    string,
    {
      id: string;
      name: string;
      config: ReturnType<typeof normalizeCrmAbTestConfig>;
    }
  >();
  for (const campaign of sentCampaigns) {
    const payload = toObject(campaign.payload);
    const abConfig = normalizeCrmAbTestConfig(payload.abTest);
    if (!abConfig.enabled) continue;
    abCampaignMap.set(campaign.id, {
      id: campaign.id,
      name: campaign.name,
      config: abConfig,
    });
  }

  const abCampaignIds = Array.from(abCampaignMap.keys());
  const abDeliveries = abCampaignIds.length
    ? await prisma.crmCampaignDelivery.findMany({
        where: {
          organizationId: access.organization.id,
          campaignId: { in: abCampaignIds },
          sentAt: { gte: since },
        },
        select: {
          campaignId: true,
          contactId: true,
          status: true,
        },
      })
    : [];

  const variantMap = new Map<
    string,
    {
      campaignId: string;
      campaignName: string;
      variantId: string;
      sent: number;
      opened: number;
      clicked: number;
      failed: number;
    }
  >();

  for (const delivery of abDeliveries) {
    const abCampaign = abCampaignMap.get(delivery.campaignId);
    if (!abCampaign) continue;
    const assignment = resolveCrmAbAssignment({
      scope: "campaign",
      entityId: delivery.campaignId,
      contactId: delivery.contactId,
      config: abCampaign.config,
    });
    const variantId = assignment.variantId ?? "UNASSIGNED";
    const key = `${delivery.campaignId}:${variantId}`;
    if (!variantMap.has(key)) {
      variantMap.set(key, {
        campaignId: delivery.campaignId,
        campaignName: abCampaign.name,
        variantId,
        sent: 0,
        opened: 0,
        clicked: 0,
        failed: 0,
      });
    }
    const target = variantMap.get(key)!;
    if (SENT_LIKE_STATUSES.includes(delivery.status)) {
      target.sent += 1;
    }
    if (delivery.status === CrmDeliveryStatus.OPENED || delivery.status === CrmDeliveryStatus.CLICKED) {
      target.opened += 1;
    }
    if (delivery.status === CrmDeliveryStatus.CLICKED) {
      target.clicked += 1;
    }
    if (delivery.status === CrmDeliveryStatus.FAILED) {
      target.failed += 1;
    }
  }

  let holdoutEstimated = 0;
  for (const campaign of sentCampaigns) {
    const abCampaign = abCampaignMap.get(campaign.id);
    if (!abCampaign || !abCampaign.config.enabled) continue;
    const denominator = Math.max(1, 100 - abCampaign.config.holdoutPercent);
    const estimatedTotal = (campaign.sentCount * 100) / denominator;
    holdoutEstimated += Math.max(0, Math.round(estimatedTotal - campaign.sentCount));
  }

  const journeyMap = new Map<
    string,
    {
      journeyId: string;
      journeyName: string;
      stepKey: string;
      variantId: string;
      completed: number;
      skipped: number;
      failed: number;
    }
  >();
  for (const log of journeyAbLogs) {
    const metadata = toObject(log.metadata);
    const abTest = toObject(metadata.abTest);
    const variantId =
      typeof abTest.variantId === "string" && abTest.variantId.trim()
        ? abTest.variantId.trim()
        : "UNASSIGNED";
    const journeyId = log.journeyRun?.journeyId ?? "unknown";
    const journeyName = log.journeyRun?.journey?.name ?? "Journey";
    const key = `${journeyId}:${log.stepKey}:${variantId}`;
    if (!journeyMap.has(key)) {
      journeyMap.set(key, {
        journeyId,
        journeyName,
        stepKey: log.stepKey,
        variantId,
        completed: 0,
        skipped: 0,
        failed: 0,
      });
    }
    const target = journeyMap.get(key)!;
    if (log.status === CrmJourneyStepLogStatus.COMPLETED) target.completed += 1;
    if (log.status === CrmJourneyStepLogStatus.SKIPPED) target.skipped += 1;
    if (log.status === CrmJourneyStepLogStatus.FAILED) target.failed += 1;
  }

  const frontDeskQueue = topFrontDeskRaw
    .map((item) => {
      const normalizedRfm = Math.max(0, Math.min(100, (item.rfmScore / 555) * 100));
      const priorityScore = Math.round(
        item.churnRiskScore * 0.55 +
          normalizedRfm * 0.3 +
          item.reactivationPropensityScore * 0.15,
      );

      return {
        contactId: item.contactId,
        displayName:
          item.contact.displayName ??
          item.contact.user?.fullName ??
          item.contact.user?.username ??
          "Cliente",
        contactEmail: item.contact.contactEmail ?? null,
        contactPhone: item.contact.contactPhone ?? null,
        priorityScore,
        churnRiskScore: item.churnRiskScore,
        rfmScore: item.rfmScore,
        reactivationPropensityScore: item.reactivationPropensityScore,
        matches30d: item.matches30d,
        noShowRate90d: item.noShowRate90d,
        winRate90d: item.winRate90d,
        activityStatus: item.activityStatus,
        competitiveTier: item.competitiveTier,
        estimatedValueBand: resolveValueBand(item.rfmScore),
        recommendedAction: resolveRecommendedAction({
          noShowRate90d: item.noShowRate90d,
          churnRiskScore: item.churnRiskScore,
          reactivationPropensityScore: item.reactivationPropensityScore,
          matches30d: item.matches30d,
          competitiveTier: item.competitiveTier,
          activityStatus: item.activityStatus,
          rfmScore: item.rfmScore,
        }),
      };
    })
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .slice(0, 10);

  const campaignVariants = Array.from(variantMap.values()).map((item) => ({
    ...item,
    openRate: item.sent > 0 ? Number((item.opened / item.sent).toFixed(4)) : 0,
    ctr: item.sent > 0 ? Number((item.clicked / item.sent).toFixed(4)) : 0,
  }));
  const journeyVariants = Array.from(journeyMap.values());

  let loyalty = {
    enabled: false,
    programName: null as string | null,
    pointsName: null as string | null,
    programStatus: null as string | null,
    rulesActive: 0,
    rewardsActive: 0,
    activeMembers: 0,
    earnedPoints: 0,
    spentPoints: 0,
    expiredPoints: 0,
    adjustedPoints: 0,
    netPoints: 0,
  };

  if (loyaltyProgram) {
    const [rulesActive, rewardsActive, loyaltyByTypeRows, loyaltyByUserRows] = await Promise.all([
      prisma.loyaltyRule.count({
        where: {
          programId: loyaltyProgram.id,
          isActive: true,
        },
      }),
      prisma.loyaltyReward.count({
        where: {
          programId: loyaltyProgram.id,
          isActive: true,
        },
      }),
      prisma.loyaltyLedger.groupBy({
        by: ["entryType"],
        where: {
          organizationId: access.organization.id,
          programId: loyaltyProgram.id,
          createdAt: { gte: since },
        },
        _sum: { points: true },
      }),
      prisma.loyaltyLedger.groupBy({
        by: ["userId", "entryType"],
        where: {
          organizationId: access.organization.id,
          programId: loyaltyProgram.id,
          createdAt: { gte: since },
        },
        _sum: { points: true },
      }),
    ]);

    const loyaltySummary = summarizeLoyaltyByType(
      loyaltyByTypeRows.map((row) => ({
        entryType: row.entryType,
        points: Number(row._sum.points ?? 0),
      })),
    );
    const leaderboard = buildLoyaltyUserLeaderboard(
      loyaltyByUserRows.map((row) => ({
        userId: row.userId,
        entryType: row.entryType,
        points: Number(row._sum.points ?? 0),
      })),
    );

    loyalty = {
      enabled: true,
      programName: loyaltyProgram.name,
      pointsName: loyaltyProgram.pointsName,
      programStatus: loyaltyProgram.status,
      rulesActive,
      rewardsActive,
      activeMembers: leaderboard.length,
      earnedPoints: loyaltySummary.earnedPoints,
      spentPoints: loyaltySummary.spentPoints,
      expiredPoints: loyaltySummary.expiredPoints,
      adjustedPoints: loyaltySummary.adjustedPoints,
      netPoints: loyaltySummary.netPoints,
    };
  }

  return respondOk(ctx, {
    generatedAt: now.toISOString(),
    totals: {
      totalProfiles,
      activeProfiles,
      dormantProfiles: Math.max(totalProfiles - activeProfiles, 0),
    },
    averages: {
      matches30d: averages._avg.matches30d ?? 0,
      winRate90d: averages._avg.winRate90d ?? 0,
      noShowRate90d: averages._avg.noShowRate90d ?? 0,
      churnRiskScore: averages._avg.churnRiskScore ?? 0,
      reactivationPropensityScore: averages._avg.reactivationPropensityScore ?? 0,
    },
    riskBuckets,
    breakdowns: {
      activityStatus: activityBreakdown.map((item) => ({
        status: item.activityStatus ?? "UNSET",
        count: item._count._all,
      })),
      competitiveTier: tierBreakdown.map((item) => ({
        tier: item.competitiveTier ?? "UNSET",
        count: item._count._all,
      })),
    },
    topRiskContacts: topRisk.map((item) => ({
      contactId: item.contactId,
      displayName:
        item.contact.displayName ??
        item.contact.user?.fullName ??
        item.contact.user?.username ??
        "Cliente",
      churnRiskScore: item.churnRiskScore,
      reactivationPropensityScore: item.reactivationPropensityScore,
      activityStatus: item.activityStatus,
      matches30d: item.matches30d,
      winRate90d: item.winRate90d,
      noShowRate90d: item.noShowRate90d,
    })),
    advanced: {
      windowDays,
      cohortMonths: retention.cohortMonths,
      abTesting: {
        campaignsWithAb: abCampaignMap.size,
        totalDeliveries: abDeliveries.length,
        holdoutEstimated,
        campaignWinners: buildCampaignAbWinners(campaignVariants).slice(0, 5),
        journeyWinners: buildJourneyAbWinners(journeyVariants).slice(0, 5),
      },
      retention: retention.summary,
      segmentPerformance: segmentPerformance.summary,
      loyalty,
      frontDesk: {
        queue: frontDeskQueue,
      },
    },
  });
}

export const GET = withApiEnvelope(_GET);
