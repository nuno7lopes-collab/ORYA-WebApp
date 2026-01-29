import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { ensureLojaModuleAccess } from "@/lib/loja/access";
import { isStoreFeatureEnabled } from "@/lib/storeAccess";
import { OrganizationMemberRole } from "@prisma/client";
import { z } from "zod";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";

const ROLE_ALLOWLIST: OrganizationMemberRole[] = [
  OrganizationMemberRole.OWNER,
  OrganizationMemberRole.CO_OWNER,
  OrganizationMemberRole.ADMIN,
  OrganizationMemberRole.STAFF,
];

const updateItemSchema = z
  .object({
    productId: z.number().int().positive().optional(),
    variantId: z.number().int().positive().optional().nullable(),
    quantity: z.number().int().positive().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: "Sem dados." });

async function getOrganizationContext(req: NextRequest, userId: string, options?: { requireVerifiedEmail?: boolean }) {
  const organizationId = resolveOrganizationIdFromRequest(req);
  const { organization, membership } = await getActiveOrganizationForUser(userId, {
    organizationId: organizationId ?? undefined,
    roles: [...ROLE_ALLOWLIST],
  });

  if (!organization || !membership) {
    return { ok: false as const, error: "Sem permissoes." };
  }

  const lojaAccess = await ensureLojaModuleAccess(organization, undefined, options);
  if (!lojaAccess.ok) {
    return { ok: false as const, error: lojaAccess.error };
  }

  const store = await prisma.store.findFirst({
    where: { ownerOrganizationId: organization.id },
    select: { id: true, catalogLocked: true },
  });

  if (!store) {
    return { ok: false as const, error: "Loja ainda nao criada." };
  }

  return { ok: true as const, organization, store };
}

function parseId(value: string) {
  const id = Number(value);
  if (!Number.isFinite(id)) {
    return { ok: false as const, error: "ID invalido." };
  }
  return { ok: true as const, id };
}

async function ensureBundle(storeId: number, bundleId: number) {
  const bundle = await prisma.storeBundle.findFirst({
    where: { id: bundleId, storeId },
    select: { id: true },
  });
  if (!bundle) {
    return { ok: false as const, error: "Bundle nao encontrado." };
  }
  return { ok: true as const, bundle };
}

