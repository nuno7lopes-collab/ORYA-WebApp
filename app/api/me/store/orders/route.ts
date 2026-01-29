import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { isStoreFeatureEnabled } from "@/lib/storeAccess";
import { Prisma, StoreOrderStatus } from "@prisma/client";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";

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

function errorCodeForStatus(status: number) {
  if (status === 401) return "UNAUTHENTICATED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 409) return "CONFLICT";
  if (status === 410) return "GONE";
  if (status === 413) return "PAYLOAD_TOO_LARGE";
  if (status === 422) return "VALIDATION_FAILED";
  if (status === 400) return "BAD_REQUEST";
  return "INTERNAL_ERROR";
}
async function _GET(req: NextRequest) {
  const ctx = getRequestContext(req);
  const fail = (
    status: number,
    message: string,
    errorCode = errorCodeForStatus(status),
    retryable = status >= 500,
  ) => {
    const resolvedMessage = typeof message === "string" ? message : String(message);
    const resolvedCode = /^[A-Z0-9_]+$/.test(resolvedMessage) ? resolvedMessage : errorCode;
    return respondError(ctx, { errorCode: resolvedCode, message: resolvedMessage, retryable }, { status });
  };
  try {
    if (!isStoreFeatureEnabled()) {
      return fail(403, "Loja desativada.");
    }

    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const context = await getStoreContext(user.id);
    if (!context.ok) {
      return fail(403, context.error);
    }

    const statusRaw = req.nextUrl.searchParams.get("status");
    const status = Object.values(StoreOrderStatus).includes(statusRaw as StoreOrderStatus)
      ? (statusRaw as StoreOrderStatus)
      : null;
    const query = req.nextUrl.searchParams.get("q")?.trim();
    const limitRaw = Number(req.nextUrl.searchParams.get("limit") ?? "40");
    const limit = Number.isFinite(limitRaw) ? Math.min(100, Math.max(1, limitRaw)) : 40;

    const where: Prisma.StoreOrderWhereInput = {
      storeId: context.store.id,
      status: status ?? undefined,
      OR: query
        ? [
            { orderNumber: { contains: query, mode: Prisma.QueryMode.insensitive } },
            { customerEmail: { contains: query, mode: Prisma.QueryMode.insensitive } },
            { customerName: { contains: query, mode: Prisma.QueryMode.insensitive } },
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

    return respondOk(ctx, { items,
      summary: {
        totalOrders:
          typeof summary._count === "object" && summary._count?._all
            ? summary._count._all
            : 0,
        totalCents: summary._sum?.totalCents ?? 0,
        shippingCents: summary._sum?.shippingCents ?? 0,
      },
    });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail(401, "Nao autenticado.");
    }
    console.error("GET /api/me/store/orders error:", err);
    return fail(500, "Erro ao carregar encomendas.");
  }
}
export const GET = withApiEnvelope(_GET);
