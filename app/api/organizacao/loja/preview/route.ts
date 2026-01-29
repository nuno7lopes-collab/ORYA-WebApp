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

    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization, membership } = await getActiveOrganizationForUser(user.id, {
      organizationId: organizationId ?? undefined,
      roles: [...ROLE_ALLOWLIST],
    });

    if (!organization || !membership) {
      return fail(403, "Sem permissoes.");
    }

    const lojaAccess = await ensureLojaModuleAccess(organization);
    if (!lojaAccess.ok) {
      return fail(403, lojaAccess.error);
    }

    const store = await prisma.store.findFirst({
      where: { ownerOrganizationId: organization.id },
      select: { id: true, status: true, showOnProfile: true, catalogLocked: true, currency: true },
    });

    if (!store) {
      return fail(404, "Loja ainda nao criada.");
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

    return respondOk(ctx, {store,
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
      return fail(401, "Nao autenticado.");
    }
    console.error("GET /api/organizacao/loja/preview error:", err);
    return fail(500, "Erro ao carregar loja.");
  }
}
export const GET = withApiEnvelope(_GET);