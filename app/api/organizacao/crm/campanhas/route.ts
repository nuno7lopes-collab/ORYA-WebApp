import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { ensureCrmModuleAccess } from "@/lib/crm/access";
import { campaignChannelsToList, normalizeCampaignChannels } from "@/lib/crm/campaignChannels";
import {
  CrmCampaignApprovalState,
  CrmCampaignChannel,
  CrmCampaignStatus,
  OrganizationMemberRole,
  Prisma,
} from "@prisma/client";
import { ensureOrganizationEmailVerified } from "@/lib/organizationWriteAccess";
import { getRequestContext, type RequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { isCrmCampaignsEnabled } from "@/lib/featureFlags";

const READ_ROLES = Object.values(OrganizationMemberRole);

function fail(
  ctx: RequestContext,
  status: number,
  message: string,
  errorCode = errorCodeForStatus(status),
  retryable = status >= 500,
  details?: Record<string, unknown>,
) {
  const resolvedMessage = typeof message === "string" ? message : String(message);
  const resolvedCode = /^[A-Z0-9_]+$/.test(resolvedMessage) ? resolvedMessage : errorCode;
  return respondError(
    ctx,
    { errorCode: resolvedCode, message: resolvedMessage, retryable, ...(details ? { details } : {}) },
    { status },
  );
}

async function _GET(req: NextRequest) {
  const ctx = getRequestContext(req);
  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization, membership } = await getActiveOrganizationForUser(user.id, {
      organizationId: organizationId ?? undefined,
      roles: [...READ_ROLES],
    });

    if (!organization || !membership) {
      return fail(ctx, 403, "Sem permissões.");
    }
    const crmAccess = await ensureCrmModuleAccess(organization, prisma, {
      member: { userId: membership.userId, role: membership.role },
      required: "VIEW",
    });
    if (!crmAccess.ok) {
      return fail(ctx, 403, crmAccess.error);
    }
    if (!isCrmCampaignsEnabled()) {
      return fail(ctx, 403, "Campanhas CRM desativadas.", "FEATURE_DISABLED", false, {
        feature: "CRM_CAMPAIGNS",
      });
    }

    const campaigns = await prisma.crmCampaign.findMany({
      where: { organizationId: organization.id },
      orderBy: { createdAt: "desc" },
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

    const items = campaigns.map((campaign) => {
      const payload = campaign.payload && typeof campaign.payload === "object" ? (campaign.payload as Record<string, unknown>) : null;
      const channelsConfig = normalizeCampaignChannels(campaign.channels ?? payload?.channels);
      const { payload: _payload, ...rest } = campaign;
      return {
        ...rest,
        channels: campaignChannelsToList(channelsConfig),
        channelsConfig,
      };
    });

    return respondOk(ctx, { items });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail(ctx, 401, "UNAUTHENTICATED");
    }
    console.error("GET /api/organizacao/crm/campanhas error:", err);
    return fail(ctx, 500, "Erro ao carregar campanhas.");
  }
}

