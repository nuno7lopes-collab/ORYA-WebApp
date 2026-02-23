import { NextRequest } from "next/server";
import { CrmJourneyStatus } from "@prisma/client";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { prisma } from "@/lib/prisma";
import { crmFail, resolveCrmRequest } from "@/app/api/org/[orgId]/crm/_shared";

async function _POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
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

  return crmFail(
    req,
    409,
    "Publicação de journeys indisponível: o motor de execução ainda não está ativo.",
  );
}

export const POST = withApiEnvelope(_POST);
