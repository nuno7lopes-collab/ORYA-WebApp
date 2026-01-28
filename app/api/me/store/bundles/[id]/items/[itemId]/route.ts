import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { isStoreFeatureEnabled } from "@/lib/storeAccess";
import { z } from "zod";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

const updateItemSchema = z
  .object({
    productId: z.number().int().positive().optional(),
    variantId: z.number().int().positive().optional().nullable(),
    quantity: z.number().int().positive().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: "Sem dados." });

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

async function _PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  try {
    if (!isStoreFeatureEnabled()) {
      return jsonWrap({ ok: false, error: "Loja desativada." }, { status: 403 });
    }

    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const context = await getStoreContext(user.id);
    if (!context.ok) {
      return jsonWrap({ ok: false, error: context.error }, { status: 403 });
    }

    if (context.store.catalogLocked) {
      return jsonWrap({ ok: false, error: "Catalogo bloqueado." }, { status: 403 });
    }

    const resolvedParams = await params;
    const bundleId = parseId(resolvedParams.id);
    if (!bundleId.ok) {
      return jsonWrap({ ok: false, error: bundleId.error }, { status: 400 });
    }

    const itemId = parseId(resolvedParams.itemId);
    if (!itemId.ok) {
      return jsonWrap({ ok: false, error: itemId.error }, { status: 400 });
    }

    const bundle = await ensureBundle(context.store.id, bundleId.id);
    if (!bundle.ok) {
      return jsonWrap({ ok: false, error: bundle.error }, { status: 404 });
    }

    const body = await req.json().catch(() => null);
    const parsed = updateItemSchema.safeParse(body);
    if (!parsed.success) {
      return jsonWrap({ ok: false, error: "Dados invalidos." }, { status: 400 });
    }

    const existing = await prisma.storeBundleItem.findFirst({
      where: { id: itemId.id, bundleId: bundleId.id },
      select: { id: true, productId: true },
    });
    if (!existing) {
      return jsonWrap({ ok: false, error: "Item nao encontrado." }, { status: 404 });
    }

    const payload = parsed.data;
    const nextProductId = payload.productId ?? existing.productId;

    if (payload.productId) {
      const product = await prisma.storeProduct.findFirst({
        where: { id: payload.productId, storeId: context.store.id },
        select: { id: true },
      });
      if (!product) {
        return jsonWrap({ ok: false, error: "Produto invalido." }, { status: 400 });
      }
    }

    if (payload.variantId !== undefined) {
      if (payload.variantId) {
        const variant = await prisma.storeProductVariant.findFirst({
          where: { id: payload.variantId, productId: nextProductId },
          select: { id: true },
        });
        if (!variant) {
          return jsonWrap({ ok: false, error: "Variante invalida." }, { status: 400 });
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

    return jsonWrap({ ok: true, item: updated });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ ok: false, error: "Nao autenticado." }, { status: 401 });
    }
    console.error("PATCH /api/me/store/bundles/[id]/items/[itemId] error:", err);
    return jsonWrap({ ok: false, error: "Erro ao atualizar item." }, { status: 500 });
  }
}

async function _DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  try {
    if (!isStoreFeatureEnabled()) {
      return jsonWrap({ ok: false, error: "Loja desativada." }, { status: 403 });
    }

    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const context = await getStoreContext(user.id);
    if (!context.ok) {
      return jsonWrap({ ok: false, error: context.error }, { status: 403 });
    }

    if (context.store.catalogLocked) {
      return jsonWrap({ ok: false, error: "Catalogo bloqueado." }, { status: 403 });
    }

    const resolvedParams = await params;
    const bundleId = parseId(resolvedParams.id);
    if (!bundleId.ok) {
      return jsonWrap({ ok: false, error: bundleId.error }, { status: 400 });
    }

    const itemId = parseId(resolvedParams.itemId);
    if (!itemId.ok) {
      return jsonWrap({ ok: false, error: itemId.error }, { status: 400 });
    }

    const bundle = await ensureBundle(context.store.id, bundleId.id);
    if (!bundle.ok) {
      return jsonWrap({ ok: false, error: bundle.error }, { status: 404 });
    }

    const existing = await prisma.storeBundleItem.findFirst({
      where: { id: itemId.id, bundleId: bundleId.id },
      select: { id: true },
    });
    if (!existing) {
      return jsonWrap({ ok: false, error: "Item nao encontrado." }, { status: 404 });
    }

    await prisma.storeBundleItem.delete({ where: { id: itemId.id } });

    return jsonWrap({ ok: true });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ ok: false, error: "Nao autenticado." }, { status: 401 });
    }
    console.error("DELETE /api/me/store/bundles/[id]/items/[itemId] error:", err);
    return jsonWrap({ ok: false, error: "Erro ao remover item." }, { status: 500 });
  }
}
export const PATCH = withApiEnvelope(_PATCH);
export const DELETE = withApiEnvelope(_DELETE);