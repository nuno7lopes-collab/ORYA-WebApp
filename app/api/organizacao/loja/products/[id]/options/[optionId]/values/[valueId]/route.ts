import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
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

const ROLE_ALLOWLIST: OrganizationMemberRole[] = [
  OrganizationMemberRole.OWNER,
  OrganizationMemberRole.CO_OWNER,
  OrganizationMemberRole.ADMIN,
  OrganizationMemberRole.STAFF,
];

const updateValueSchema = z
  .object({
    value: z.string().trim().min(1).max(120).optional(),
    label: z.string().trim().max(120).optional().nullable(),
    priceDeltaCents: z.number().int().optional(),
    sortOrder: z.number().int().nonnegative().optional(),
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
  { params }: { params: Promise<{ id: string; optionId: string; valueId: string }> },
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

    const optionId = parseId(resolvedParams.optionId);
    if (!optionId.ok) {
      return jsonWrap({ ok: false, error: optionId.error }, { status: 400 });
    }

    const valueId = parseId(resolvedParams.valueId);
    if (!valueId.ok) {
      return jsonWrap({ ok: false, error: valueId.error }, { status: 400 });
    }

    const body = await req.json().catch(() => null);
    const parsed = updateValueSchema.safeParse(body);
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

    const option = await prisma.storeProductOption.findFirst({
      where: { id: optionId.id, productId: productId.id },
      select: { id: true },
    });
    if (!option) {
      return jsonWrap({ ok: false, error: "Opcao nao encontrada." }, { status: 404 });
    }

    const existing = await prisma.storeProductOptionValue.findFirst({
      where: { id: valueId.id, optionId: optionId.id },
      select: { id: true },
    });
    if (!existing) {
      return jsonWrap({ ok: false, error: "Valor nao encontrado." }, { status: 404 });
    }

    const payload = parsed.data;
    const data: {
      value?: string;
      label?: string | null;
      priceDeltaCents?: number;
      sortOrder?: number;
    } = {};

    if (payload.value) data.value = payload.value.trim();
    if (payload.label !== undefined) data.label = payload.label ?? null;
    if (payload.priceDeltaCents !== undefined) data.priceDeltaCents = payload.priceDeltaCents;
    if (payload.sortOrder !== undefined) data.sortOrder = payload.sortOrder;

    const updated = await prisma.storeProductOptionValue.update({
      where: { id: valueId.id },
      data,
      select: {
        id: true,
        value: true,
        label: true,
        priceDeltaCents: true,
        sortOrder: true,
      },
    });

    return jsonWrap({ ok: true, item: updated });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ ok: false, error: "Nao autenticado." }, { status: 401 });
    }
    console.error(
      "PATCH /api/organizacao/loja/products/[id]/options/[optionId]/values/[valueId] error:",
      err,
    );
    return jsonWrap({ ok: false, error: "Erro ao atualizar valor." }, { status: 500 });
  }
}

async function _DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; optionId: string; valueId: string }> },
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

    const optionId = parseId(resolvedParams.optionId);
    if (!optionId.ok) {
      return jsonWrap({ ok: false, error: optionId.error }, { status: 400 });
    }

    const valueId = parseId(resolvedParams.valueId);
    if (!valueId.ok) {
      return jsonWrap({ ok: false, error: valueId.error }, { status: 400 });
    }

    const product = await prisma.storeProduct.findFirst({
      where: { id: productId.id, storeId: context.store.id },
      select: { id: true },
    });
    if (!product) {
      return jsonWrap({ ok: false, error: "Produto nao encontrado." }, { status: 404 });
    }

    const option = await prisma.storeProductOption.findFirst({
      where: { id: optionId.id, productId: productId.id },
      select: { id: true },
    });
    if (!option) {
      return jsonWrap({ ok: false, error: "Opcao nao encontrada." }, { status: 404 });
    }

    const existing = await prisma.storeProductOptionValue.findFirst({
      where: { id: valueId.id, optionId: optionId.id },
      select: { id: true },
    });
    if (!existing) {
      return jsonWrap({ ok: false, error: "Valor nao encontrado." }, { status: 404 });
    }

    await prisma.storeProductOptionValue.delete({ where: { id: valueId.id } });

    return jsonWrap({ ok: true });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ ok: false, error: "Nao autenticado." }, { status: 401 });
    }
    console.error(
      "DELETE /api/organizacao/loja/products/[id]/options/[optionId]/values/[valueId] error:",
      err,
    );
    return jsonWrap({ ok: false, error: "Erro ao remover valor." }, { status: 500 });
  }
}
export const PATCH = withApiEnvelope(_PATCH);
export const DELETE = withApiEnvelope(_DELETE);