async function _POST(req: NextRequest) {
  const ctx = getRequestContext(req);
  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization, membership } = await getActiveOrganizationForUser(user.id, {
      organizationId: organizationId ?? undefined,
      roles: [...READ_ROLES],
    });

    if (!organization || !membership) {
      return fail(ctx, 403, "Sem permissões.");
    }
    const emailGate = ensureOrganizationEmailVerified(organization, { reasonCode: "CRM_CAMPAIGNS" });
    if (!emailGate.ok) {
      return respondError(
        ctx,
        {
          errorCode: emailGate.errorCode ?? "FORBIDDEN",
          message: emailGate.message ?? emailGate.errorCode ?? "Sem permissões.",
          retryable: false,
          details: emailGate,
        },
        { status: 403 },
      );
    }
    const crmAccess = await ensureCrmModuleAccess(organization, prisma, {
      member: { userId: membership.userId, role: membership.role },
      required: "EDIT",
    });
    if (!crmAccess.ok) {
      return fail(ctx, 403, crmAccess.error);
    }
    if (!isCrmCampaignsEnabled()) {
      return fail(ctx, 403, "Campanhas CRM desativadas.", "FEATURE_DISABLED", false, {
        feature: "CRM_CAMPAIGNS",
      });
    }

    const payload = (await req.json().catch(() => null)) as {
      name?: unknown;
      description?: unknown;
      segmentId?: unknown;
      channel?: unknown;
      channels?: unknown;
      payload?: unknown;
      audienceSnapshot?: unknown;
      scheduledAt?: unknown;
    } | null;

    const name = typeof payload?.name === "string" ? payload.name.trim() : "";
    if (name.length < 2) {
      return fail(ctx, 400, "Nome inválido.");
    }

    const description = typeof payload?.description === "string" ? payload.description.trim() : null;
    const segmentId = typeof payload?.segmentId === "string" ? payload.segmentId : null;
    const channel = payload?.channel === "IN_APP" ? CrmCampaignChannel.IN_APP : CrmCampaignChannel.IN_APP;
    const rawPayload =
      payload?.payload && typeof payload.payload === "object" && !Array.isArray(payload.payload)
        ? (payload.payload as Record<string, unknown>)
        : {};
    const requestedChannels = payload?.channels ?? rawPayload.channels;
    const channelConfig = normalizeCampaignChannels(requestedChannels);
    const campaignPayload = {
      ...rawPayload,
      channels: channelConfig,
    };
    const audienceSnapshot =
      payload?.audienceSnapshot && typeof payload.audienceSnapshot === "object" && !Array.isArray(payload.audienceSnapshot)
        ? (payload.audienceSnapshot as Prisma.InputJsonValue)
        : ({} as Prisma.InputJsonValue);
    const scheduledAtRaw = payload?.scheduledAt;
    let scheduledAt: Date | null = null;

    if (typeof scheduledAtRaw === "string" && scheduledAtRaw.trim()) {
      const parsed = new Date(scheduledAtRaw);
      if (Number.isNaN(parsed.getTime())) {
        return fail(ctx, 400, "Data invalida.");
      }
      scheduledAt = parsed;
    } else if (scheduledAtRaw !== null && scheduledAtRaw !== undefined && scheduledAtRaw !== "") {
      return fail(ctx, 400, "Data invalida.");
    }

    if (segmentId) {
      const segment = await prisma.crmSegment.findFirst({
        where: { id: segmentId, organizationId: organization.id },
        select: { id: true },
      });
      if (!segment) {
        return fail(ctx, 400, "Segmento inválido.");
      }
    }

    const campaign = await prisma.crmCampaign.create({
      data: {
        organizationId: organization.id,
        name,
        description,
        segmentId,
        channel,
        channels: channelConfig as Prisma.InputJsonValue,
        approvalState: CrmCampaignApprovalState.DRAFT,
        payload: campaignPayload as Prisma.InputJsonValue,
        audienceSnapshot,
        scheduledAt,
        status: scheduledAt ? CrmCampaignStatus.SCHEDULED : CrmCampaignStatus.DRAFT,
        createdByUserId: user.id,
      },
      select: {
        id: true,
        name: true,
        description: true,
        status: true,
        approvalState: true,
        channel: true,
        channels: true,
        scheduledAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return respondOk(ctx, { campaign });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail(ctx, 401, "UNAUTHENTICATED");
    }
    console.error("POST /api/organizacao/crm/campanhas error:", err);
    return fail(ctx, 500, "Erro ao criar campanha.");
  }
}

function errorCodeForStatus(status: number) {
  if (status === 401) return "UNAUTHENTICATED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 409) return "CONFLICT";
  if (status === 410) return "GONE";
  if (status === 413) return "PAYLOAD_TOO_LARGE";
  if (status === 422) return "VALIDATION_FAILED";
  if (status === 400) return "BAD_REQUEST";
  return "INTERNAL_ERROR";
}
export const GET = withApiEnvelope(_GET);
export const POST = withApiEnvelope(_POST);
