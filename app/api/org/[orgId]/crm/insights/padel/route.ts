import { NextRequest } from "next/server";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondOk } from "@/lib/http/envelope";
import { prisma } from "@/lib/prisma";
import { resolveCrmRequest } from "@/app/api/org/[orgId]/crm/_shared";

async function _GET(req: NextRequest) {
  const ctx = getRequestContext(req);
  const access = await resolveCrmRequest({ req, required: "VIEW" });
  if (!access.ok) return access.response;

  const where = { organizationId: access.organization.id };

  const [totalProfiles, activeProfiles, averages, activityBreakdown, tierBreakdown, topRisk] = await Promise.all([
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
  ]);

  const riskRows = await prisma.crmContactPadel.findMany({
    where,
    select: { churnRiskScore: true },
  });
  const riskBuckets = riskRows.reduce(
    (acc, row) => {
      if (row.churnRiskScore >= 70) acc.high += 1;
      else if (row.churnRiskScore >= 40) acc.medium += 1;
      else acc.low += 1;
      return acc;
    },
    { high: 0, medium: 0, low: 0 },
  );

  return respondOk(ctx, {
    generatedAt: new Date().toISOString(),
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
  });
}

export const GET = withApiEnvelope(_GET);
