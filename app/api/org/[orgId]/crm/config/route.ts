import { NextRequest } from "next/server";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondOk } from "@/lib/http/envelope";
import { prisma } from "@/lib/prisma";
import { ensureCrmPolicy, normalizeCrmConfigInput, policyToConfig } from "@/lib/crm/policy";
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

  const body = (await req.json().catch(() => null)) as unknown;
  const current = await ensureCrmPolicy(prisma, access.organization.id, access.organization.timezone ?? undefined);
  const normalized = normalizeCrmConfigInput(body, policyToConfig(current));

  const updated = await prisma.crmOrganizationPolicy.update({
    where: { organizationId: access.organization.id },
    data: {
      timezone: normalized.timezone,
      quietHoursStartMinute: normalized.quietHoursStartMinute,
      quietHoursEndMinute: normalized.quietHoursEndMinute,
      capPerDay: normalized.capPerDay,
      capPerWeek: normalized.capPerWeek,
      capPerMonth: normalized.capPerMonth,
      approvalEscalationHours: normalized.approvalEscalationHours,
      approvalExpireHours: normalized.approvalExpireHours,
    },
    select: {
      timezone: true,
      quietHoursStartMinute: true,
      quietHoursEndMinute: true,
      capPerDay: true,
      capPerWeek: true,
      capPerMonth: true,
      approvalEscalationHours: true,
      approvalExpireHours: true,
    },
  });

  return respondOk(ctx, {
    config: policyToConfig(updated),
  });
}

export const GET = withApiEnvelope(_GET);
export const PUT = withApiEnvelope(_PUT);
