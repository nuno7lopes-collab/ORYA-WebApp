import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { isStoreFeatureEnabled } from "@/lib/storeAccess";
import { StoreOrderStatus } from "@prisma/client";
import { z } from "zod";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

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

async function _GET(req: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
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

    const resolvedParams = await params;
    const orderId = parseId(resolvedParams.orderId);
    if (!orderId.ok) {
      return jsonWrap({ ok: false, error: orderId.error }, { status: 400 });
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
            line1: true,
            line2: true,
            city: true,
            region: true,
            postalCode: true,
            country: true,
            nif: true,
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
      return jsonWrap({ ok: false, error: "Encomenda nao encontrada." }, { status: 404 });
    }

    return jsonWrap({ ok: true, order });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ ok: false, error: "Nao autenticado." }, { status: 401 });
    }
    console.error("GET /api/me/store/orders/[orderId] error:", err);
    return jsonWrap({ ok: false, error: "Erro ao carregar encomenda." }, { status: 500 });
  }
}

async function _PATCH(req: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
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

    const resolvedParams = await params;
    const orderId = parseId(resolvedParams.orderId);
    if (!orderId.ok) {
      return jsonWrap({ ok: false, error: orderId.error }, { status: 400 });
    }

    const body = await req.json().catch(() => null);
    const parsed = updateOrderSchema.safeParse(body);
    if (!parsed.success) {
      return jsonWrap({ ok: false, error: "Dados invalidos." }, { status: 400 });
    }

    const existing = await prisma.storeOrder.findFirst({
      where: { id: orderId.id, storeId: context.store.id },
      select: { id: true },
    });
    if (!existing) {
      return jsonWrap({ ok: false, error: "Encomenda nao encontrada." }, { status: 404 });
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

    return jsonWrap({ ok: true, order: updated });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ ok: false, error: "Nao autenticado." }, { status: 401 });
    }
    console.error("PATCH /api/me/store/orders/[orderId] error:", err);
    return jsonWrap({ ok: false, error: "Erro ao atualizar encomenda." }, { status: 500 });
  }
}
export const GET = withApiEnvelope(_GET);
export const PATCH = withApiEnvelope(_PATCH);