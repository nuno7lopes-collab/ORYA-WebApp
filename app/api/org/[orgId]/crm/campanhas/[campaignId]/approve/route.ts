import { NextRequest } from "next/server";
import { CrmCampaignApprovalState, CrmCampaignStatus } from "@prisma/client";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondOk } from "@/lib/http/envelope";
import { prisma } from "@/lib/prisma";
import { appendCampaignApprovalAudit, canApproveCampaign, canTransitionToApproved } from "@/lib/crm/campaignApproval";
import { crmFail, resolveCrmRequest } from "@/app/api/org/[orgId]/crm/_shared";

async function _POST(req: NextRequest, context: { params: Promise<{ campaignId: string }> }) {
  const ctx = getRequestContext(req);
  const access = await resolveCrmRequest({ req, required: "EDIT", requireVerifiedEmailReason: "CRM_CAMPAIGNS" });
  if (!access.ok) return access.response;

  if (!canApproveCampaign(access.membership.role)) {
    return crmFail(req, 403, "Apenas Owner/Co-Owner/Admin podem aprovar campanhas.");
  }

  const { campaignId } = await context.params;
  const campaign = await prisma.crmCampaign.findFirst({
    where: { id: campaignId, organizationId: access.organization.id },
    select: {
      id: true,
      status: true,
      approvalState: true,
      scheduledAt: true,
    },
  });
  if (!campaign) return crmFail(req, 404, "Campanha não encontrada.");

  if (!canTransitionToApproved(campaign.status, campaign.approvalState)) {
    return crmFail(req, 409, "Campanha não pode ser aprovada neste estado.");
  }

  const now = new Date();
  const nextStatus = campaign.scheduledAt ? CrmCampaignStatus.SCHEDULED : CrmCampaignStatus.DRAFT;

  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.crmCampaign.update({
      where: { id: campaign.id },
      data: {
        status: nextStatus,
        approvalState: CrmCampaignApprovalState.APPROVED,
        approvedByUserId: access.user.id,
        approvedAt: now,
      },
      select: {
        id: true,
        status: true,
        approvalState: true,
        approvedAt: true,
        approvedByUserId: true,
      },
    });

    await appendCampaignApprovalAudit(tx, {
      organizationId: access.organization.id,
      campaignId: campaign.id,
      state: CrmCampaignApprovalState.APPROVED,
      action: "APPROVED",
      actorUserId: access.user.id,
    });

    return next;
  });

  return respondOk(ctx, { campaign: updated });
}

export const POST = withApiEnvelope(_POST);
