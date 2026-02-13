import { NextRequest } from "next/server";
import { CrmJourneyStatus } from "@prisma/client";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondOk } from "@/lib/http/envelope";
import { prisma } from "@/lib/prisma";
import { crmFail, resolveCrmRequest } from "@/app/api/org/[orgId]/crm/_shared";

async function _POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const ctx = getRequestContext(req);
  const access = await resolveCrmRequest({ req, required: "EDIT", requireVerifiedEmailReason: "CRM_JOURNEYS" });
  if (!access.ok) return access.response;

  const { id } = await context.params;
  const existing = await prisma.crmJourney.findFirst({
    where: { id, organizationId: access.organization.id },
    select: { id: true },
  });
  if (!existing) return crmFail(req, 404, "Journey não encontrada.");

  const journey = await prisma.crmJourney.update({
    where: { id: existing.id },
    data: {
      status: CrmJourneyStatus.PAUSED,
      pausedAt: new Date(),
    },
    select: {
      id: true,
      name: true,
      status: true,
      publishedAt: true,
      pausedAt: true,
      updatedAt: true,
    },
  });

  return respondOk(ctx, { journey });
}

export const POST = withApiEnvelope(_POST);
