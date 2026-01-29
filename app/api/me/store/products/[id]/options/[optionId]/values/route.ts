import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { isStoreFeatureEnabled } from "@/lib/storeAccess";
import { z } from "zod";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";

const createValueSchema = z.object({
  value: z.string().trim().min(1, "Valor obrigatorio.").max(120),
  label: z.string().trim().max(120).optional().nullable(),
  priceDeltaCents: z.number().int().optional(),
  sortOrder: z.number().int().nonnegative().optional(),
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
async function _GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; optionId: string }> },
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

    const context = await getStoreContext(user.id);
    if (!context.ok) {
      return fail(403, context.error);
    }

    const resolvedParams = await params;
    const productId = parseId(resolvedParams.id);
    if (!productId.ok) {
      return fail(400, productId.error);
    }

    const optionId = parseId(resolvedParams.optionId);
    if (!optionId.ok) {
      return fail(400, optionId.error);
    }

    const product = await prisma.storeProduct.findFirst({
      where: { id: productId.id, storeId: context.store.id },
      select: { id: true },
    });
    if (!product) {
      return fail(404, "Produto nao encontrado.");
    }

    const option = await prisma.storeProductOption.findFirst({
      where: { id: optionId.id, productId: productId.id },
      select: { id: true },
    });
    if (!option) {
      return fail(404, "Opcao nao encontrada.");
    }

    const items = await prisma.storeProductOptionValue.findMany({
      where: { optionId: optionId.id },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        value: true,
        label: true,
        priceDeltaCents: true,
        sortOrder: true,
      },
    });

    return respondOk(ctx, { items });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail(401, "Nao autenticado.");
    }
    console.error("GET /api/me/store/products/[id]/options/[optionId]/values error:", err);
    return fail(500, "Erro ao carregar valores.");
  }
}

async function _POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; optionId: string }> },
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

    const context = await getStoreContext(user.id);
    if (!context.ok) {
      return fail(403, context.error);
    }

    if (context.store.catalogLocked) {
      return fail(403, "Catalogo bloqueado.");
    }

    const resolvedParams = await params;
    const productId = parseId(resolvedParams.id);
    if (!productId.ok) {
      return fail(400, productId.error);
    }

    const optionId = parseId(resolvedParams.optionId);
    if (!optionId.ok) {
      return fail(400, optionId.error);
    }

    const body = await req.json().catch(() => null);
    const parsed = createValueSchema.safeParse(body);
    if (!parsed.success) {
      return fail(400, "Dados invalidos.");
    }

    const product = await prisma.storeProduct.findFirst({
      where: { id: productId.id, storeId: context.store.id },
      select: { id: true },
    });
    if (!product) {
      return fail(404, "Produto nao encontrado.");
    }

    const option = await prisma.storeProductOption.findFirst({
      where: { id: optionId.id, productId: productId.id },
      select: { id: true },
    });
    if (!option) {
      return fail(404, "Opcao nao encontrada.");
    }

    const payload = parsed.data;
    const created = await prisma.storeProductOptionValue.create({
      data: {
        optionId: optionId.id,
        value: payload.value.trim(),
        label: payload.label ?? null,
        priceDeltaCents: payload.priceDeltaCents ?? 0,
        sortOrder: payload.sortOrder ?? 0,
      },
      select: {
        id: true,
        value: true,
        label: true,
        priceDeltaCents: true,
        sortOrder: true,
      },
    });

    return respondOk(ctx, { item: created }, { status: 201 });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail(401, "Nao autenticado.");
    }
    console.error("POST /api/me/store/products/[id]/options/[optionId]/values error:", err);
    return fail(500, "Erro ao criar valor.");
  }
}
export const GET = withApiEnvelope(_GET);
export const POST = withApiEnvelope(_POST);