import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { isStoreFeatureEnabled } from "@/lib/storeAccess";
import { StoreProductStatus } from "@prisma/client";

async function getStoreContext(userId: string) {
  const store = await prisma.store.findFirst({
    where: { ownerUserId: userId },
    select: { id: true, currency: true },
  });

  if (!store) {
    return { ok: false as const, error: "Loja ainda nao criada." };
  }

  return { ok: true as const, store };
}

export async function GET() {
  try {
    if (!isStoreFeatureEnabled()) {
      return NextResponse.json({ ok: false, error: "Loja desativada." }, { status: 403 });
    }

    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const context = await getStoreContext(user.id);
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
    console.error("GET /api/me/store/overview error:", err);
    return NextResponse.json({ ok: false, error: "Erro ao carregar resumo." }, { status: 500 });
  }
}
