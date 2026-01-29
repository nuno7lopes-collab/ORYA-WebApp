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

const createProductSchema = z.object({
  name: z.string().trim().min(1, "Nome obrigatorio.").max(120),
  slug: z.string().trim().min(1).max(120).optional(),
  categoryId: z.number().int().positive().optional().nullable(),
  shortDescription: z.string().trim().max(180).optional().nullable(),
  description: z.string().trim().max(5000).optional().nullable(),
  priceCents: z.number().int().nonnegative(),
  compareAtPriceCents: z.number().int().nonnegative().optional().nullable(),
  currency: z.string().trim().min(1).max(6).optional(),
  sku: z.string().trim().max(60).optional().nullable(),
  requiresShipping: z.boolean().optional(),
  stockPolicy: z.nativeEnum(StoreStockPolicy).optional(),
  stockQty: z.number().int().nonnegative().optional().nullable(),
  status: z.nativeEnum(StoreProductStatus).optional(),
  isVisible: z.boolean().optional(),
  tags: z.array(z.string().trim().min(1).max(40)).optional(),
});

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
    select: { id: true, catalogLocked: true, currency: true },
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
async function _GET(req: NextRequest) {
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

    const items = await prisma.storeProduct.findMany({
      where: { storeId: context.store.id },
      orderBy: [{ createdAt: "desc" }],
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

    return respondOk(ctx, { items });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail(401, "Nao autenticado.");
    }
    console.error("GET /api/me/store/products error:", err);
    return fail(500, "Erro ao carregar produtos.");
  }
}

async function _POST(req: NextRequest) {
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

    const body = await req.json().catch(() => null);
    const parsed = createProductSchema.safeParse(body);
    if (!parsed.success) {
      return fail(400, "Dados invalidos.");
    }

    const payload = parsed.data;
    const name = payload.name.trim();
    const rawSlug = payload.slug?.trim();
    const slug = rawSlug ? slugify(rawSlug) : slugify(name);
    if (!slug) {
      return fail(400, "Slug invalido.");
    }

    if (payload.categoryId) {
      const category = await prisma.storeCategory.findFirst({
        where: { id: payload.categoryId, storeId: context.store.id },
        select: { id: true },
      });
      if (!category) {
        return fail(400, "Categoria invalida.");
      }
    }

    const created = await prisma.storeProduct.create({
      data: {
        storeId: context.store.id,
        categoryId: payload.categoryId ?? null,
        name,
        slug,
        shortDescription: payload.shortDescription ?? null,
        description: payload.description ?? null,
        priceCents: payload.priceCents,
        compareAtPriceCents: payload.compareAtPriceCents ?? null,
        currency: payload.currency?.toUpperCase() ?? context.store.currency,
        sku: payload.sku ?? null,
        requiresShipping: payload.requiresShipping ?? true,
        stockPolicy: payload.stockPolicy ?? StoreStockPolicy.NONE,
        stockQty: payload.stockQty ?? null,
        status: payload.status ?? StoreProductStatus.DRAFT,
        isVisible: payload.isVisible ?? false,
        tags: payload.tags ?? [],
      },
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

    return respondOk(ctx, { item: created }, { status: 201 });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail(401, "Nao autenticado.");
    }
    console.error("POST /api/me/store/products error:", err);
    return fail(500, "Erro ao criar produto.");
  }
}
export const GET = withApiEnvelope(_GET);
export const POST = withApiEnvelope(_POST);