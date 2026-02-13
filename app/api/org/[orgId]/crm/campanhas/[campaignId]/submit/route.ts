import { NextRequest } from "next/server";
import { CrmCampaignApprovalState } from "@prisma/client";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondOk } from "@/lib/http/envelope";
import { prisma } from "@/lib/prisma";
import { normalizeCampaignChannels } from "@/lib/crm/campaignChannels";
import { ensureCrmPolicy, policyToConfig } from "@/lib/crm/policy";
import { appendCampaignApprovalAudit, canTransitionToSubmitted, nextApprovalExpiry } from "@/lib/crm/campaignApproval";
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
      name: true,
      status: true,
      approvalState: true,
      channels: true,
      payload: true,
      scheduledAt: true,
    },
  });
  if (!campaign) return crmFail(req, 404, "Campanha não encontrada.");

  if (!canTransitionToSubmitted(campaign.status, campaign.approvalState)) {
    return crmFail(req, 409, "Campanha não pode ser submetida neste estado.");
  }

  const channels = normalizeCampaignChannels(campaign.channels ?? (campaign.payload as Record<string, unknown>)?.channels);
  if (!channels.inApp && !channels.email) {
    return crmFail(req, 400, "Campanha sem canais válidos.");
  }

  const policy = await ensureCrmPolicy(prisma, access.organization.id, access.organization.timezone ?? undefined);
  const config = policyToConfig(policy);
  const now = new Date();
  const expiresAt = nextApprovalExpiry(now, config);

  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.crmCampaign.update({
      where: { id: campaign.id },
      data: {
        approvalState: CrmCampaignApprovalState.SUBMITTED,
        approvalSubmittedAt: now,
        approvalExpiresAt: expiresAt,
      },
      select: {
        id: true,
        status: true,
        approvalState: true,
        approvalSubmittedAt: true,
        approvalExpiresAt: true,
      },
    });

    await appendCampaignApprovalAudit(tx, {
      organizationId: access.organization.id,
      campaignId: campaign.id,
      state: CrmCampaignApprovalState.SUBMITTED,
      action: "SUBMITTED",
      actorUserId: access.user.id,
      metadata: {
        channels,
        escalationHours: config.approvalEscalationHours,
        expireHours: config.approvalExpireHours,
      },
    });

    return next;
  });

  return respondOk(ctx, { campaign: updated });
}

export const POST = withApiEnvelope(_POST);
