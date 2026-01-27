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

type PreviewProduct = {
  id: number;
  name: string;
  priceCents: number;
  currency: string;
  slug: string;
  status: StoreProductStatus;
  isVisible: boolean;
  imageUrl: string | null;
};

export async function GET(req: NextRequest) {
  try {
    if (!isStoreFeatureEnabled()) {
      return NextResponse.json({ ok: false, error: "Loja desativada." }, { status: 403 });
    }

    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization, membership } = await getActiveOrganizationForUser(user.id, {
      organizationId: organizationId ?? undefined,
      roles: [...ROLE_ALLOWLIST],
    });

    if (!organization || !membership) {
      return NextResponse.json({ ok: false, error: "Sem permissoes." }, { status: 403 });
    }

    const lojaAccess = await ensureLojaModuleAccess(organization);
    if (!lojaAccess.ok) {
      return NextResponse.json({ ok: false, error: lojaAccess.error }, { status: 403 });
    }

    const store = await prisma.store.findFirst({
      where: { ownerOrganizationId: organization.id },
      select: { id: true, status: true, showOnProfile: true, catalogLocked: true, currency: true },
    });

    if (!store) {
      return NextResponse.json({ ok: false, error: "Loja ainda nao criada." }, { status: 404 });
    }

    const [totalCount, publicCount, draftCount, publicItems, draftItems] = await Promise.all([
      prisma.storeProduct.count({ where: { storeId: store.id } }),
      prisma.storeProduct.count({
        where: { storeId: store.id, status: StoreProductStatus.ACTIVE, isVisible: true },
      }),
      prisma.storeProduct.count({
        where: {
          storeId: store.id,
          OR: [{ status: { not: StoreProductStatus.ACTIVE } }, { isVisible: false }],
        },
      }),
      prisma.storeProduct.findMany({
        where: { storeId: store.id, status: StoreProductStatus.ACTIVE, isVisible: true },
        orderBy: [{ createdAt: "desc" }],
        take: 4,
        select: {
          id: true,
          name: true,
          priceCents: true,
          currency: true,
          slug: true,
          status: true,
          isVisible: true,
          images: {
            select: { url: true, isPrimary: true, sortOrder: true },
            orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
            take: 1,
          },
        },
      }),
      prisma.storeProduct.findMany({
        where: {
          storeId: store.id,
          OR: [{ status: { not: StoreProductStatus.ACTIVE } }, { isVisible: false }],
        },
        orderBy: [{ createdAt: "desc" }],
        take: 4,
        select: {
          id: true,
          name: true,
          priceCents: true,
          currency: true,
          slug: true,
          status: true,
          isVisible: true,
          images: {
            select: { url: true, isPrimary: true, sortOrder: true },
            orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
            take: 1,
          },
        },
      }),
    ]);

    const mapProduct = (product: (typeof publicItems)[number]): PreviewProduct => ({
      id: product.id,
      name: product.name,
      priceCents: product.priceCents,
      currency: product.currency,
      slug: product.slug,
      status: product.status,
      isVisible: product.isVisible,
      imageUrl: product.images[0]?.url ?? null,
    });

    return NextResponse.json({
      ok: true,
      store,
      counts: {
        total: totalCount,
        public: publicCount,
        draft: draftCount,
      },
      publicProducts: publicItems.map(mapProduct),
      draftProducts: draftItems.map(mapProduct),
    });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "Nao autenticado." }, { status: 401 });
    }
    console.error("GET /api/organizacao/loja/preview error:", err);
    return NextResponse.json({ ok: false, error: "Erro ao carregar loja." }, { status: 500 });
  }
}
