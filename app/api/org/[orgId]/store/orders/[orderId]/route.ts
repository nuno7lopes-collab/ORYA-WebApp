import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { ensureLojaModuleAccess } from "@/lib/loja/access";
import { isStoreFeatureEnabled } from "@/lib/storeAccess";
import { OrganizationMemberRole, StoreOrderStatus } from "@prisma/client";
import { z } from "zod";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";

const ROLE_ALLOWLIST: OrganizationMemberRole[] = [
  OrganizationMemberRole.OWNER,
  OrganizationMemberRole.CO_OWNER,
  OrganizationMemberRole.ADMIN,
  OrganizationMemberRole.STAFF,
];

const updateOrderSchema = z
  .object({
    status: z.nativeEnum(StoreOrderStatus).optional(),
    notes: z.string().trim().max(2000).optional().nullable(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: "Sem dados." });

function parseId(value: string) {
  const id = Number(value);
  if (!Number.isFinite(id)) {
    return { ok: false as const, error: "ID invalido." };
  }
  return { ok: true as const, id };
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
async function _GET(req: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
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

    const resolvedParams = await params;
    const orderId = parseId(resolvedParams.orderId);
    if (!orderId.ok) {
      return fail(400, orderId.error);
    }

    const order = await prisma.storeOrder.findFirst({
      where: { id: orderId.id, storeId: context.store.id },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        subtotalCents: true,
        discountCents: true,
        shippingCents: true,
        totalCents: true,
        currency: true,
        customerName: true,
        customerEmail: true,
        customerPhone: true,
        notes: true,
        createdAt: true,
        shippingZone: { select: { id: true, name: true } },
        shippingMethod: { select: { id: true, name: true, description: true, etaMinDays: true, etaMaxDays: true } },
        lines: {
          select: {
            id: true,
            nameSnapshot: true,
            skuSnapshot: true,
            quantity: true,
            unitPriceCents: true,
            totalCents: true,
            requiresShipping: true,
            personalization: true,
            product: { select: { id: true, name: true } },
            variant: { select: { id: true, label: true } },
          },
        },
        addresses: {
          select: {
            id: true,
            addressType: true,
            fullName: true,
            nif: true,
            addressId: true,
            addressRef: { select: { formattedAddress: true } },
          },
        },
        shipments: {
          select: {
            id: true,
            carrier: true,
            trackingNumber: true,
            trackingUrl: true,
            status: true,
            shippedAt: true,
            deliveredAt: true,
            createdAt: true,
            updatedAt: true,
          },
          orderBy: [{ createdAt: "desc" }],
        },
      },
    });

    if (!order) {
      return fail(404, "Encomenda nao encontrada.");
    }

    const normalized = {
      ...order,
      addresses: order.addresses.map((address) => ({
        ...address,
        formattedAddress: address.addressRef?.formattedAddress ?? null,
      })),
    };

    return respondOk(ctx, { order: normalized });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail(401, "Nao autenticado.");
    }
    console.error("GET /api/org/[orgId]/store/orders/[orderId] error:", err);
    return fail(500, "Erro ao carregar encomenda.");
  }
}

async function _PATCH(req: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
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

    const resolvedParams = await params;
    const orderId = parseId(resolvedParams.orderId);
    if (!orderId.ok) {
      return fail(400, orderId.error);
    }

    const body = await req.json().catch(() => null);
    const parsed = updateOrderSchema.safeParse(body);
    if (!parsed.success) {
      return fail(400, "Dados invalidos.");
    }

    const existing = await prisma.storeOrder.findFirst({
      where: { id: orderId.id, storeId: context.store.id },
      select: { id: true },
    });
    if (!existing) {
      return fail(404, "Encomenda nao encontrada.");
    }

    const payload = parsed.data;
    const updated = await prisma.storeOrder.update({
      where: { id: existing.id },
      data: {
        status: payload.status ?? undefined,
        notes: payload.notes ?? undefined,
      },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        notes: true,
        updatedAt: true,
      },
    });

    return respondOk(ctx, {order: updated });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail(401, "Nao autenticado.");
    }
    console.error("PATCH /api/org/[orgId]/store/orders/[orderId] error:", err);
    return fail(500, "Erro ao atualizar encomenda.");
  }
}
export const GET = withApiEnvelope(_GET);
export const PATCH = withApiEnvelope(_PATCH);
