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

const createItemSchema = z.object({
  productId: z.number().int().positive(),
  variantId: z.number().int().positive().optional().nullable(),
  quantity: z.number().int().positive().optional(),
});

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

async function _GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    const resolvedParams = await params;
    const bundleId = parseId(resolvedParams.id);
    if (!bundleId.ok) {
      return jsonWrap({ ok: false, error: bundleId.error }, { status: 400 });
    }

    const bundle = await ensureBundle(context.store.id, bundleId.id);
    if (!bundle.ok) {
      return jsonWrap({ ok: false, error: bundle.error }, { status: 404 });
    }

    const items = await prisma.storeBundleItem.findMany({
      where: { bundleId: bundleId.id },
      orderBy: [{ id: "asc" }],
      select: {
        id: true,
        productId: true,
        variantId: true,
        quantity: true,
        product: { select: { name: true, priceCents: true, currency: true } },
        variant: { select: { label: true, priceCents: true } },
      },
    });

    return jsonWrap({ ok: true, items });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ ok: false, error: "Nao autenticado." }, { status: 401 });
    }
    console.error("GET /api/organizacao/loja/bundles/[id]/items error:", err);
    return jsonWrap({ ok: false, error: "Erro ao carregar items." }, { status: 500 });
  }
}

async function _POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    const bundleId = parseId(resolvedParams.id);
    if (!bundleId.ok) {
      return jsonWrap({ ok: false, error: bundleId.error }, { status: 400 });
    }

    const bundle = await ensureBundle(context.store.id, bundleId.id);
    if (!bundle.ok) {
      return jsonWrap({ ok: false, error: bundle.error }, { status: 404 });
    }

    const body = await req.json().catch(() => null);
    const parsed = createItemSchema.safeParse(body);
    if (!parsed.success) {
      return jsonWrap({ ok: false, error: "Dados invalidos." }, { status: 400 });
    }

    const payload = parsed.data;
    const product = await prisma.storeProduct.findFirst({
      where: { id: payload.productId, storeId: context.store.id },
      select: { id: true },
    });
    if (!product) {
      return jsonWrap({ ok: false, error: "Produto invalido." }, { status: 400 });
    }

    if (payload.variantId) {
      const variant = await prisma.storeProductVariant.findFirst({
        where: { id: payload.variantId, productId: payload.productId },
        select: { id: true },
      });
      if (!variant) {
        return jsonWrap({ ok: false, error: "Variante invalida." }, { status: 400 });
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
        product: { select: { name: true, priceCents: true, currency: true } },
        variant: { select: { label: true, priceCents: true } },
      },
    });

    return jsonWrap({ ok: true, item: created }, { status: 201 });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ ok: false, error: "Nao autenticado." }, { status: 401 });
    }
    console.error("POST /api/organizacao/loja/bundles/[id]/items error:", err);
    return jsonWrap({ ok: false, error: "Erro ao criar item." }, { status: 500 });
  }
}
export const GET = withApiEnvelope(_GET);
export const POST = withApiEnvelope(_POST);