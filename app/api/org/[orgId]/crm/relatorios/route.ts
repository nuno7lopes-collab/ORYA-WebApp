import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveRequiredOrganizationIdFromRequest } from "@/lib/organizationId";
import { ensureCrmModuleAccess } from "@/lib/crm/access";
import {
  CrmDeliveryStatus,
  CrmInteractionType,
  CrmJourneyStepLogStatus,
  CrmJourneyStepType,
  OrganizationMemberRole,
} from "@prisma/client";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { normalizeCrmAbTestConfig, resolveCrmAbAssignment } from "@/lib/crm/abTesting";
import {
  buildCampaignAbWinners,
  buildJourneyAbWinners,
  buildLoyaltyUserLeaderboard,
  buildRetentionCohorts,
  buildSegmentPerformance,
  summarizeLoyaltyByType,
} from "@/lib/crm/insightsMetrics";

const READ_ROLES = Object.values(OrganizationMemberRole);

const CATEGORY_CONFIG = [
  {
    id: "padel",
    label: "Padel",
    types: [
      CrmInteractionType.PADEL_TOURNAMENT_ENTRY,
      CrmInteractionType.PADEL_MATCH_PAYMENT,
      CrmInteractionType.PADEL_BOOKING_CONFIRMED,
      CrmInteractionType.PADEL_BOOKING_CANCELLED,
      CrmInteractionType.PADEL_BOOKING_NO_SHOW,
      CrmInteractionType.PADEL_MATCH_PLAYED,
      CrmInteractionType.PADEL_MATCH_WIN,
      CrmInteractionType.PADEL_MATCH_LOSS,
      CrmInteractionType.PADEL_CLASS_ATTENDED,
      CrmInteractionType.PADEL_CLASS_MISSED,
      CrmInteractionType.PADEL_TOURNAMENT_REGISTERED,
      CrmInteractionType.PADEL_TOURNAMENT_PLAYED,
      CrmInteractionType.PADEL_TOURNAMENT_PODIUM,
    ],
  },
] as const;

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
  return "Ação manual semanal da receção";
}

function toObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

