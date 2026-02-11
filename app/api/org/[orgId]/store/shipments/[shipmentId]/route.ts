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

const updateShipmentSchema = z
  .object({
    carrier: z.string().trim().max(120).optional().nullable(),
    trackingNumber: z.string().trim().max(120).optional().nullable(),
    trackingUrl: z.string().trim().url().optional().nullable(),
    status: z.nativeEnum(StoreShipmentStatus).optional(),
    shippedAt: z.string().datetime().optional().nullable(),
    deliveredAt: z.string().datetime().optional().nullable(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: "Sem dados." });

function parseId(value: string) {
  const id = Number(value);
  if (!Number.isFinite(id)) {
    return { ok: false as const, error: "ID invalido." };
  }
  return { ok: true as const, id };
}

function parseDateInput(value: string | null | undefined) {
  if (value === null) return null;
  if (!value) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
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
async function _PATCH(req: NextRequest, { params }: { params: Promise<{ shipmentId: string }> }) {
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
    const shipmentId = parseId(resolvedParams.shipmentId);
    if (!shipmentId.ok) {
      return fail(400, shipmentId.error);
    }

    const shipment = await prisma.storeShipment.findFirst({
      where: { id: shipmentId.id, order: { storeId: context.store.id } },
      select: { id: true, orderId: true, status: true },
    });
    if (!shipment) {
      return fail(404, "Envio nao encontrado.");
    }

    const body = await req.json().catch(() => null);
    const parsed = updateShipmentSchema.safeParse(body);
    if (!parsed.success) {
      return fail(400, "Dados invalidos.");
    }

    const payload = parsed.data;
    const nextStatus = payload.status ?? shipment.status;
    const nextShippedAt = parseDateInput(payload.shippedAt);
    const nextDeliveredAt = parseDateInput(payload.deliveredAt);

    const updated = await prisma.$transaction(async (tx) => {
      const updatedShipment = await tx.storeShipment.update({
        where: { id: shipment.id },
        data: {
          carrier: payload.carrier ?? undefined,
          trackingNumber: payload.trackingNumber ?? undefined,
          trackingUrl: payload.trackingUrl ?? undefined,
          status: payload.status ?? undefined,
          shippedAt:
            nextShippedAt !== undefined
              ? nextShippedAt
              : nextStatus !== StoreShipmentStatus.PENDING
                ? new Date()
                : undefined,
          deliveredAt:
            nextDeliveredAt !== undefined
              ? nextDeliveredAt
              : nextStatus === StoreShipmentStatus.DELIVERED
                ? new Date()
                : undefined,
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

      if (nextStatus === StoreShipmentStatus.DELIVERED) {
        await tx.storeOrder.update({
          where: { id: shipment.orderId },
          data: { status: StoreOrderStatus.FULFILLED },
        });
      }

      return updatedShipment;
    });

    return respondOk(ctx, {shipment: updated });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail(401, "Nao autenticado.");
    }
    console.error("PATCH /api/organizacao/loja/shipments/[shipmentId] error:", err);
    return fail(500, "Erro ao atualizar envio.");
  }
}

async function _DELETE(req: NextRequest, { params }: { params: Promise<{ shipmentId: string }> }) {
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
    const shipmentId = parseId(resolvedParams.shipmentId);
    if (!shipmentId.ok) {
      return fail(400, shipmentId.error);
    }

    const shipment = await prisma.storeShipment.findFirst({
      where: { id: shipmentId.id, order: { storeId: context.store.id } },
      select: { id: true },
    });
    if (!shipment) {
      return fail(404, "Envio nao encontrado.");
    }

    await prisma.storeShipment.delete({ where: { id: shipment.id } });

    return respondOk(ctx, {});
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail(401, "Nao autenticado.");
    }
    console.error("DELETE /api/organizacao/loja/shipments/[shipmentId] error:", err);
    return fail(500, "Erro ao remover envio.");
  }
}
export const PATCH = withApiEnvelope(_PATCH);
export const DELETE = withApiEnvelope(_DELETE);