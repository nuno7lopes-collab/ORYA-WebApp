import { NextRequest } from "next/server";
import { CrmCampaignApprovalState, CrmCampaignStatus, Prisma } from "@prisma/client";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondOk } from "@/lib/http/envelope";
import { prisma } from "@/lib/prisma";
import { campaignChannelsToList, hasAnyCampaignChannel, normalizeCampaignChannels } from "@/lib/crm/campaignChannels";
import { crmFail, resolveCrmRequest } from "@/app/api/org/[orgId]/crm/_shared";

function stableSerialize(value: unknown): string {
  if (value === null || value === undefined) return String(value);
  if (Array.isArray(value)) return `[${value.map((entry) => stableSerialize(entry)).join(",")}]`;
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${stableSerialize(entry)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

async function _PATCH(req: NextRequest, context: { params: Promise<{ campaignId: string }> }) {
  const ctx = getRequestContext(req);
  const access = await resolveCrmRequest({ req, required: "EDIT", requireVerifiedEmailReason: "CRM_CAMPAIGNS" });
  if (!access.ok) return access.response;

  const { campaignId } = await context.params;
  const existing = await prisma.crmCampaign.findFirst({
    where: { id: campaignId, organizationId: access.organization.id },
    select: {
      id: true,
      name: true,
      description: true,
      segmentId: true,
      status: true,
      approvalState: true,
      scheduledAt: true,
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
  let materialChanged = false;

  if (typeof body?.name === "string") {
    const name = body.name.trim();
    if (name.length < 2) return crmFail(req, 400, "Nome inválido.");
    if (name !== existing.name) {
      patchData.name = name;
      materialChanged = true;
    }
  }

  if (typeof body?.description === "string" || body?.description === null) {
    const nextDescription = typeof body.description === "string" ? body.description.trim() : null;
    if (nextDescription !== existing.description) {
      patchData.description = nextDescription;
      materialChanged = true;
    }
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
    if (segmentId !== existing.segmentId) {
      patchData.segmentId = segmentId;
      materialChanged = true;
    }
  }

  const existingPayload =
    existing.payload && typeof existing.payload === "object" && !Array.isArray(existing.payload)
      ? (existing.payload as Record<string, unknown>)
      : {};
  const payloadInput =
    body?.payload && typeof body.payload === "object" && !Array.isArray(body.payload)
      ? (body.payload as Record<string, unknown>)
      : existingPayload;

  const shouldUpdatePayloadOrChannels =
    Boolean(body && Object.prototype.hasOwnProperty.call(body, "channels")) ||
    Boolean(body && Object.prototype.hasOwnProperty.call(body, "payload"));

  if (shouldUpdatePayloadOrChannels) {
    const existingChannels = normalizeCampaignChannels(existing.channels ?? existingPayload.channels);
    const nextChannels = normalizeCampaignChannels(body?.channels ?? payloadInput.channels ?? existing.channels);
    if (!hasAnyCampaignChannel(nextChannels)) {
      return crmFail(req, 400, "Campanha sem canais válidos.");
    }
    const nextPayload = {
      ...payloadInput,
      channels: nextChannels,
    };

    if (nextChannels.inApp !== existingChannels.inApp || nextChannels.email !== existingChannels.email) {
      patchData.channels = nextChannels as Prisma.InputJsonValue;
      materialChanged = true;
    }
    if (stableSerialize(nextPayload) !== stableSerialize(existingPayload)) {
      patchData.payload = nextPayload as Prisma.InputJsonValue;
      materialChanged = true;
    }
  }

  if (body && Object.prototype.hasOwnProperty.call(body, "scheduledAt")) {
    const raw = body.scheduledAt;
    if (raw === null || raw === "") {
      if (existing.scheduledAt !== null || existing.status !== CrmCampaignStatus.DRAFT) {
        patchData.scheduledAt = null;
        patchData.status = CrmCampaignStatus.DRAFT;
        materialChanged = true;
      }
    } else if (typeof raw === "string") {
      const parsed = new Date(raw);
      if (Number.isNaN(parsed.getTime())) return crmFail(req, 400, "Data inválida.");
      const existingScheduledIso = existing.scheduledAt ? existing.scheduledAt.toISOString() : null;
      if (existingScheduledIso !== parsed.toISOString() || existing.status !== CrmCampaignStatus.SCHEDULED) {
        patchData.scheduledAt = parsed;
        patchData.status = CrmCampaignStatus.SCHEDULED;
        materialChanged = true;
      }
    } else {
      return crmFail(req, 400, "Data inválida.");
    }
  }

  // Só alterações materiais obrigam nova submissão/aprovação.
  if (materialChanged && existing.approvalState !== CrmCampaignApprovalState.DRAFT) {
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

  const updatedPayload =
    updated.payload && typeof updated.payload === "object" && !Array.isArray(updated.payload)
      ? (updated.payload as Record<string, unknown>)
      : {};
  const channelConfig = normalizeCampaignChannels(updated.channels ?? updatedPayload.channels);

  return respondOk(ctx, {
    campaign: {
      ...updated,
      channels: campaignChannelsToList(channelConfig),
      channelsConfig: channelConfig,
    },
  });
}

export const PATCH = withApiEnvelope(_PATCH);
