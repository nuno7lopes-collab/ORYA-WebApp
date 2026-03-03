import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondOk } from "@/lib/http/envelope";
import { prisma } from "@/lib/prisma";
import { crmFail, resolveCrmRequest } from "@/app/api/org/[orgId]/crm/_shared";
import {
  normalizeCrmTagColor,
  normalizeCrmTagName,
  removeCrmTagNameFromContacts,
  replaceCrmTagNameInContacts,
  slugifyCrmTagName,
} from "@/lib/crm/tags";

async function _PATCH(req: NextRequest, context: { params: Promise<{ tagId: string }> }) {
  const ctx = getRequestContext(req);
  const access = await resolveCrmRequest({
    req,
    required: "EDIT",
    requireVerifiedEmailReason: "CRM_TAGS_UPDATE",
  });
  if (!access.ok) return access.response;

  const { tagId } = await context.params;
  const existing = await prisma.crmTagDefinition.findFirst({
    where: { id: tagId, organizationId: access.organization.id, isActive: true },
    select: {
      id: true,
      name: true,
      color: true,
      slug: true,
      isSystem: true,
      isActive: true,
      sortOrder: true,
    },
  });
  if (!existing) {
    return crmFail(req, 404, "Tag não encontrada.");
  }

  const payload = (await req.json().catch(() => null)) as {
    name?: unknown;
    color?: unknown;
  } | null;

  const nextName = payload?.name !== undefined ? normalizeCrmTagName(payload.name) : existing.name;
  if (!nextName) {
    return crmFail(req, 422, "Nome de tag inválido.");
  }
  const nextColor = payload?.color !== undefined ? normalizeCrmTagColor(payload.color) : existing.color;
  const nextSlug = slugifyCrmTagName(nextName);
  const nameChanged = nextName !== existing.name;

  try {
    const tag = await prisma.crmTagDefinition.update({
      where: { id: existing.id },
      data: {
        name: nextName,
        slug: nextSlug,
        color: nextColor,
      },
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

    let updatedContacts = 0;
    if (nameChanged) {
      updatedContacts = await replaceCrmTagNameInContacts(
        prisma,
        access.organization.id,
        existing.name,
        nextName,
      );
    }

    return respondOk(ctx, {
      tag,
      updatedContacts,
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return crmFail(req, 409, "Já existe uma tag com este nome.");
    }
    console.error("PATCH /api/org/[orgId]/crm/tags/[tagId] error:", err);
    return crmFail(req, 500, "Erro ao atualizar tag.");
  }
}

async function _DELETE(req: NextRequest, context: { params: Promise<{ tagId: string }> }) {
  const ctx = getRequestContext(req);
  const access = await resolveCrmRequest({
    req,
    required: "EDIT",
    requireVerifiedEmailReason: "CRM_TAGS_ARCHIVE",
  });
  if (!access.ok) return access.response;

  const { tagId } = await context.params;
  const existing = await prisma.crmTagDefinition.findFirst({
    where: { id: tagId, organizationId: access.organization.id, isActive: true },
    select: {
      id: true,
      name: true,
      isSystem: true,
    },
  });
  if (!existing) {
    return crmFail(req, 404, "Tag não encontrada.");
  }
  if (existing.isSystem) {
    return crmFail(req, 409, "Tags de sistema não podem ser arquivadas.");
  }

  try {
    const [updatedContacts] = await Promise.all([
      removeCrmTagNameFromContacts(prisma, access.organization.id, existing.name),
      prisma.crmTagDefinition.update({
        where: { id: existing.id },
        data: { isActive: false },
      }),
    ]);

    return respondOk(ctx, {
      archived: true,
      updatedContacts,
    });
  } catch (err) {
    console.error("DELETE /api/org/[orgId]/crm/tags/[tagId] error:", err);
    return crmFail(req, 500, "Erro ao arquivar tag.");
  }
}

export const PATCH = withApiEnvelope(_PATCH);
export const DELETE = withApiEnvelope(_DELETE);
