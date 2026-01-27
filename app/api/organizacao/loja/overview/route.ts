import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { ensureLojaModuleAccess } from "@/lib/loja/access";
import { isStoreFeatureEnabled } from "@/lib/storeAccess";
import { OrganizationMemberRole, StoreProductStatus } from "@prisma/client";

const ROLE_ALLOWLIST: OrganizationMemberRole[] = [
  OrganizationMemberRole.OWNER,
  OrganizationMemberRole.CO_OWNER,
  OrganizationMemberRole.ADMIN,
  OrganizationMemberRole.STAFF,
];

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
    select: { id: true, currency: true },
  });

  if (!store) {
    return { ok: false as const, error: "Loja ainda nao criada." };
  }

  return { ok: true as const, store };
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

    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [products, orders, summary] = await Promise.all([
      prisma.storeProduct.findMany({
        where: {
          storeId: context.store.id,
          status: StoreProductStatus.ACTIVE,
          isVisible: true,
        },
        orderBy: [{ createdAt: "desc" }],
        take: 8,
        select: {
          id: true,
          name: true,
          priceCents: true,
          currency: true,
          slug: true,
          images: {
            select: { url: true, isPrimary: true, sortOrder: true },
            orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
            take: 1,
          },
        },
      }),
      prisma.storeOrder.findMany({
        where: { storeId: context.store.id },
        orderBy: [{ createdAt: "desc" }],
        take: 5,
        select: {
          id: true,
          orderNumber: true,
          status: true,
          totalCents: true,
          currency: true,
          customerName: true,
          createdAt: true,
        },
      }),
      prisma.storeOrder.aggregate({
        where: { storeId: context.store.id, createdAt: { gte: since } },
        _count: { _all: true },
        _sum: { totalCents: true },
        _avg: { totalCents: true },
      }),
    ]);

    const mappedProducts = products.map((product) => ({
      id: product.id,
      name: product.name,
      priceCents: product.priceCents,
      currency: product.currency,
      slug: product.slug,
      imageUrl: product.images[0]?.url ?? null,
    }));

    return NextResponse.json({
      ok: true,
      products: mappedProducts,
      orders,
      summary: {
        totalCents: summary._sum.totalCents ?? 0,
        totalOrders: summary._count._all ?? 0,
        avgOrderCents: Math.round(summary._avg.totalCents ?? 0),
        currency: context.store.currency,
      },
    });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "Nao autenticado." }, { status: 401 });
    }
    console.error("GET /api/organizacao/loja/overview error:", err);
    return NextResponse.json({ ok: false, error: "Erro ao carregar resumo." }, { status: 500 });
  }
}
