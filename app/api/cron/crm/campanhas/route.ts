export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { ensureCrmModuleAccess } from "@/lib/crm/access";
import { sendCrmCampaign } from "@/lib/crm/campaignSend";
import { CrmCampaignStatus } from "@prisma/client";
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

async function _POST(req: NextRequest) {
  const startedAt = new Date();
  try {
    if (!requireInternalSecret(req)) {
      return jsonWrap({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const limit = parseLimit(req.nextUrl.searchParams.get("limit"));
    const now = new Date();
    const campaigns = await prisma.crmCampaign.findMany({
      where: {
        status: CrmCampaignStatus.SCHEDULED,
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
    logInfo("cron.crm.campanhas", { processed: results.length, sent });

    await recordCronHeartbeat("crm-campanhas", { status: "SUCCESS", startedAt });
    return jsonWrap({ ok: true, processed: results.length, sent, results }, { status: 200 });
  } catch (err) {
    logError("cron.crm.campanhas_error", err);
    await recordCronHeartbeat("crm-campanhas", { status: "ERROR", startedAt, error: err });
    return jsonWrap({ ok: false, error: "Internal error" }, { status: 500 });
  }
}
export const POST = withApiEnvelope(_POST);
