import { NextRequest } from "next/server";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondOk } from "@/lib/http/envelope";
import { prisma } from "@/lib/prisma";
import { crmFail, resolveCrmRequest } from "@/app/api/org/[orgId]/crm/_shared";
import {
  MAX_CRM_TAGS,
  canonicalizeCrmTagsForOrganization,
  resolveTagNamesFromIds,
} from "@/lib/crm/tags";

function parseStringArray(input: unknown) {
  if (!Array.isArray(input)) return [] as string[];
  return input.filter((value): value is string => typeof value === "string").map((value) => value.trim()).filter(Boolean);
}

async function _PUT(req: NextRequest, context: { params: Promise<{ customerId: string }> }) {
  const ctx = getRequestContext(req);
  const access = await resolveCrmRequest({
    req,
    required: "EDIT",
    requireVerifiedEmailReason: "CRM_CUSTOMER_TAGS",
  });
  if (!access.ok) return access.response;

  const payload = (await req.json().catch(() => null)) as {
    tags?: unknown;
    tagIds?: unknown;
  } | null;
  const { customerId } = await context.params;

  const tagsFromIds = await resolveTagNamesFromIds(
    prisma,
    access.organization.id,
    Array.from(new Set(parseStringArray(payload?.tagIds))),
  );
  const canonical = await canonicalizeCrmTagsForOrganization(
    prisma,
    access.organization.id,
    payload?.tags,
    MAX_CRM_TAGS,
  );
  const tags = Array.from(new Set([...tagsFromIds, ...canonical.tags])).slice(0, MAX_CRM_TAGS);

  const updated = await prisma.crmContact.updateMany({
    where: { id: customerId, organizationId: access.organization.id },
    data: { tags },
  });

  if (updated.count === 0) {
    return crmFail(req, 404, "Cliente não encontrado.");
  }

  return respondOk(ctx, {
    tags,
    tagDefinitions: canonical.tagDefinitions,
  });
}

export const PUT = withApiEnvelope(_PUT);
