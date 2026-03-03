import { NextRequest } from "next/server";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondOk } from "@/lib/http/envelope";
import { prisma } from "@/lib/prisma";
import { crmFail, resolveCrmRequest } from "@/app/api/org/[orgId]/crm/_shared";
import {
  ensureTagDefinitionsForNames,
  listCrmTagDefinitions,
  normalizeCrmTagColor,
  normalizeCrmTagName,
} from "@/lib/crm/tags";

async function _GET(req: NextRequest) {
  const ctx = getRequestContext(req);
  const access = await resolveCrmRequest({ req, required: "VIEW" });
  if (!access.ok) return access.response;

  const tags = await listCrmTagDefinitions(prisma, access.organization.id);
  return respondOk(ctx, { tags });
}

async function _POST(req: NextRequest) {
  const ctx = getRequestContext(req);
  const access = await resolveCrmRequest({
    req,
    required: "EDIT",
    requireVerifiedEmailReason: "CRM_TAGS_CREATE",
  });
  if (!access.ok) return access.response;

  const payload = (await req.json().catch(() => null)) as { name?: unknown; color?: unknown } | null;
  const name = normalizeCrmTagName(payload?.name);
  if (!name) {
    return crmFail(req, 422, "Nome de tag inválido.");
  }

  const [definition] = await ensureTagDefinitionsForNames(prisma, access.organization.id, [name]);
  if (!definition) {
    return crmFail(req, 500, "Não foi possível criar tag.");
  }

  const color = normalizeCrmTagColor(payload?.color);
  const tag = await prisma.crmTagDefinition.update({
    where: { id: definition.id },
    data: { color, isActive: true },
    select: {
      id: true,
      name: true,
      slug: true,
      color: true,
      isSystem: true,
      isActive: true,
      sortOrder: true,
    },
  });

  return respondOk(ctx, { tag }, { status: 201 });
}

export const GET = withApiEnvelope(_GET);
export const POST = withApiEnvelope(_POST);
