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

function parseScheduledAt(value: unknown) {
  if (value === null) return { ok: true as const, date: null as Date | null };
  if (value === undefined || value === "") return { ok: true as const, date: null as Date | null };
  if (typeof value !== "string" || !value.trim()) return { ok: false as const };
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return { ok: false as const };
  return { ok: true as const, date: parsed };
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

async function _PATCH(req: NextRequest, context: { params: Promise<{ campaignId: string }> }) {
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
      organizationId: true,
      segmentId: true,
      name: true,
      description: true,
      status: true,
      approvalState: true,
      channels: true,
      payload: true,
      audienceSnapshot: true,
      scheduledAt: true,
    },
  });
  if (!campaign) return crmFail(req, 404, "Campanha não encontrada.");
  if ([CrmCampaignStatus.SENT, CrmCampaignStatus.SENDING, CrmCampaignStatus.CANCELLED].includes(campaign.status)) {
    return crmFail(req, 409, "Campanha bloqueada para edição no estado atual.");
  }

  const body = (await req.json().catch(() => null)) as {
    name?: unknown;
    description?: unknown;
    segmentId?: unknown;
    channels?: unknown;
    payload?: unknown;
    audienceSnapshot?: unknown;
    scheduledAt?: unknown;
  } | null;
  if (!body || typeof body !== "object") {
    return crmFail(req, 400, "Payload inválido.");
  }

  const updateData: Prisma.CrmCampaignUncheckedUpdateInput = {};

  if (typeof body.name === "string") {
    const name = body.name.trim();
    if (name.length < 2) return crmFail(req, 400, "Nome inválido.");
    updateData.name = name;
  }
  if (typeof body.description === "string" || body.description === null) {
    updateData.description = typeof body.description === "string" ? body.description.trim() : null;
  }

  if (Object.prototype.hasOwnProperty.call(body, "segmentId")) {
    const nextSegmentId = typeof body.segmentId === "string" && body.segmentId.trim() ? body.segmentId.trim() : null;
    if (nextSegmentId) {
      const segment = await prisma.crmSegment.findFirst({
        where: { id: nextSegmentId, organizationId: access.organization.id },
        select: { id: true },
      });
      if (!segment) return crmFail(req, 400, "Segmento inválido.");
      updateData.segmentId = nextSegmentId;
    } else {
      updateData.segmentId = null;
    }
  }

  const existingPayload = asObject(campaign.payload);
  const payloadPatch = asObject(body.payload);
  const requestedChannels = body.channels ?? payloadPatch.channels ?? campaign.channels ?? existingPayload.channels;
  const channelConfig = normalizeCampaignChannels(requestedChannels);
  if (!hasAnyCampaignChannel(channelConfig)) {
    return crmFail(req, 400, "Campanha sem canais válidos.");
  }
  const mergedPayload = {
    ...existingPayload,
    ...payloadPatch,
    channels: channelConfig,
  };
  updateData.channels = channelConfig as Prisma.InputJsonValue;
  updateData.payload = mergedPayload as Prisma.InputJsonValue;

  if (Object.prototype.hasOwnProperty.call(body, "audienceSnapshot")) {
    const audienceSnapshot = asObject(body.audienceSnapshot);
    updateData.audienceSnapshot = audienceSnapshot as Prisma.InputJsonValue;
  }

  if (Object.prototype.hasOwnProperty.call(body, "scheduledAt")) {
    const schedule = parseScheduledAt(body.scheduledAt);
    if (!schedule.ok) return crmFail(req, 400, "Data invalida.");
    updateData.scheduledAt = schedule.date;
    updateData.status = schedule.date ? CrmCampaignStatus.SCHEDULED : CrmCampaignStatus.DRAFT;
  } else {
    updateData.status = campaign.scheduledAt ? CrmCampaignStatus.SCHEDULED : CrmCampaignStatus.DRAFT;
  }

  // Qualquer edição funcional exige nova aprovação.
  updateData.approvalState = CrmCampaignApprovalState.DRAFT;
  updateData.approvalSubmittedAt = null;
  updateData.approvalExpiresAt = null;
  updateData.approvedByUserId = null;
  updateData.approvedAt = null;
  updateData.rejectedByUserId = null;
  updateData.rejectedAt = null;
  updateData.cancelledAt = null;

  const updated = await prisma.crmCampaign.update({
    where: { id: campaign.id },
    data: updateData,
    select: {
      id: true,
      name: true,
      description: true,
      status: true,
      approvalState: true,
      approvalSubmittedAt: true,
      approvalExpiresAt: true,
      approvedAt: true,
      rejectedAt: true,
      cancelledAt: true,
      channel: true,
      channels: true,
      payload: true,
      scheduledAt: true,
      sentAt: true,
      sentCount: true,
      openedCount: true,
      clickedCount: true,
      failedCount: true,
      createdAt: true,
      updatedAt: true,
      segment: { select: { id: true, name: true } },
    },
  });

  const payload = asObject(updated.payload);
  const normalizedChannels = normalizeCampaignChannels(updated.channels ?? payload.channels);

  return respondOk(ctx, {
    campaign: {
      ...updated,
      channels: campaignChannelsToList(normalizedChannels),
      channelsConfig: normalizedChannels,
    },
  });
}

export const PATCH = withApiEnvelope(_PATCH);
