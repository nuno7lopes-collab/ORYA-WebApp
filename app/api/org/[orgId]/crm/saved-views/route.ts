import { NextRequest } from "next/server";
import { CrmSavedViewScope, Prisma } from "@prisma/client";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondOk } from "@/lib/http/envelope";
import { prisma } from "@/lib/prisma";
import { crmFail, resolveCrmRequest } from "@/app/api/org/[orgId]/crm/_shared";

function normalizeScope(value: unknown): CrmSavedViewScope | null {
  if (typeof value !== "string") return null;
  const token = value.trim().toUpperCase();
  if (token === "CLIENTES") return CrmSavedViewScope.CUSTOMERS;
  if (token === "SEGMENTOS") return CrmSavedViewScope.SEGMENTS;
  return Object.values(CrmSavedViewScope).includes(token as CrmSavedViewScope)
    ? (token as CrmSavedViewScope)
    : null;
}

function parseDefinition(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
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

async function _GET(req: NextRequest) {
  const ctx = getRequestContext(req);
  const access = await resolveCrmRequest({ req, required: "VIEW" });
  if (!access.ok) return access.response;

  const scopeToken = req.nextUrl.searchParams.get("scope");
  const scope = scopeToken ? normalizeScope(scopeToken) : null;
  if (scopeToken && !scope) {
    return crmFail(req, 400, "Scope inválido.");
  }

  const items = await prisma.crmSavedView.findMany({
    where: {
      organizationId: access.organization.id,
      userId: access.user.id,
      ...(scope ? { scope } : {}),
    },
    orderBy: [{ updatedAt: "desc" }],
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

  return respondOk(ctx, { items });
}

async function _POST(req: NextRequest) {
  const ctx = getRequestContext(req);
  const access = await resolveCrmRequest({ req, required: "EDIT", requireVerifiedEmailReason: "CRM_SEGMENTS" });
  if (!access.ok) return access.response;

  const body = (await req.json().catch(() => null)) as {
    scope?: unknown;
    name?: unknown;
    definition?: unknown;
    isDefault?: unknown;
  } | null;

  const scope = normalizeScope(body?.scope);
  if (!scope) {
    return crmFail(req, 400, "Scope inválido.");
  }

  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (name.length < 2 || name.length > 80) {
    return crmFail(req, 400, "Nome de vista inválido.");
  }

  const definition = parseDefinition(body?.definition);
  const isDefault = parseIsDefault(body?.isDefault) ?? false;

  try {
    const view = await prisma.$transaction(async (tx) => {
      if (isDefault) {
        await tx.crmSavedView.updateMany({
          where: {
            organizationId: access.organization.id,
            userId: access.user.id,
            scope,
            isDefault: true,
          },
          data: { isDefault: false },
        });
      }

      return tx.crmSavedView.upsert({
        where: {
          organizationId_userId_scope_name: {
            organizationId: access.organization.id,
            userId: access.user.id,
            scope,
            name,
          },
        },
        create: {
          organizationId: access.organization.id,
          userId: access.user.id,
          scope,
          name,
          definition: definition as Prisma.InputJsonValue,
          isDefault,
        },
        update: {
          definition: definition as Prisma.InputJsonValue,
          isDefault,
        },
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

export const GET = withApiEnvelope(_GET);
export const POST = withApiEnvelope(_POST);
