import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
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

async function _PATCH(req: NextRequest, { params }: { params: Promise<{ shipmentId: string }> }) {
  try {
    if (!isStoreFeatureEnabled()) {
      return jsonWrap({ ok: false, error: "Loja desativada." }, { status: 403 });
    }

    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const context = await getOrganizationContext(req, user.id, { requireVerifiedEmail: req.method !== "GET" });
    if (!context.ok) {
      return jsonWrap({ ok: false, error: context.error }, { status: 403 });
    }

    const resolvedParams = await params;
    const shipmentId = parseId(resolvedParams.shipmentId);
    if (!shipmentId.ok) {
      return jsonWrap({ ok: false, error: shipmentId.error }, { status: 400 });
    }

    const shipment = await prisma.storeShipment.findFirst({
      where: { id: shipmentId.id, order: { storeId: context.store.id } },
      select: { id: true, orderId: true, status: true },
    });
    if (!shipment) {
      return jsonWrap({ ok: false, error: "Envio nao encontrado." }, { status: 404 });
    }

    const body = await req.json().catch(() => null);
    const parsed = updateShipmentSchema.safeParse(body);
    if (!parsed.success) {
      return jsonWrap({ ok: false, error: "Dados invalidos." }, { status: 400 });
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

    return jsonWrap({ ok: true, shipment: updated });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ ok: false, error: "Nao autenticado." }, { status: 401 });
    }
    console.error("PATCH /api/organizacao/loja/shipments/[shipmentId] error:", err);
    return jsonWrap({ ok: false, error: "Erro ao atualizar envio." }, { status: 500 });
  }
}

async function _DELETE(req: NextRequest, { params }: { params: Promise<{ shipmentId: string }> }) {
  try {
    if (!isStoreFeatureEnabled()) {
      return jsonWrap({ ok: false, error: "Loja desativada." }, { status: 403 });
    }

    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const context = await getOrganizationContext(req, user.id, { requireVerifiedEmail: req.method !== "GET" });
    if (!context.ok) {
      return jsonWrap({ ok: false, error: context.error }, { status: 403 });
    }

    const resolvedParams = await params;
    const shipmentId = parseId(resolvedParams.shipmentId);
    if (!shipmentId.ok) {
      return jsonWrap({ ok: false, error: shipmentId.error }, { status: 400 });
    }

    const shipment = await prisma.storeShipment.findFirst({
      where: { id: shipmentId.id, order: { storeId: context.store.id } },
      select: { id: true },
    });
    if (!shipment) {
      return jsonWrap({ ok: false, error: "Envio nao encontrado." }, { status: 404 });
    }

    await prisma.storeShipment.delete({ where: { id: shipment.id } });

    return jsonWrap({ ok: true });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ ok: false, error: "Nao autenticado." }, { status: 401 });
    }
    console.error("DELETE /api/organizacao/loja/shipments/[shipmentId] error:", err);
    return jsonWrap({ ok: false, error: "Erro ao remover envio." }, { status: 500 });
  }
}
export const PATCH = withApiEnvelope(_PATCH);
export const DELETE = withApiEnvelope(_DELETE);