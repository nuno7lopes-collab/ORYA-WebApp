import { NextRequest } from "next/server";
import { CrmCampaignApprovalState, CrmCampaignStatus, Prisma } from "@prisma/client";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondOk } from "@/lib/http/envelope";
import { prisma } from "@/lib/prisma";
import { normalizeCampaignChannels, campaignChannelsToList } from "@/lib/crm/campaignChannels";
import { crmFail, resolveCrmRequest } from "@/app/api/org/[orgId]/crm/_shared";

async function _PATCH(req: NextRequest, context: { params: Promise<{ campaignId: string }> }) {
  const ctx = getRequestContext(req);
  const access = await resolveCrmRequest({ req, required: "EDIT", requireVerifiedEmailReason: "CRM_CAMPAIGNS" });
  if (!access.ok) return access.response;

  const { campaignId } = await context.params;
  const existing = await prisma.crmCampaign.findFirst({
    where: { id: campaignId, organizationId: access.organization.id },
    select: {
      id: true,
      status: true,
      approvalState: true,
      payload: true,
      channels: true,
    },
  });

  if (!existing) return crmFail(req, 404, "Campanha não encontrada.");
  const blockedStatuses: CrmCampaignStatus[] = [
    CrmCampaignStatus.SENDING,
    CrmCampaignStatus.SENT,
    CrmCampaignStatus.CANCELLED,
  ];
  if (blockedStatuses.includes(existing.status)) {
    return crmFail(req, 409, "Campanha não pode ser editada neste estado.");
  }

  const body = (await req.json().catch(() => null)) as {
    name?: unknown;
    description?: unknown;
    segmentId?: unknown | null;
    channels?: unknown;
    payload?: unknown;
    scheduledAt?: unknown;
  } | null;

  const patchData: Prisma.CrmCampaignUncheckedUpdateInput = {};

  if (typeof body?.name === "string") {
    const name = body.name.trim();
    if (name.length < 2) return crmFail(req, 400, "Nome inválido.");
    patchData.name = name;
  }

  if (typeof body?.description === "string" || body?.description === null) {
    patchData.description = typeof body.description === "string" ? body.description.trim() : null;
  }

  if (typeof body?.segmentId === "string" || body?.segmentId === null) {
    const segmentId = typeof body.segmentId === "string" && body.segmentId.trim() ? body.segmentId.trim() : null;
    if (segmentId) {
      const segment = await prisma.crmSegment.findFirst({
        where: { id: segmentId, organizationId: access.organization.id },
        select: { id: true },
      });
      if (!segment) return crmFail(req, 400, "Segmento inválido.");
    }
    patchData.segmentId = segmentId;
  }

  const rawPayload =
    body?.payload && typeof body.payload === "object" && !Array.isArray(body.payload)
      ? (body.payload as Record<string, unknown>)
      : existing.payload && typeof existing.payload === "object" && !Array.isArray(existing.payload)
        ? (existing.payload as Record<string, unknown>)
        : {};

  const nextChannels = normalizeCampaignChannels(body?.channels ?? rawPayload.channels ?? existing.channels);
  patchData.channels = nextChannels as Prisma.InputJsonValue;
  patchData.payload = {
    ...rawPayload,
    channels: nextChannels,
  } as Prisma.InputJsonValue;

  if (body && Object.prototype.hasOwnProperty.call(body, "scheduledAt")) {
    const raw = body.scheduledAt;
    if (raw === null || raw === "") {
      patchData.scheduledAt = null;
      patchData.status = CrmCampaignStatus.DRAFT;
    } else if (typeof raw === "string") {
      const parsed = new Date(raw);
      if (Number.isNaN(parsed.getTime())) return crmFail(req, 400, "Data inválida.");
      patchData.scheduledAt = parsed;
      patchData.status = CrmCampaignStatus.SCHEDULED;
    } else {
      return crmFail(req, 400, "Data inválida.");
    }
  }

  // Qualquer alteração estrutural obriga nova submissão/aprovação.
  if (existing.approvalState !== CrmCampaignApprovalState.DRAFT) {
    patchData.approvalState = CrmCampaignApprovalState.DRAFT;
    patchData.approvalSubmittedAt = null;
    patchData.approvalExpiresAt = null;
    patchData.approvedByUserId = null;
    patchData.approvedAt = null;
    patchData.rejectedByUserId = null;
    patchData.rejectedAt = null;
  }

  const updated = await prisma.crmCampaign.update({
    where: { id: existing.id },
    data: patchData,
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
      channels: true,
      payload: true,
      scheduledAt: true,
      sentAt: true,
      sentCount: true,
      failedCount: true,
      createdAt: true,
      updatedAt: true,
      segment: { select: { id: true, name: true } },
    },
  });

  const channelConfig = normalizeCampaignChannels(updated.channels ?? (updated.payload as Record<string, unknown>)?.channels);

  return respondOk(ctx, {
    campaign: {
      ...updated,
      channels: campaignChannelsToList(channelConfig),
      channelsConfig: channelConfig,
    },
  });
}

export const PATCH = withApiEnvelope(_PATCH);
