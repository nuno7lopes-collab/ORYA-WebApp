export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { env } from "@/lib/env";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { isStoreFeatureEnabled } from "@/lib/storeAccess";
import { z } from "zod";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

const updateSchema = z
  .object({
    filename: z.string().trim().min(1).max(160).optional(),
    maxDownloads: z.number().int().positive().optional().nullable(),
    isActive: z.boolean().optional(),
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
  { params }: { params: Promise<{ id: string; assetId: string }> },
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

    const assetId = parseId(resolvedParams.assetId);
    if (!assetId.ok) {
      return jsonWrap({ ok: false, error: assetId.error }, { status: 400 });
    }

    const body = await req.json().catch(() => null);
    const parsed = updateSchema.safeParse(body);
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

    const asset = await prisma.storeDigitalAsset.findFirst({
      where: { id: assetId.id, productId: productId.id },
      select: { id: true },
    });
    if (!asset) {
      return jsonWrap({ ok: false, error: "Ficheiro nao encontrado." }, { status: 404 });
    }

    const payload = parsed.data;
    const updated = await prisma.storeDigitalAsset.update({
      where: { id: asset.id },
      data: {
        filename: payload.filename ? payload.filename.trim() : undefined,
        maxDownloads: payload.maxDownloads ?? undefined,
        isActive: payload.isActive ?? undefined,
      },
      select: {
        id: true,
        filename: true,
        sizeBytes: true,
        mimeType: true,
        maxDownloads: true,
        isActive: true,
        createdAt: true,
      },
    });

    return jsonWrap({ ok: true, item: updated });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ ok: false, error: "Nao autenticado." }, { status: 401 });
    }
    console.error("PATCH /api/me/store/products/[id]/digital-assets/[assetId] error:", err);
    return jsonWrap({ ok: false, error: "Erro ao atualizar ficheiro." }, { status: 500 });
  }
}

async function _DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; assetId: string }> },
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

    const assetId = parseId(resolvedParams.assetId);
    if (!assetId.ok) {
      return jsonWrap({ ok: false, error: assetId.error }, { status: 400 });
    }

    const product = await prisma.storeProduct.findFirst({
      where: { id: productId.id, storeId: context.store.id },
      select: { id: true },
    });
    if (!product) {
      return jsonWrap({ ok: false, error: "Produto nao encontrado." }, { status: 404 });
    }

    const asset = await prisma.storeDigitalAsset.findFirst({
      where: { id: assetId.id, productId: productId.id },
      select: { id: true, storagePath: true },
    });
    if (!asset) {
      return jsonWrap({ ok: false, error: "Ficheiro nao encontrado." }, { status: 404 });
    }

    const bucket = env.uploadsBucket || "uploads";
    const removal = await supabaseAdmin.storage.from(bucket).remove([asset.storagePath]);
    if (removal.error) {
      console.warn("[DELETE /api/me/store/products/[id]/digital-assets/[assetId]] remove error", removal.error);
    }

    await prisma.storeDigitalAsset.delete({ where: { id: asset.id } });

    return jsonWrap({ ok: true });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ ok: false, error: "Nao autenticado." }, { status: 401 });
    }
    console.error("DELETE /api/me/store/products/[id]/digital-assets/[assetId] error:", err);
    return jsonWrap({ ok: false, error: "Erro ao remover ficheiro." }, { status: 500 });
  }
}
export const PATCH = withApiEnvelope(_PATCH);
export const DELETE = withApiEnvelope(_DELETE);