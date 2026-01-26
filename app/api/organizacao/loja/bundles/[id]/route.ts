import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { ensureLojaModuleAccess } from "@/lib/loja/access";
import { isStoreFeatureEnabled } from "@/lib/storeAccess";
import { OrganizationMemberRole, StoreBundlePricingMode, StoreBundleStatus } from "@prisma/client";
import { z } from "zod";
import { computeBundleTotals } from "@/lib/store/bundles";

const ROLE_ALLOWLIST: OrganizationMemberRole[] = [
  OrganizationMemberRole.OWNER,
  OrganizationMemberRole.CO_OWNER,
  OrganizationMemberRole.ADMIN,
  OrganizationMemberRole.STAFF,
];

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

async function loadBundlePricing(storeId: number, bundleId: number) {
  const items = await prisma.storeBundleItem.findMany({
    where: { bundleId },
    select: {
      quantity: true,
      product: { select: { priceCents: true, storeId: true } },
      variant: { select: { priceCents: true } },
    },
  });
  const validItems = items.filter((item) => item.product.storeId === storeId);
  const baseCents = validItems.reduce((sum, item) => {
    const unitPrice = item.variant?.priceCents ?? item.product.priceCents;
    return sum + unitPrice * item.quantity;
  }, 0);
  return { itemCount: validItems.length, baseCents };
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!isStoreFeatureEnabled()) {
      return NextResponse.json({ ok: false, error: "Loja desativada." }, { status: 403 });
    }

    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const context = await getOrganizationContext(req, user.id, { requireVerifiedEmail: req.method !== "GET" });
    if (!context.ok) {
      return NextResponse.json({ ok: false, error: context.error }, { status: 403 });
    }

    if (context.store.catalogLocked) {
      return NextResponse.json({ ok: false, error: "Catalogo bloqueado." }, { status: 403 });
    }

    const resolvedParams = await params;
    const bundleId = parseId(resolvedParams.id);
    if (!bundleId.ok) {
      return NextResponse.json({ ok: false, error: bundleId.error }, { status: 400 });
    }

    const body = await req.json().catch(() => null);
    const parsed = updateBundleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Dados invalidos." }, { status: 400 });
    }

    const existing = await prisma.storeBundle.findFirst({
      where: { id: bundleId.id, storeId: context.store.id },
    });
    if (!existing) {
      return NextResponse.json({ ok: false, error: "Bundle nao encontrado." }, { status: 404 });
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
        return NextResponse.json({ ok: false, error: "Slug invalido." }, { status: 400 });
      }
      const existingSlug = await prisma.storeBundle.findFirst({
        where: { storeId: context.store.id, slug, id: { not: bundleId.id } },
        select: { id: true },
      });
      if (existingSlug) {
        return NextResponse.json({ ok: false, error: "Slug ja existe." }, { status: 409 });
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
      return NextResponse.json({ ok: false, error: "Pricing invalido." }, { status: 400 });
    }

    if (nextPricingMode === StoreBundlePricingMode.FIXED) {
      data.percentOff = null;
    }
    if (nextPricingMode === StoreBundlePricingMode.PERCENT_DISCOUNT) {
      data.priceCents = null;
    }

    const nextStatus = data.status ?? existing.status;
    const nextVisible = data.isVisible ?? existing.isVisible;
    const pricingSnapshot = await loadBundlePricing(context.store.id, bundleId.id);
    if ((nextStatus === StoreBundleStatus.ACTIVE || nextVisible) && pricingSnapshot.itemCount < 2) {
      return NextResponse.json(
        {
          ok: false,
          error: "Adiciona pelo menos 2 produtos ao bundle antes de ativar ou mostrar na loja.",
        },
        { status: 409 },
      );
    }
    if (pricingSnapshot.itemCount >= 2) {
      const totals = computeBundleTotals({
        pricingMode: nextPricingMode,
        priceCents: nextPriceCents,
        percentOff: nextPercentOff,
        baseCents: pricingSnapshot.baseCents,
      });
      if (pricingSnapshot.baseCents <= 0 || totals.totalCents >= pricingSnapshot.baseCents) {
        return NextResponse.json(
          { ok: false, error: "O preco do bundle tem de ser inferior ao total dos itens." },
          { status: 409 },
        );
      }
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

    return NextResponse.json({ ok: true, item: updated });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "Nao autenticado." }, { status: 401 });
    }
    console.error("PATCH /api/organizacao/loja/bundles/[id] error:", err);
    return NextResponse.json({ ok: false, error: "Erro ao atualizar bundle." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!isStoreFeatureEnabled()) {
      return NextResponse.json({ ok: false, error: "Loja desativada." }, { status: 403 });
    }

    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const context = await getOrganizationContext(req, user.id, { requireVerifiedEmail: req.method !== "GET" });
    if (!context.ok) {
      return NextResponse.json({ ok: false, error: context.error }, { status: 403 });
    }

    if (context.store.catalogLocked) {
      return NextResponse.json({ ok: false, error: "Catalogo bloqueado." }, { status: 403 });
    }

    const resolvedParams = await params;
    const bundleId = parseId(resolvedParams.id);
    if (!bundleId.ok) {
      return NextResponse.json({ ok: false, error: bundleId.error }, { status: 400 });
    }

    const existing = await prisma.storeBundle.findFirst({
      where: { id: bundleId.id, storeId: context.store.id },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ ok: false, error: "Bundle nao encontrado." }, { status: 404 });
    }

    await prisma.storeBundle.delete({ where: { id: bundleId.id } });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "Nao autenticado." }, { status: 401 });
    }
    console.error("DELETE /api/organizacao/loja/bundles/[id] error:", err);
    return NextResponse.json({ ok: false, error: "Erro ao remover bundle." }, { status: 500 });
  }
}
