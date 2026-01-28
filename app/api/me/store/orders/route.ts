import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { isStoreFeatureEnabled } from "@/lib/storeAccess";
import { StoreOrderStatus } from "@prisma/client";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

async function getStoreContext(userId: string) {
  const store = await prisma.store.findFirst({
    where: { ownerUserId: userId },
    select: { id: true },
  });

  if (!store) {
    return { ok: false as const, error: "Loja ainda nao criada." };
  }

  return { ok: true as const, store };
}

async function _GET(req: NextRequest) {
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

    const statusRaw = req.nextUrl.searchParams.get("status");
    const status = Object.values(StoreOrderStatus).includes(statusRaw as StoreOrderStatus)
      ? (statusRaw as StoreOrderStatus)
      : null;
    const query = req.nextUrl.searchParams.get("q")?.trim();
    const limitRaw = Number(req.nextUrl.searchParams.get("limit") ?? "40");
    const limit = Number.isFinite(limitRaw) ? Math.min(100, Math.max(1, limitRaw)) : 40;

    const where = {
      storeId: context.store.id,
      status: status ?? undefined,
      OR: query
        ? [
            { orderNumber: { contains: query, mode: "insensitive" } },
            { customerEmail: { contains: query, mode: "insensitive" } },
            { customerName: { contains: query, mode: "insensitive" } },
          ]
        : undefined,
    };

    const [items, summary] = await Promise.all([
      prisma.storeOrder.findMany({
        where,
        orderBy: [{ createdAt: "desc" }],
        take: limit,
        select: {
          id: true,
          orderNumber: true,
          status: true,
          subtotalCents: true,
          shippingCents: true,
          totalCents: true,
          currency: true,
          customerName: true,
          customerEmail: true,
          createdAt: true,
          shippingZone: { select: { id: true, name: true } },
          shippingMethod: { select: { id: true, name: true } },
        },
      }),
      prisma.storeOrder.aggregate({
        where,
        _count: { _all: true },
        _sum: { totalCents: true, shippingCents: true },
      }),
    ]);

    return jsonWrap({
      ok: true,
      items,
      summary: {
        totalOrders: summary._count._all ?? 0,
        totalCents: summary._sum.totalCents ?? 0,
        shippingCents: summary._sum.shippingCents ?? 0,
      },
    });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ ok: false, error: "Nao autenticado." }, { status: 401 });
    }
    console.error("GET /api/me/store/orders error:", err);
    return jsonWrap({ ok: false, error: "Erro ao carregar encomendas." }, { status: 500 });
  }
}
export const GET = withApiEnvelope(_GET);