import { NextRequest } from "next/server";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { prisma } from "@/lib/prisma";
import {
  ensureCrmPolicy,
  normalizeCrmConfigInput,
  policyToConfig,
} from "@/lib/crm/policy";
import { resolveCrmRequest } from "@/app/api/org/[orgId]/crm/_shared";

async function _GET(req: NextRequest) {
  const ctx = getRequestContext(req);
  const access = await resolveCrmRequest({ req, required: "VIEW" });
  if (!access.ok) return access.response;

  const policy = await ensureCrmPolicy(prisma, access.organization.id, access.organization.timezone ?? undefined);
  return respondOk(ctx, {
    config: policyToConfig(policy),
  });
}

async function _PUT(req: NextRequest) {
  const ctx = getRequestContext(req);
  const access = await resolveCrmRequest({ req, required: "EDIT" });
  if (!access.ok) return access.response;

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const currentPolicy = await ensureCrmPolicy(prisma, access.organization.id, access.organization.timezone ?? undefined);
  const currentConfig = policyToConfig(currentPolicy);
  const nextConfig = normalizeCrmConfigInput(body?.config ?? body, currentConfig);

  try {
    const updated = await prisma.crmOrganizationPolicy.update({
      where: { organizationId: access.organization.id },
      data: {
        timezone: nextConfig.timezone,
        quietHoursStartMinute: nextConfig.quietHoursStartMinute,
        quietHoursEndMinute: nextConfig.quietHoursEndMinute,
        capPerDay: nextConfig.capPerDay,
        capPerWeek: nextConfig.capPerWeek,
        capPerMonth: nextConfig.capPerMonth,
        approvalEscalationHours: nextConfig.approvalEscalationHours,
        approvalExpireHours: nextConfig.approvalExpireHours,
      },
    });
    return respondOk(ctx, {
      config: policyToConfig(updated),
    });
  } catch {
    return respondError(
      ctx,
      {
        errorCode: "CRM_POLICY_UPDATE_FAILED",
        message: "Não foi possível atualizar a política de CRM.",
        retryable: true,
      },
      { status: 500 },
    );
  }
}

export const GET = withApiEnvelope(_GET);
export const PUT = withApiEnvelope(_PUT);
