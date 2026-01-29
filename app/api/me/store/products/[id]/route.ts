import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { isStoreFeatureEnabled } from "@/lib/storeAccess";
import { StoreProductStatus, StoreStockPolicy } from "@prisma/client";
import { z } from "zod";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";

const updateProductSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    slug: z.string().trim().min(1).max(120).optional(),
    categoryId: z.number().int().positive().optional().nullable(),
    shortDescription: z.string().trim().max(180).optional().nullable(),
    description: z.string().trim().max(5000).optional().nullable(),
    priceCents: z.number().int().nonnegative().optional(),
    compareAtPriceCents: z.number().int().nonnegative().optional().nullable(),
    currency: z.string().trim().min(1).max(6).optional(),
    sku: z.string().trim().max(60).optional().nullable(),
    requiresShipping: z.boolean().optional(),
    stockPolicy: z.nativeEnum(StoreStockPolicy).optional(),
    stockQty: z.number().int().nonnegative().optional().nullable(),
    status: z.nativeEnum(StoreProductStatus).optional(),
    isVisible: z.boolean().optional(),
    tags: z.array(z.string().trim().min(1).max(40)).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: "Sem dados." });

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function getStoreContext(userId: string) {
  const store = await prisma.store.findFirst({
    where: { ownerUserId: userId },
    select: { id: true, catalogLocked: true },
  });

  if (!store) {
    return { ok: false as const, error: "Loja ainda nao criada." };
  }

  return { ok: true as const, store };
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
async function _PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    const context = await getStoreContext(user.id);
    if (!context.ok) {
      return fail(403, context.error);
    }

    if (context.store.catalogLocked) {
      return fail(403, "Catalogo bloqueado.");
    }

    const resolvedParams = await params;
    const productId = Number(resolvedParams.id);
    if (!Number.isFinite(productId)) {
      return fail(400, "ID invalido.");
    }

    const body = await req.json().catch(() => null);
    const parsed = updateProductSchema.safeParse(body);
    if (!parsed.success) {
      return fail(400, "Dados invalidos.");
    }

    const payload = parsed.data;
    const data: {
      name?: string;
      slug?: string;
      categoryId?: number | null;
      shortDescription?: string | null;
      description?: string | null;
      priceCents?: number;
      compareAtPriceCents?: number | null;
      currency?: string;
      sku?: string | null;
      requiresShipping?: boolean;
      stockPolicy?: StoreStockPolicy;
      stockQty?: number | null;
      status?: StoreProductStatus;
      isVisible?: boolean;
      tags?: string[];
    } = {};

    if (payload.name) data.name = payload.name.trim();
    if (payload.slug) {
      const slug = slugify(payload.slug.trim());
      if (!slug) {
        return fail(400, "Slug invalido.");
      }
      data.slug = slug;
    }
    if (payload.categoryId !== undefined) data.categoryId = payload.categoryId ?? null;
    if (payload.shortDescription !== undefined) data.shortDescription = payload.shortDescription ?? null;
    if (payload.description !== undefined) data.description = payload.description ?? null;
    if (payload.priceCents !== undefined) data.priceCents = payload.priceCents;
    if (payload.compareAtPriceCents !== undefined) data.compareAtPriceCents = payload.compareAtPriceCents ?? null;
    if (payload.currency) data.currency = payload.currency.toUpperCase();
    if (payload.sku !== undefined) data.sku = payload.sku ?? null;
    if (payload.requiresShipping !== undefined) data.requiresShipping = payload.requiresShipping;
    if (payload.stockPolicy !== undefined) data.stockPolicy = payload.stockPolicy;
    if (payload.stockQty !== undefined) data.stockQty = payload.stockQty ?? null;
    if (payload.status !== undefined) data.status = payload.status;
    if (payload.isVisible !== undefined) data.isVisible = payload.isVisible;
    if (payload.tags) data.tags = payload.tags;

    if (data.categoryId) {
      const category = await prisma.storeCategory.findFirst({
        where: { id: data.categoryId, storeId: context.store.id },
        select: { id: true },
      });
      if (!category) {
        return fail(400, "Categoria invalida.");
      }
    }

    const existing = await prisma.storeProduct.findFirst({
      where: { id: productId, storeId: context.store.id },
    });
    if (!existing) {
      return fail(404, "Produto nao encontrado.");
    }

    const updated = await prisma.storeProduct.update({
      where: { id: productId },
      data,
      select: {
        id: true,
        name: true,
        slug: true,
        shortDescription: true,
        description: true,
        priceCents: true,
        compareAtPriceCents: true,
        currency: true,
        sku: true,
        status: true,
        isVisible: true,
        categoryId: true,
        requiresShipping: true,
        stockPolicy: true,
        stockQty: true,
      },
    });

    return respondOk(ctx, { item: updated });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail(401, "Nao autenticado.");
    }
    console.error("PATCH /api/me/store/products/[id] error:", err);
    return fail(500, "Erro ao atualizar produto.");
  }
}

async function _DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    const context = await getStoreContext(user.id);
    if (!context.ok) {
      return fail(403, context.error);
    }

    if (context.store.catalogLocked) {
      return fail(403, "Catalogo bloqueado.");
    }

    const resolvedParams = await params;
    const productId = Number(resolvedParams.id);
    if (!Number.isFinite(productId)) {
      return fail(400, "ID invalido.");
    }

    const existing = await prisma.storeProduct.findFirst({
      where: { id: productId, storeId: context.store.id },
    });
    if (!existing) {
      return fail(404, "Produto nao encontrado.");
    }

    await prisma.storeProduct.delete({ where: { id: productId } });

    return respondOk(ctx, {});
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail(401, "Nao autenticado.");
    }
    console.error("DELETE /api/me/store/products/[id] error:", err);
    return fail(500, "Erro ao remover produto.");
  }
}
export const PATCH = withApiEnvelope(_PATCH);
export const DELETE = withApiEnvelope(_DELETE);