import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { ensureLojaModuleAccess } from "@/lib/loja/access";
import { isStoreFeatureEnabled } from "@/lib/storeAccess";
import { OrganizationMemberRole, StoreOrderStatus, StoreShipmentStatus } from "@prisma/client";
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

const createShipmentSchema = z.object({
  carrier: z.string().trim().max(120).optional().nullable(),
  trackingNumber: z.string().trim().max(120).optional().nullable(),
  trackingUrl: z.string().trim().url().optional().nullable(),
  status: z.nativeEnum(StoreShipmentStatus).optional(),
  shippedAt: z.string().datetime().optional().nullable(),
  deliveredAt: z.string().datetime().optional().nullable(),
});

function parseId(value: string) {
  const id = Number(value);
  if (!Number.isFinite(id)) {
    return { ok: false as const, error: "ID invalido." };
  }
  return { ok: true as const, id };
}

function parseDateInput(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
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
async function _POST(req: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
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
      select: { id: true, status: true },
    });
    if (!order) {
      return fail(404, "Encomenda nao encontrada.");
    }

    const body = await req.json().catch(() => null);
    const parsed = createShipmentSchema.safeParse(body);
    if (!parsed.success) {
      return fail(400, "Dados invalidos.");
    }

    const payload = parsed.data;
    const status = payload.status ?? StoreShipmentStatus.PENDING;
    const shippedAt = parseDateInput(payload.shippedAt);
    const deliveredAt = parseDateInput(payload.deliveredAt);

    const created = await prisma.$transaction(async (tx) => {
      const shipment = await tx.storeShipment.create({
        data: {
          orderId: order.id,
          carrier: payload.carrier ?? null,
          trackingNumber: payload.trackingNumber ?? null,
          trackingUrl: payload.trackingUrl ?? null,
          status,
          shippedAt: status !== StoreShipmentStatus.PENDING ? shippedAt ?? new Date() : shippedAt,
          deliveredAt:
            status === StoreShipmentStatus.DELIVERED ? deliveredAt ?? new Date() : deliveredAt ?? null,
        },
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
      });

      if (status === StoreShipmentStatus.DELIVERED && order.status !== StoreOrderStatus.FULFILLED) {
        await tx.storeOrder.update({
          where: { id: order.id },
          data: { status: StoreOrderStatus.FULFILLED },
        });
      }

      return shipment;
    });

    return respondOk(ctx, {shipment: created }, { status: 201 });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail(401, "Nao autenticado.");
    }
    console.error("POST /api/org/[orgId]/store/orders/[orderId]/shipments error:", err);
    return fail(500, "Erro ao criar envio.");
  }
}
export const POST = withApiEnvelope(_POST);