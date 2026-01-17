import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { isStoreFeatureEnabled } from "@/lib/storeAccess";
import { StoreOrderStatus, StoreShipmentStatus } from "@prisma/client";
import { z } from "zod";

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

export async function POST(req: NextRequest, { params }: { params: { orderId: string } }) {
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

    const orderId = parseId(params.orderId);
    if (!orderId.ok) {
      return NextResponse.json({ ok: false, error: orderId.error }, { status: 400 });
    }

    const order = await prisma.storeOrder.findFirst({
      where: { id: orderId.id, storeId: context.store.id },
      select: { id: true, status: true },
    });
    if (!order) {
      return NextResponse.json({ ok: false, error: "Encomenda nao encontrada." }, { status: 404 });
    }

    const body = await req.json().catch(() => null);
    const parsed = createShipmentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Dados invalidos." }, { status: 400 });
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

      if (status !== StoreShipmentStatus.PENDING && order.status !== StoreOrderStatus.FULFILLED) {
        await tx.storeOrder.update({
          where: { id: order.id },
          data: { status: StoreOrderStatus.FULFILLED },
        });
      }

      return shipment;
    });

    return NextResponse.json({ ok: true, shipment: created }, { status: 201 });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "Nao autenticado." }, { status: 401 });
    }
    console.error("POST /api/me/store/orders/[orderId]/shipments error:", err);
    return NextResponse.json({ ok: false, error: "Erro ao criar envio." }, { status: 500 });
  }
}
