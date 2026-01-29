import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { isStoreFeatureEnabled } from "@/lib/storeAccess";
import { z } from "zod";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";

const createItemSchema = z.object({
  productId: z.number().int().positive(),
  variantId: z.number().int().positive().optional().nullable(),
  quantity: z.number().int().positive().optional(),
});

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
async function _GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    const resolvedParams = await params;
    const bundleId = parseId(resolvedParams.id);
    if (!bundleId.ok) {
      return fail(400, bundleId.error);
    }

    const bundle = await ensureBundle(context.store.id, bundleId.id);
    if (!bundle.ok) {
      return fail(404, bundle.error);
    }

    const items = await prisma.storeBundleItem.findMany({
      where: { bundleId: bundleId.id },
      orderBy: [{ id: "asc" }],
      select: {
        id: true,
        productId: true,
        variantId: true,
        quantity: true,
        product: { select: { name: true } },
        variant: { select: { label: true } },
      },
    });

    return respondOk(ctx, { items });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail(401, "Nao autenticado.");
    }
    console.error("GET /api/me/store/bundles/[id]/items error:", err);
    return fail(500, "Erro ao carregar items.");
  }
}

async function _POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    const bundleId = parseId(resolvedParams.id);
    if (!bundleId.ok) {
      return fail(400, bundleId.error);
    }

    const bundle = await ensureBundle(context.store.id, bundleId.id);
    if (!bundle.ok) {
      return fail(404, bundle.error);
    }

    const body = await req.json().catch(() => null);
    const parsed = createItemSchema.safeParse(body);
    if (!parsed.success) {
      return fail(400, "Dados invalidos.");
    }

    const payload = parsed.data;
    const product = await prisma.storeProduct.findFirst({
      where: { id: payload.productId, storeId: context.store.id },
      select: { id: true },
    });
    if (!product) {
      return fail(400, "Produto invalido.");
    }

    if (payload.variantId) {
      const variant = await prisma.storeProductVariant.findFirst({
        where: { id: payload.variantId, productId: payload.productId },
        select: { id: true },
      });
      if (!variant) {
        return fail(400, "Variante invalida.");
      }
    }

    const created = await prisma.storeBundleItem.create({
      data: {
        bundleId: bundleId.id,
        productId: payload.productId,
        variantId: payload.variantId ?? null,
        quantity: payload.quantity ?? 1,
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

    return respondOk(ctx, { item: created }, { status: 201 });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail(401, "Nao autenticado.");
    }
    console.error("POST /api/me/store/bundles/[id]/items error:", err);
    return fail(500, "Erro ao criar item.");
  }
}
export const GET = withApiEnvelope(_GET);
export const POST = withApiEnvelope(_POST);