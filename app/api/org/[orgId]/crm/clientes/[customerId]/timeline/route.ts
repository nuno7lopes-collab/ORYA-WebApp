import { NextRequest } from "next/server";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondOk } from "@/lib/http/envelope";
import { prisma } from "@/lib/prisma";
import { crmFail, resolveCrmRequest } from "@/app/api/org/[orgId]/crm/_shared";
import { PADEL_ACTIVITY_INTERACTION_TYPES } from "@/lib/crm/padelProjection";

const MAX_LIMIT = 200;

function parseLimit(value: string | null) {
  if (!value) return 100;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 100;
  return Math.min(Math.trunc(parsed), MAX_LIMIT);
}

async function _GET(req: NextRequest, context: { params: Promise<{ customerId: string }> }) {
  const ctx = getRequestContext(req);
  const access = await resolveCrmRequest({ req, required: "VIEW" });
  if (!access.ok) return access.response;

  const { customerId } = await context.params;
  const domain = (req.nextUrl.searchParams.get("domain") ?? "all").trim().toLowerCase();
  const limit = parseLimit(req.nextUrl.searchParams.get("limit"));

  const contact = await prisma.crmContact.findFirst({
    where: { id: customerId, organizationId: access.organization.id },
    select: { id: true },
  });
  if (!contact) {
    return crmFail(req, 404, "Cliente não encontrado.");
  }

  const items = await prisma.crmInteraction.findMany({
    where: {
      organizationId: access.organization.id,
      contactId: customerId,
      ...(domain === "padel" ? { type: { in: [...PADEL_ACTIVITY_INTERACTION_TYPES] } } : {}),
    },
    orderBy: { occurredAt: "desc" },
    take: limit,
    select: {
      id: true,
      type: true,
      sourceType: true,
      sourceId: true,
      externalId: true,
      occurredAt: true,
      amountCents: true,
      currency: true,
      metadata: true,
      createdAt: true,
    },
  });

  return respondOk(ctx, {
    domain: domain === "padel" ? "padel" : "all",
    total: items.length,
    items,
  });
}

export const GET = withApiEnvelope(_GET);
