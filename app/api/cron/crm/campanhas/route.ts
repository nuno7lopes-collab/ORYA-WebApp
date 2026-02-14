export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { ensureCrmModuleAccess } from "@/lib/crm/access";
import { sendCrmCampaign } from "@/lib/crm/campaignSend";
import { CrmCampaignApprovalState, CrmCampaignStatus } from "@prisma/client";
import { ensureCrmPolicy, policyToConfig } from "@/lib/crm/policy";
import { requireInternalSecret } from "@/lib/security/requireInternalSecret";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { logError, logInfo } from "@/lib/observability/logger";
import { recordCronHeartbeat } from "@/lib/cron/heartbeat";
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

function parseLimit(value: string | null) {
  if (!value) return DEFAULT_LIMIT;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_LIMIT;
  return Math.min(Math.floor(parsed), MAX_LIMIT);
}

async function processApprovalSla(now: Date, limit: number) {
  const pending = await prisma.crmCampaign.findMany({
    where: {
      approvalState: CrmCampaignApprovalState.SUBMITTED,
      status: { notIn: [CrmCampaignStatus.SENT, CrmCampaignStatus.SENDING, CrmCampaignStatus.CANCELLED] },
    },
    orderBy: { approvalSubmittedAt: "asc" },
    take: limit,
    select: {
      id: true,
      organizationId: true,
      approvalSubmittedAt: true,
      approvalExpiresAt: true,
      status: true,
    },
  });

  let escalated = 0;
  let expired = 0;

  for (const campaign of pending) {
    const policy = await ensureCrmPolicy(prisma, campaign.organizationId);
    const config = policyToConfig(policy);
    const submittedAt = campaign.approvalSubmittedAt ?? now;
    const escalationAt = new Date(submittedAt.getTime() + config.approvalEscalationHours * 60 * 60 * 1000);
    const expiresAt =
      campaign.approvalExpiresAt ?? new Date(submittedAt.getTime() + config.approvalExpireHours * 60 * 60 * 1000);

    if (now >= expiresAt) {
      await prisma.$transaction(async (tx) => {
        await tx.crmCampaign.update({
          where: { id: campaign.id },
          data: {
            approvalState: CrmCampaignApprovalState.EXPIRED,
            status: CrmCampaignStatus.CANCELLED,
            cancelledAt: now,
          },
        });
        await tx.crmCampaignApproval.create({
          data: {
            organizationId: campaign.organizationId,
            campaignId: campaign.id,
            state: CrmCampaignApprovalState.EXPIRED,
            action: "EXPIRED",
            metadata: {
              submittedAt: submittedAt.toISOString(),
              expiresAt: expiresAt.toISOString(),
            },
          },
        });
      });
      expired += 1;
      continue;
    }

    if (now >= escalationAt) {
      const alreadyEscalated = await prisma.crmCampaignApproval.findFirst({
        where: {
          campaignId: campaign.id,
          action: "ESCALATED",
          createdAt: { gte: submittedAt },
        },
        select: { id: true },
      });
      if (!alreadyEscalated) {
        await prisma.crmCampaignApproval.create({
          data: {
            organizationId: campaign.organizationId,
            campaignId: campaign.id,
            state: CrmCampaignApprovalState.SUBMITTED,
            action: "ESCALATED",
            metadata: {
              escalationAt: escalationAt.toISOString(),
            },
          },
        });
        escalated += 1;
      }
    }
  }

  return { escalated, expired };
}

async function _POST(req: NextRequest) {
  const startedAt = new Date();
  try {
    if (!requireInternalSecret(req)) {
      return jsonWrap({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }
    const limit = parseLimit(req.nextUrl.searchParams.get("limit"));
    const now = new Date();
    const approvalSla = await processApprovalSla(now, limit * 2);
    const campaigns = await prisma.crmCampaign.findMany({
      where: {
        status: CrmCampaignStatus.SCHEDULED,
        approvalState: CrmCampaignApprovalState.APPROVED,
        scheduledAt: { lte: now },
      },
      orderBy: { scheduledAt: "asc" },
      take: limit,
      select: {
        id: true,
        organization: { select: { id: true, primaryModule: true } },
      },
    });

    const results: Array<{
      id: string;
      organizationId: number | null;
      ok: boolean;
      error?: string;
      sentCount?: number;
      failedCount?: number;
      totalEligible?: number;
    }> = [];

    for (const campaign of campaigns) {
      const organization = campaign.organization;
      if (!organization) {
        results.push({ id: campaign.id, organizationId: null, ok: false, error: "ORGANIZATION_NOT_FOUND" });
        continue;
      }

      const crmAccess = await ensureCrmModuleAccess(organization);
      if (!crmAccess.ok) {
        results.push({ id: campaign.id, organizationId: organization.id, ok: false, error: crmAccess.error });
        continue;
      }

      const result = await sendCrmCampaign({
        organizationId: organization.id,
        campaignId: campaign.id,
        allowedStatuses: [CrmCampaignStatus.SCHEDULED],
      });

      if (!result.ok) {
        results.push({ id: campaign.id, organizationId: organization.id, ok: false, error: result.message });
        continue;
      }

      results.push({
        id: campaign.id,
        organizationId: organization.id,
        ok: true,
        sentCount: result.sentCount,
        failedCount: result.failedCount,
        totalEligible: result.totalEligible,
      });
    }

    const sent = results.filter((item) => item.ok).length;
    logInfo("cron.crm.campanhas", {
      processed: results.length,
      sent,
      escalated: approvalSla.escalated,
      expired: approvalSla.expired,
    });

    await recordCronHeartbeat("crm-campanhas", { status: "SUCCESS", startedAt });
    return jsonWrap(
      {
        ok: true,
        processed: results.length,
        sent,
        escalated: approvalSla.escalated,
        expired: approvalSla.expired,
        results,
      },
      { status: 200 },
    );
  } catch (err) {
    logError("cron.crm.campanhas_error", err);
    await recordCronHeartbeat("crm-campanhas", { status: "ERROR", startedAt, error: err });
    return jsonWrap({ ok: false, error: "Internal error" }, { status: 500 });
  }
}
export const POST = withApiEnvelope(_POST);
