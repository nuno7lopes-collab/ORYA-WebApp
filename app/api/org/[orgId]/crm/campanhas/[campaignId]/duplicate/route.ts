import { NextRequest } from "next/server";
import { CrmCampaignApprovalState, CrmCampaignStatus, Prisma } from "@prisma/client";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondOk } from "@/lib/http/envelope";
import { prisma } from "@/lib/prisma";
import { crmFail, resolveCrmRequest } from "@/app/api/org/[orgId]/crm/_shared";
import {
  campaignChannelsToList,
  hasAnyCampaignChannel,
  normalizeCampaignChannels,
} from "@/lib/crm/campaignChannels";

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

async function _POST(req: NextRequest, context: { params: Promise<{ campaignId: string }> }) {
  const ctx = getRequestContext(req);
  const access = await resolveCrmRequest({
    req,
    required: "EDIT",
    requireVerifiedEmailReason: "CRM_CAMPAIGNS",
  });
  if (!access.ok) return access.response;

  const { campaignId } = await context.params;
  const campaign = await prisma.crmCampaign.findFirst({
    where: { id: campaignId, organizationId: access.organization.id },
    select: {
      id: true,
      segmentId: true,
      name: true,
      description: true,
      channel: true,
      channels: true,
      payload: true,
      audienceSnapshot: true,
    },
  });
  if (!campaign) return crmFail(req, 404, "Campanha não encontrada.");

  const basePayload = asObject(campaign.payload);
  const channelConfig = normalizeCampaignChannels(campaign.channels ?? basePayload.channels);
  if (!hasAnyCampaignChannel(channelConfig)) {
    return crmFail(req, 409, "Campanha origem sem canais válidos.");
  }

  const copyName = `${campaign.name} (cópia)`;
  const cloned = await prisma.crmCampaign.create({
    data: {
      organizationId: access.organization.id,
      segmentId: campaign.segmentId,
      name: copyName,
      description: campaign.description,
      channel: campaign.channel,
      channels: channelConfig as Prisma.InputJsonValue,
      status: CrmCampaignStatus.DRAFT,
      approvalState: CrmCampaignApprovalState.DRAFT,
      payload: {
        ...basePayload,
        channels: channelConfig,
      } as Prisma.InputJsonValue,
      audienceSnapshot: asObject(campaign.audienceSnapshot) as Prisma.InputJsonValue,
      scheduledAt: null,
      sentAt: null,
      cancelledAt: null,
      sentCount: 0,
      openedCount: 0,
      clickedCount: 0,
      failedCount: 0,
      createdByUserId: access.user.id,
    },
    select: {
      id: true,
      name: true,
      description: true,
      status: true,
      approvalState: true,
      channel: true,
      channels: true,
      payload: true,
      scheduledAt: true,
      createdAt: true,
      updatedAt: true,
      segment: { select: { id: true, name: true } },
    },
  });

  const payload = asObject(cloned.payload);
  const normalizedChannels = normalizeCampaignChannels(cloned.channels ?? payload.channels);
  return respondOk(ctx, {
    campaign: {
      ...cloned,
      channels: campaignChannelsToList(normalizedChannels),
      channelsConfig: normalizedChannels,
    },
  });
}

export const POST = withApiEnvelope(_POST);
