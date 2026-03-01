import { NextRequest } from "next/server";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondOk } from "@/lib/http/envelope";
import { prisma } from "@/lib/prisma";
import { crmFail, resolveCrmRequest } from "@/app/api/org/[orgId]/crm/_shared";

async function _GET(req: NextRequest, context: { params: Promise<{ customerId: string }> }) {
  const ctx = getRequestContext(req);
  const access = await resolveCrmRequest({ req, required: "VIEW" });
  if (!access.ok) return access.response;

  const { customerId } = await context.params;
  const contact = await prisma.crmContact.findFirst({
    where: { id: customerId, organizationId: access.organization.id },
    select: { id: true },
  });
  if (!contact) {
    return crmFail(req, 404, "Cliente não encontrado.");
  }

  const padel = await prisma.crmContactPadel.findUnique({
    where: { contactId: customerId },
    select: {
      id: true,
      playerProfileId: true,
      level: true,
      preferredSide: true,
      clubName: true,
      tournamentsCount: true,
      noShowCount: true,
      lastMatchAt: true,
      matches30d: true,
      winRate90d: true,
      noShowRate90d: true,
      activityStatus: true,
      competitiveTier: true,
      rfmScore: true,
      churnRiskScore: true,
      reactivationPropensityScore: true,
      createdAt: true,
      updatedAt: true,
      playerProfile: {
        select: {
          id: true,
          fullName: true,
          level: true,
          preferredSide: true,
          clubName: true,
        },
      },
    },
  });

  return respondOk(ctx, {
    contactId: customerId,
    padel,
  });
}

export const GET = withApiEnvelope(_GET);
