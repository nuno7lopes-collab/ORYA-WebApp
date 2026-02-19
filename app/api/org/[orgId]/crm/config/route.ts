import { NextRequest } from "next/server";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { prisma } from "@/lib/prisma";
import { ensureCrmPolicy, policyToConfig } from "@/lib/crm/policy";
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

  return respondError(
    ctx,
    {
      errorCode: "CRM_POLICY_LOCKED",
      message: "A política de CRM é gerida pela plataforma e não pode ser alterada pela organização.",
      retryable: false,
    },
    { status: 403 },
  );
}

export const GET = withApiEnvelope(_GET);
export const PUT = withApiEnvelope(_PUT);
