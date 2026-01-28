import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { isStoreFeatureEnabled } from "@/lib/storeAccess";
import { z } from "zod";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

const updateImageSchema = z
  .object({
    url: z.string().trim().min(1).max(500).optional(),
    altText: z.string().trim().max(140).optional().nullable(),
    sortOrder: z.number().int().nonnegative().optional(),
    isPrimary: z.boolean().optional(),
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

async function _PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; imageId: string }> },
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
    const productId = parseId(resolvedParams.id);
    if (!productId.ok) {
      return jsonWrap({ ok: false, error: productId.error }, { status: 400 });
    }

    const imageId = parseId(resolvedParams.imageId);
    if (!imageId.ok) {
      return jsonWrap({ ok: false, error: imageId.error }, { status: 400 });
    }

    const body = await req.json().catch(() => null);
    const parsed = updateImageSchema.safeParse(body);
    if (!parsed.success) {
      return jsonWrap({ ok: false, error: "Dados invalidos." }, { status: 400 });
    }

    const product = await prisma.storeProduct.findFirst({
      where: { id: productId.id, storeId: context.store.id },
      select: { id: true },
    });
    if (!product) {
      return jsonWrap({ ok: false, error: "Produto nao encontrado." }, { status: 404 });
    }

    const existing = await prisma.storeProductImage.findFirst({
      where: { id: imageId.id, productId: productId.id },
      select: { id: true },
    });
    if (!existing) {
      return jsonWrap({ ok: false, error: "Imagem nao encontrada." }, { status: 404 });
    }

    const payload = parsed.data;
    const data: {
      url?: string;
      altText?: string | null;
      sortOrder?: number;
      isPrimary?: boolean;
    } = {};

    if (payload.url) data.url = payload.url.trim();
    if (payload.altText !== undefined) data.altText = payload.altText ?? null;
    if (payload.sortOrder !== undefined) data.sortOrder = payload.sortOrder;
    if (payload.isPrimary !== undefined) data.isPrimary = payload.isPrimary;

    const updated = await prisma.$transaction(async (tx) => {
      if (payload.isPrimary) {
        await tx.storeProductImage.updateMany({
          where: { productId: productId.id },
          data: { isPrimary: false },
        });
      }

      return tx.storeProductImage.update({
        where: { id: imageId.id },
        data,
        select: {
          id: true,
          url: true,
          altText: true,
          sortOrder: true,
          isPrimary: true,
        },
      });
    });

    return jsonWrap({ ok: true, item: updated });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ ok: false, error: "Nao autenticado." }, { status: 401 });
    }
    console.error("PATCH /api/me/store/products/[id]/images/[imageId] error:", err);
    return jsonWrap({ ok: false, error: "Erro ao atualizar imagem." }, { status: 500 });
  }
}

async function _DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; imageId: string }> },
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
    const productId = parseId(resolvedParams.id);
    if (!productId.ok) {
      return jsonWrap({ ok: false, error: productId.error }, { status: 400 });
    }

    const imageId = parseId(resolvedParams.imageId);
    if (!imageId.ok) {
      return jsonWrap({ ok: false, error: imageId.error }, { status: 400 });
    }

    const product = await prisma.storeProduct.findFirst({
      where: { id: productId.id, storeId: context.store.id },
      select: { id: true },
    });
    if (!product) {
      return jsonWrap({ ok: false, error: "Produto nao encontrado." }, { status: 404 });
    }

    const existing = await prisma.storeProductImage.findFirst({
      where: { id: imageId.id, productId: productId.id },
      select: { id: true },
    });
    if (!existing) {
      return jsonWrap({ ok: false, error: "Imagem nao encontrada." }, { status: 404 });
    }

    await prisma.storeProductImage.delete({ where: { id: imageId.id } });

    return jsonWrap({ ok: true });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ ok: false, error: "Nao autenticado." }, { status: 401 });
    }
    console.error("DELETE /api/me/store/products/[id]/images/[imageId] error:", err);
    return jsonWrap({ ok: false, error: "Erro ao remover imagem." }, { status: 500 });
  }
}
export const PATCH = withApiEnvelope(_PATCH);
export const DELETE = withApiEnvelope(_DELETE);