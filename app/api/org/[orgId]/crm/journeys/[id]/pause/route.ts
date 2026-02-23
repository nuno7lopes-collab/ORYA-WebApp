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
    select: { id: true, status: true },
  });
  if (!existing) return crmFail(req, 404, "Journey não encontrada.");
  if (existing.status === CrmJourneyStatus.ARCHIVED) {
    return crmFail(req, 409, "Journey arquivada.");
  }

  const pauseAt = new Date();
  const lock = await prisma.crmJourney.updateMany({
    where: {
      id: existing.id,
      organizationId: access.organization.id,
      status: existing.status,
    },
    data: {
      status: CrmJourneyStatus.PAUSED,
      pausedAt: pauseAt,
    },
  });
  if (lock.count === 0) {
    return crmFail(req, 409, "Journey alterada por outro utilizador. Recarrega e tenta novamente.");
  }

  const journey = await prisma.crmJourney.findUnique({
    where: { id: existing.id },
    select: {
      id: true,
      name: true,
      status: true,
      publishedAt: true,
      pausedAt: true,
      updatedAt: true,
    },
  });
  if (!journey) {
    return crmFail(req, 404, "Journey não encontrada.");
  }

  return respondOk(ctx, { journey });
}

export const POST = withApiEnvelope(_POST);
