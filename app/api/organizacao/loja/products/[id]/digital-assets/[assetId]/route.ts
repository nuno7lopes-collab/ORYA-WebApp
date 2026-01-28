export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { env } from "@/lib/env";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { ensureLojaModuleAccess } from "@/lib/loja/access";
import { isStoreFeatureEnabled } from "@/lib/storeAccess";
import { OrganizationMemberRole } from "@prisma/client";
import { z } from "zod";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

const ROLE_ALLOWLIST: OrganizationMemberRole[] = [
  OrganizationMemberRole.OWNER,
  OrganizationMemberRole.CO_OWNER,
  OrganizationMemberRole.ADMIN,
  OrganizationMemberRole.STAFF,
];

const updateSchema = z
  .object({
    filename: z.string().trim().min(1).max(160).optional(),
    maxDownloads: z.number().int().positive().optional().nullable(),
    isActive: z.boolean().optional(),
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

    const context = await getOrganizationContext(req, user.id, { requireVerifiedEmail: req.method !== "GET" });
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
    console.error("PATCH /api/organizacao/loja/products/[id]/digital-assets/[assetId] error:", err);
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

    const context = await getOrganizationContext(req, user.id, { requireVerifiedEmail: req.method !== "GET" });
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
      console.warn("[DELETE /api/organizacao/loja/products/[id]/digital-assets/[assetId]] remove error", removal.error);
    }

    await prisma.storeDigitalAsset.delete({ where: { id: asset.id } });

    return jsonWrap({ ok: true });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ ok: false, error: "Nao autenticado." }, { status: 401 });
    }
    console.error("DELETE /api/organizacao/loja/products/[id]/digital-assets/[assetId] error:", err);
    return jsonWrap({ ok: false, error: "Erro ao remover ficheiro." }, { status: 500 });
  }
}
export const PATCH = withApiEnvelope(_PATCH);
export const DELETE = withApiEnvelope(_DELETE);