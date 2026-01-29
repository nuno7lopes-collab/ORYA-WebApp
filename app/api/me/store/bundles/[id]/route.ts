import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { isStoreFeatureEnabled } from "@/lib/storeAccess";
import { StoreBundlePricingMode, StoreBundleStatus } from "@prisma/client";
import { z } from "zod";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";

const updateBundleSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    slug: z.string().trim().min(1).max(120).optional(),
    description: z.string().trim().max(2000).optional().nullable(),
    pricingMode: z.nativeEnum(StoreBundlePricingMode).optional(),
    priceCents: z.number().int().nonnegative().optional().nullable(),
    percentOff: z.number().int().min(1).max(100).optional().nullable(),
    status: z.nativeEnum(StoreBundleStatus).optional(),
    isVisible: z.boolean().optional(),
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
    const bundleId = parseId(resolvedParams.id);
    if (!bundleId.ok) {
      return fail(400, bundleId.error);
    }

    const body = await req.json().catch(() => null);
    const parsed = updateBundleSchema.safeParse(body);
    if (!parsed.success) {
      return fail(400, "Dados invalidos.");
    }

    const existing = await prisma.storeBundle.findFirst({
      where: { id: bundleId.id, storeId: context.store.id },
    });
    if (!existing) {
      return fail(404, "Bundle nao encontrado.");
    }

    const payload = parsed.data;
    const data: {
      name?: string;
      slug?: string;
      description?: string | null;
      pricingMode?: StoreBundlePricingMode;
      priceCents?: number | null;
      percentOff?: number | null;
      status?: StoreBundleStatus;
      isVisible?: boolean;
    } = {};

    if (payload.name) data.name = payload.name.trim();
    if (payload.slug) {
      const slug = slugify(payload.slug.trim());
      if (!slug) {
        return fail(400, "Slug invalido.");
      }
      const existingSlug = await prisma.storeBundle.findFirst({
        where: { storeId: context.store.id, slug, id: { not: bundleId.id } },
        select: { id: true },
      });
      if (existingSlug) {
        return fail(409, "Slug ja existe.");
      }
      data.slug = slug;
    }
    if (payload.description !== undefined) data.description = payload.description ?? null;
    if (payload.pricingMode) data.pricingMode = payload.pricingMode;
    if (payload.priceCents !== undefined) data.priceCents = payload.priceCents ?? null;
    if (payload.percentOff !== undefined) data.percentOff = payload.percentOff ?? null;
    if (payload.status) data.status = payload.status;
    if (payload.isVisible !== undefined) data.isVisible = payload.isVisible;

    const nextPricingMode = data.pricingMode ?? existing.pricingMode;
    const nextPriceCents =
      data.priceCents !== undefined ? data.priceCents : existing.priceCents ?? null;
    const nextPercentOff =
      data.percentOff !== undefined ? data.percentOff : existing.percentOff ?? null;

    if (
      (nextPricingMode === StoreBundlePricingMode.FIXED && (nextPriceCents === null || nextPriceCents === undefined)) ||
      (nextPricingMode === StoreBundlePricingMode.PERCENT_DISCOUNT &&
        (nextPercentOff === null || nextPercentOff === undefined))
    ) {
      return fail(400, "Pricing invalido.");
    }

    if (nextPricingMode === StoreBundlePricingMode.FIXED) {
      data.percentOff = null;
    }
    if (nextPricingMode === StoreBundlePricingMode.PERCENT_DISCOUNT) {
      data.priceCents = null;
    }

    const updated = await prisma.storeBundle.update({
      where: { id: bundleId.id },
      data,
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        pricingMode: true,
        priceCents: true,
        percentOff: true,
        status: true,
        isVisible: true,
      },
    });

    return respondOk(ctx, { item: updated });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail(401, "Nao autenticado.");
    }
    console.error("PATCH /api/me/store/bundles/[id] error:", err);
    return fail(500, "Erro ao atualizar bundle.");
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
    const bundleId = parseId(resolvedParams.id);
    if (!bundleId.ok) {
      return fail(400, bundleId.error);
    }

    const existing = await prisma.storeBundle.findFirst({
      where: { id: bundleId.id, storeId: context.store.id },
      select: { id: true },
    });
    if (!existing) {
      return fail(404, "Bundle nao encontrado.");
    }

    await prisma.storeBundle.delete({ where: { id: bundleId.id } });

    return respondOk(ctx, {});
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail(401, "Nao autenticado.");
    }
    console.error("DELETE /api/me/store/bundles/[id] error:", err);
    return fail(500, "Erro ao remover bundle.");
  }
}
export const PATCH = withApiEnvelope(_PATCH);
export const DELETE = withApiEnvelope(_DELETE);