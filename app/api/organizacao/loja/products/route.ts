import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { ensureLojaModuleAccess } from "@/lib/loja/access";
import { isStoreFeatureEnabled } from "@/lib/storeAccess";
import { OrganizationMemberRole, StoreProductStatus, StoreStockPolicy } from "@prisma/client";
import { z } from "zod";

const ALLOWED_ROLES: OrganizationMemberRole[] = [
  OrganizationMemberRole.OWNER,
  OrganizationMemberRole.CO_OWNER,
  OrganizationMemberRole.ADMIN,
  OrganizationMemberRole.STAFF,
];

const createProductSchema = z.object({
  name: z.string().trim().min(1, "Nome obrigatorio.").max(120),
  slug: z.string().trim().min(1).max(120).optional(),
  categoryId: z.number().int().positive().optional().nullable(),
  shortDescription: z.string().trim().max(180).optional().nullable(),
  description: z.string().trim().max(5000).optional().nullable(),
  priceCents: z.number().int().nonnegative(),
  compareAtPriceCents: z.number().int().nonnegative().optional().nullable(),
  currency: z.string().trim().min(1).max(6).optional(),
  sku: z.string().trim().max(60).optional().nullable(),
  requiresShipping: z.boolean().optional(),
  stockPolicy: z.nativeEnum(StoreStockPolicy).optional(),
  stockQty: z.number().int().nonnegative().optional().nullable(),
  status: z.nativeEnum(StoreProductStatus).optional(),
  isVisible: z.boolean().optional(),
  tags: z.array(z.string().trim().min(1).max(40)).optional(),
});

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
    roles: [...ALLOWED_ROLES],
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
    select: { id: true, catalogLocked: true, currency: true },
  });

  if (!store) {
    return { ok: false as const, error: "Loja ainda nao criada." };
  }

  return { ok: true as const, organization, store };
}

export async function GET(req: NextRequest) {
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

    const items = await prisma.storeProduct.findMany({
      where: { storeId: context.store.id },
      orderBy: [{ createdAt: "desc" }],
      select: {
        id: true,
        name: true,
        slug: true,
        shortDescription: true,
        description: true,
        priceCents: true,
        compareAtPriceCents: true,
        currency: true,
        sku: true,
        status: true,
        isVisible: true,
        categoryId: true,
        requiresShipping: true,
        stockPolicy: true,
        stockQty: true,
      },
    });

    return NextResponse.json({ ok: true, items });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "Nao autenticado." }, { status: 401 });
    }
    console.error("GET /api/organizacao/loja/products error:", err);
    return NextResponse.json({ ok: false, error: "Erro ao carregar produtos." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
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

    const body = await req.json().catch(() => null);
    const parsed = createProductSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Dados invalidos." }, { status: 400 });
    }

    const payload = parsed.data;
    const name = payload.name.trim();
    const rawSlug = payload.slug?.trim();
    const slug = rawSlug ? slugify(rawSlug) : slugify(name);
    if (!slug) {
      return NextResponse.json({ ok: false, error: "Slug invalido." }, { status: 400 });
    }

    if (payload.categoryId) {
      const category = await prisma.storeCategory.findFirst({
        where: { id: payload.categoryId, storeId: context.store.id },
        select: { id: true },
      });
      if (!category) {
        return NextResponse.json({ ok: false, error: "Categoria invalida." }, { status: 400 });
      }
    }

    const created = await prisma.storeProduct.create({
      data: {
        storeId: context.store.id,
        categoryId: payload.categoryId ?? null,
        name,
        slug,
        shortDescription: payload.shortDescription ?? null,
        description: payload.description ?? null,
        priceCents: payload.priceCents,
        compareAtPriceCents: payload.compareAtPriceCents ?? null,
        currency: payload.currency?.toUpperCase() ?? context.store.currency,
        sku: payload.sku ?? null,
        requiresShipping: payload.requiresShipping ?? true,
        stockPolicy: payload.stockPolicy ?? StoreStockPolicy.NONE,
        stockQty: payload.stockQty ?? null,
        status: payload.status ?? StoreProductStatus.DRAFT,
        isVisible: payload.isVisible ?? false,
        tags: payload.tags ?? [],
      },
      select: {
        id: true,
        name: true,
        slug: true,
        shortDescription: true,
        description: true,
        priceCents: true,
        compareAtPriceCents: true,
        currency: true,
        sku: true,
        status: true,
        isVisible: true,
        categoryId: true,
        requiresShipping: true,
        stockPolicy: true,
        stockQty: true,
      },
    });

    return NextResponse.json({ ok: true, item: created }, { status: 201 });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "Nao autenticado." }, { status: 401 });
    }
    console.error("POST /api/organizacao/loja/products error:", err);
    return NextResponse.json({ ok: false, error: "Erro ao criar produto." }, { status: 500 });
  }
}
