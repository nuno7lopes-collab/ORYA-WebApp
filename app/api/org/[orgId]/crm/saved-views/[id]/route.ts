import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondOk } from "@/lib/http/envelope";
import { prisma } from "@/lib/prisma";
import { crmFail, resolveCrmRequest } from "@/app/api/org/[orgId]/crm/_shared";

function parseDefinition(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function parseIsDefault(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const token = value.trim().toLowerCase();
    if (token === "true") return true;
    if (token === "false") return false;
  }
  return null;
}

async function _PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const ctx = getRequestContext(req);
  const access = await resolveCrmRequest({ req, required: "EDIT", requireVerifiedEmailReason: "CRM_SEGMENTS" });
  if (!access.ok) return access.response;

  const { id } = await context.params;
  const existing = await prisma.crmSavedView.findFirst({
    where: {
      id,
      organizationId: access.organization.id,
      userId: access.user.id,
    },
    select: { id: true, scope: true },
  });
  if (!existing) {
    return crmFail(req, 404, "Vista não encontrada.");
  }

  const body = (await req.json().catch(() => null)) as {
    name?: unknown;
    definition?: unknown;
    isDefault?: unknown;
  } | null;

  const data: Prisma.CrmSavedViewUncheckedUpdateInput = {};
  if (typeof body?.name === "string") {
    const name = body.name.trim();
    if (name.length < 2 || name.length > 80) {
      return crmFail(req, 400, "Nome de vista inválido.");
    }
    data.name = name;
  }

  const definition = parseDefinition(body?.definition);
  if (definition) {
    data.definition = definition as Prisma.InputJsonValue;
  }

  const isDefault = parseIsDefault(body?.isDefault);
  if (isDefault !== null) {
    data.isDefault = isDefault;
  }

  try {
    const view = await prisma.$transaction(async (tx) => {
      if (isDefault === true) {
        await tx.crmSavedView.updateMany({
          where: {
            organizationId: access.organization.id,
            userId: access.user.id,
            scope: existing.scope,
            isDefault: true,
            id: { not: existing.id },
          },
          data: { isDefault: false },
        });
      }

      return tx.crmSavedView.update({
        where: { id: existing.id },
        data,
        select: {
          id: true,
          scope: true,
          name: true,
          definition: true,
          isDefault: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    });

    return respondOk(ctx, { view });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return crmFail(req, 409, "Já existe uma vista com este nome.");
    }
    throw err;
  }
}

async function _DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const ctx = getRequestContext(req);
  const access = await resolveCrmRequest({ req, required: "EDIT", requireVerifiedEmailReason: "CRM_SEGMENTS" });
  if (!access.ok) return access.response;

  const { id } = await context.params;
  const existing = await prisma.crmSavedView.findFirst({
    where: {
      id,
      organizationId: access.organization.id,
      userId: access.user.id,
    },
    select: { id: true },
  });
  if (!existing) {
    return crmFail(req, 404, "Vista não encontrada.");
  }

  await prisma.crmSavedView.delete({
    where: { id: existing.id },
  });

  return respondOk(ctx, { ok: true });
}

export const PATCH = withApiEnvelope(_PATCH);
export const DELETE = withApiEnvelope(_DELETE);