function errorCodeForStatus(status: number) {
  if (status === 401) return "UNAUTHENTICATED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 409) return "CONFLICT";
  if (status === 410) return "GONE";
  if (status === 413) return "PAYLOAD_TOO_LARGE";
  if (status === 422) return "VALIDATION_FAILED";
  if (status === 400) return "BAD_REQUEST";
  return "INTERNAL_ERROR";
}
async function _PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  const ctx = getRequestContext(req);
  const fail = (
    status: number,
    message: string,
    errorCode = errorCodeForStatus(status),
    retryable = status >= 500,
  ) => {
    const resolvedMessage = typeof message === "string" ? message : String(message);
    const resolvedCode = /^[A-Z0-9_]+$/.test(resolvedMessage) ? resolvedMessage : errorCode;
    return respondError(ctx, { errorCode: resolvedCode, message: resolvedMessage, retryable }, { status });
  };
  try {
    if (!isStoreFeatureEnabled()) {
      return fail(403, "Loja desativada.");
    }

    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const context = await getOrganizationContext(req, user.id, { requireVerifiedEmail: req.method !== "GET" });
    if (!context.ok) {
      return fail(403, context.error);
    }

    if (context.store.catalogLocked) {
      return fail(403, "Catalogo bloqueado.");
    }

    const resolvedParams = await params;
    const bundleId = parseId(resolvedParams.id);
    if (!bundleId.ok) {
      return fail(400, bundleId.error);
    }

    const itemId = parseId(resolvedParams.itemId);
    if (!itemId.ok) {
      return fail(400, itemId.error);
    }

    const bundle = await ensureBundle(context.store.id, bundleId.id);
    if (!bundle.ok) {
      return fail(404, bundle.error);
    }

    const body = await req.json().catch(() => null);
    const parsed = updateItemSchema.safeParse(body);
    if (!parsed.success) {
      return fail(400, "Dados invalidos.");
    }

    const existing = await prisma.storeBundleItem.findFirst({
      where: { id: itemId.id, bundleId: bundleId.id },
      select: { id: true, productId: true },
    });
    if (!existing) {
      return fail(404, "Item nao encontrado.");
    }

    const payload = parsed.data;
    const nextProductId = payload.productId ?? existing.productId;

    if (payload.productId) {
      const product = await prisma.storeProduct.findFirst({
        where: { id: payload.productId, storeId: context.store.id },
        select: { id: true },
      });
      if (!product) {
        return fail(400, "Produto invalido.");
      }
    }

    if (payload.variantId !== undefined) {
      if (payload.variantId) {
        const variant = await prisma.storeProductVariant.findFirst({
          where: { id: payload.variantId, productId: nextProductId },
          select: { id: true },
        });
        if (!variant) {
          return fail(400, "Variante invalida.");
        }
      }
    }

    const updated = await prisma.storeBundleItem.update({
      where: { id: itemId.id },
      data: {
        productId: payload.productId ?? existing.productId,
        variantId: payload.variantId !== undefined ? payload.variantId : undefined,
        quantity: payload.quantity ?? undefined,
      },
      select: {
        id: true,
        productId: true,
        variantId: true,
        quantity: true,
        product: { select: { name: true } },
        variant: { select: { label: true } },
      },
    });

    return respondOk(ctx, {item: updated });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail(401, "Nao autenticado.");
    }
    console.error("PATCH /api/organizacao/loja/bundles/[id]/items/[itemId] error:", err);
    return fail(500, "Erro ao atualizar item.");
  }
}

async function _DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  const ctx = getRequestContext(req);
  const fail = (
    status: number,
    message: string,
    errorCode = errorCodeForStatus(status),
    retryable = status >= 500,
  ) => {
    const resolvedMessage = typeof message === "string" ? message : String(message);
    const resolvedCode = /^[A-Z0-9_]+$/.test(resolvedMessage) ? resolvedMessage : errorCode;
    return respondError(ctx, { errorCode: resolvedCode, message: resolvedMessage, retryable }, { status });
  };
  try {
    if (!isStoreFeatureEnabled()) {
      return fail(403, "Loja desativada.");
    }

    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const context = await getOrganizationContext(req, user.id, { requireVerifiedEmail: req.method !== "GET" });
    if (!context.ok) {
      return fail(403, context.error);
    }

    if (context.store.catalogLocked) {
      return fail(403, "Catalogo bloqueado.");
    }

    const resolvedParams = await params;
    const bundleId = parseId(resolvedParams.id);
    if (!bundleId.ok) {
      return fail(400, bundleId.error);
    }

    const itemId = parseId(resolvedParams.itemId);
    if (!itemId.ok) {
      return fail(400, itemId.error);
    }

    const bundle = await ensureBundle(context.store.id, bundleId.id);
    if (!bundle.ok) {
      return fail(404, bundle.error);
    }

    const existing = await prisma.storeBundleItem.findFirst({
      where: { id: itemId.id, bundleId: bundleId.id },
      select: { id: true },
    });
    if (!existing) {
      return fail(404, "Item nao encontrado.");
    }

    await prisma.storeBundleItem.delete({ where: { id: itemId.id } });

    return respondOk(ctx, {});
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail(401, "Nao autenticado.");
    }
    console.error("DELETE /api/organizacao/loja/bundles/[id]/items/[itemId] error:", err);
    return fail(500, "Erro ao remover item.");
  }
}
export const PATCH = withApiEnvelope(_PATCH);
export const DELETE = withApiEnvelope(_DELETE);