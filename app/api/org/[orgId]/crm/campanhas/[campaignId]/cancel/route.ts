import { NextRequest } from "next/server";
import { CrmCampaignApprovalState, CrmCampaignStatus } from "@prisma/client";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondOk } from "@/lib/http/envelope";
import { prisma } from "@/lib/prisma";
import { appendCampaignApprovalAudit, canTransitionToCancelled } from "@/lib/crm/campaignApproval";
import { crmFail, resolveCrmRequest } from "@/app/api/org/[orgId]/crm/_shared";

async function _POST(req: NextRequest, context: { params: Promise<{ campaignId: string }> }) {
  const ctx = getRequestContext(req);
  const access = await resolveCrmRequest({ req, required: "EDIT", requireVerifiedEmailReason: "CRM_CAMPAIGNS" });
  if (!access.ok) return access.response;

  const { campaignId } = await context.params;
  const campaign = await prisma.crmCampaign.findFirst({
    where: { id: campaignId, organizationId: access.organization.id },
    select: {
      id: true,
      status: true,
      approvalState: true,
    },
  });
  if (!campaign) return crmFail(req, 404, "Campanha não encontrada.");

  if (!canTransitionToCancelled(campaign.status)) {
    return crmFail(req, 409, "Campanha não pode ser cancelada neste estado.");
  }

  const now = new Date();
  const nextApprovalState =
    campaign.approvalState === CrmCampaignApprovalState.SUBMITTED
      ? CrmCampaignApprovalState.EXPIRED
      : campaign.approvalState;
  const STATE_CONFLICT = "CRM_CAMPAIGN_STATE_CONFLICT";

  let updated:
    | {
        id: string;
        status: CrmCampaignStatus;
        approvalState: CrmCampaignApprovalState;
        cancelledAt: Date | null;
      }
    | null = null;
  try {
    updated = await prisma.$transaction(async (tx) => {
      const lock = await tx.crmCampaign.updateMany({
        where: {
          id: campaign.id,
          organizationId: access.organization.id,
          status: campaign.status,
          approvalState: campaign.approvalState,
        },
        data: {
          status: CrmCampaignStatus.CANCELLED,
          cancelledAt: now,
          approvalState: nextApprovalState,
        },
      });
      if (lock.count === 0) {
        throw new Error(STATE_CONFLICT);
      }

      await appendCampaignApprovalAudit(tx, {
        organizationId: access.organization.id,
        campaignId: campaign.id,
        state: nextApprovalState,
        action: "CANCELLED",
        actorUserId: access.user.id,
      });

      return tx.crmCampaign.findUnique({
        where: { id: campaign.id },
        select: {
          id: true,
          status: true,
          approvalState: true,
          cancelledAt: true,
        },
      });
    });
  } catch (err) {
    if (err instanceof Error && err.message === STATE_CONFLICT) {
      return crmFail(req, 409, "Campanha alterada por outro utilizador. Recarrega e tenta novamente.");
    }
    throw err;
  }

  if (!updated) {
    return crmFail(req, 404, "Campanha não encontrada.");
  }

  return respondOk(ctx, { campaign: updated });
}

export const POST = withApiEnvelope(_POST);
