import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { ensureLojaModuleAccess } from "@/lib/loja/access";
import { isStoreFeatureEnabled } from "@/lib/storeAccess";
import { OrganizationMemberRole, StoreProductStatus } from "@prisma/client";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";

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

    const context = await getOrganizationContext(req, user.id, { requireVerifiedEmail: req.method !== "GET" });
    if (!context.ok) {
      return fail(403, context.error);
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

    return respondOk(ctx, {products: mappedProducts,
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
      return fail(401, "Nao autenticado.");
    }
    console.error("GET /api/organizacao/loja/overview error:", err);
    return fail(500, "Erro ao carregar resumo.");
  }
}
export const GET = withApiEnvelope(_GET);