async function _GET(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const orgResolution = resolveRequiredOrganizationIdFromRequest(req);
    if (!orgResolution.ok) {
      return jsonWrap({ ok: false, error: "ORG_ID_REQUIRED" }, { status: 400 });
    }
    const organizationId = orgResolution.organizationId;
    const { organization, membership } = await getActiveOrganizationForUser(user.id, {
      organizationId,
      roles: [...READ_ROLES],
    });

    if (!organization || !membership) {
      return jsonWrap({ ok: false, error: "Sem permissoes." }, { status: 403 });
    }
    const crmAccess = await ensureCrmModuleAccess(organization, prisma, {
      member: { userId: membership.userId, role: membership.role },
      required: "VIEW",
    });
    if (!crmAccess.ok) {
      return jsonWrap({ ok: false, error: crmAccess.error }, { status: 403 });
    }

    const windowDays = parseWindowDays(req.nextUrl.searchParams.get("windowDays"));
    const cohortMonths = parseCohortMonths(req.nextUrl.searchParams.get("cohortMonths"));
    const now = new Date();
    const since = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000);
    const cohortStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (cohortMonths - 1), 1, 0, 0, 0, 0),
    );

    const [
      totalCustomers,
      newCustomers,
      interactionAgg,
      campaignsSent,
      sentCampaigns,
      topFrontDeskRaw,
      journeyAbLogs,
      segmentRows,
      segmentCampaignRows,
      retentionProfiles,
      loyaltyProgram,
    ] = await Promise.all([
      prisma.crmContact.count({ where: { organizationId: organization.id } }),
      prisma.crmContact.count({ where: { organizationId: organization.id, createdAt: { gte: since } } }),
      prisma.crmInteraction.groupBy({
        by: ["type"],
        where: { organizationId: organization.id, occurredAt: { gte: since } },
        _count: { _all: true },
        _sum: { amountCents: true },
      }),
      prisma.crmCampaign.count({ where: { organizationId: organization.id, sentAt: { gte: since } } }),
      prisma.crmCampaign.findMany({
        where: {
          organizationId: organization.id,
          sentAt: { gte: since },
        },
        select: {
          id: true,
          name: true,
          payload: true,
          sentAt: true,
          sentCount: true,
          openedCount: true,
          clickedCount: true,
          failedCount: true,
        },
      }),
      prisma.crmContactPadel.findMany({
        where: { organizationId: organization.id },
        take: 120,
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
      prisma.crmJourneyStepLog.findMany({
        where: {
          organizationId: organization.id,
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
        where: { organizationId: organization.id, status: "ACTIVE" },
        select: { id: true, name: true, sizeCache: true },
      }),
      prisma.crmCampaign.findMany({
        where: {
          organizationId: organization.id,
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
          organizationId: organization.id,
          createdAt: { gte: cohortStart },
        },
        select: {
          createdAt: true,
          lastMatchAt: true,
        },
      }),
      prisma.loyaltyProgram.findUnique({
        where: { organizationId: organization.id },
        select: {
          id: true,
          status: true,
          name: true,
          pointsName: true,
        },
      }),
    ]);

    const typeMap = new Map(
      interactionAgg.map((item) => [
        item.type,
        {
          count: item._count._all,
          amountCents: item._sum.amountCents ?? 0,
        },
      ]),
    );

    const categories = CATEGORY_CONFIG.map((category) => {
      const totals = category.types.reduce(
        (acc, type) => {
          const row = typeMap.get(type);
          acc.count += row?.count ?? 0;
          acc.amountCents += row?.amountCents ?? 0;
          return acc;
        },
        { count: 0, amountCents: 0 },
      );
      return { ...category, ...totals };
    });

    const totals = categories.reduce(
      (acc, category) => {
        acc.interactions += category.count;
        acc.amountCents += category.amountCents;
        return acc;
      },
      { interactions: 0, amountCents: 0 },
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
            organizationId: organization.id,
            campaignId: { in: abCampaignIds },
            sentAt: { gte: since },
          },
          select: {
            campaignId: true,
            contactId: true,
            status: true,
            channel: true,
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

    const abJourneyMap = new Map<
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
      if (!abJourneyMap.has(key)) {
        abJourneyMap.set(key, {
          journeyId,
          journeyName,
          stepKey: log.stepKey,
          variantId,
          completed: 0,
          skipped: 0,
          failed: 0,
        });
      }
      const target = abJourneyMap.get(key)!;
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
      .slice(0, 25);

    const campaignVariants = Array.from(variantMap.values()).map((item) => ({
      ...item,
      openRate: item.sent > 0 ? Number((item.opened / item.sent).toFixed(4)) : 0,
      ctr: item.sent > 0 ? Number((item.clicked / item.sent).toFixed(4)) : 0,
    }));
    const journeyVariants = Array.from(abJourneyMap.values());
    const campaignWinners = buildCampaignAbWinners(campaignVariants);
    const journeyWinners = buildJourneyAbWinners(journeyVariants);

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
      topMembers: [] as Array<{
        userId: string;
        displayName: string;
        contactEmail: string | null;
        netPoints: number;
        earnedPoints: number;
        spentPoints: number;
      }>,
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
            organizationId: organization.id,
            programId: loyaltyProgram.id,
            createdAt: { gte: since },
          },
          _sum: { points: true },
        }),
        prisma.loyaltyLedger.groupBy({
          by: ["userId", "entryType"],
          where: {
            organizationId: organization.id,
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
      const topLeaderboard = leaderboard.slice(0, 10);
      const contactRows = topLeaderboard.length
        ? await prisma.crmContact.findMany({
            where: {
              organizationId: organization.id,
              userId: { in: topLeaderboard.map((item) => item.userId) },
            },
            select: {
              userId: true,
              displayName: true,
              contactEmail: true,
              user: { select: { fullName: true, username: true } },
            },
          })
        : [];
      const contactMap = new Map(
        contactRows.map((contact) => [
          contact.userId,
          {
            displayName:
              contact.displayName ?? contact.user?.fullName ?? contact.user?.username ?? "Cliente",
            contactEmail: contact.contactEmail ?? null,
          },
        ]),
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
        topMembers: topLeaderboard.map((item) => ({
          userId: item.userId,
          displayName: contactMap.get(item.userId)?.displayName ?? "Cliente",
          contactEmail: contactMap.get(item.userId)?.contactEmail ?? null,
          netPoints: item.netPoints,
          earnedPoints: item.earnedPoints,
          spentPoints: item.spentPoints,
        })),
      };
    }

    return jsonWrap({
      ok: true,
      windowDays,
      cohortMonths: retention.cohortMonths,
      totals,
      customers: {
        total: totalCustomers,
        new: newCustomers,
      },
      campaignsSent,
      categories,
      abTesting: {
        campaignsWithAb: abCampaignMap.size,
        totalDeliveries: abDeliveries.length,
        holdoutEstimated,
        campaignVariants,
        campaignWinners,
        journeyVariants,
        journeyWinners,
      },
      frontDesk: {
        queue: frontDeskQueue,
      },
      retention,
      segmentPerformance,
      loyalty,
    });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }
    console.error("GET /api/org/[orgId]/crm/relatorios error:", err);
    return jsonWrap({ ok: false, error: "Erro ao carregar relatorios." }, { status: 500 });
  }
}
export const GET = withApiEnvelope(_GET);
