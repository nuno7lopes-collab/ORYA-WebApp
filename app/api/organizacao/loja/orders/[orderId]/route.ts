import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { ensureLojaModuleAccess } from "@/lib/loja/access";
import { isStoreFeatureEnabled } from "@/lib/storeAccess";
import { OrganizationMemberRole, StoreOrderStatus } from "@prisma/client";
import { z } from "zod";

const ALLOWED_ROLES: OrganizationMemberRole[] = [
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
    roles: [...ALLOWED_ROLES],
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

export async function GET(req: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  try {
    if (!isStoreFeatureEnabled()) {
      return NextResponse.json({ ok: false, error: "Loja desativada." }, { status: 403 });
    }

    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const context = await getOrganizationContext(req, user.id, { requireVerifiedEmail: req.method !== "GET" });
    if (!context.ok) {
      return NextResponse.json({ ok: false, error: context.error }, { status: 403 });
    }

    const resolvedParams = await params;
    const orderId = parseId(resolvedParams.orderId);
    if (!orderId.ok) {
      return NextResponse.json({ ok: false, error: orderId.error }, { status: 400 });
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
      return NextResponse.json({ ok: false, error: "Encomenda nao encontrada." }, { status: 404 });
    }

    return NextResponse.json({ ok: true, order });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "Nao autenticado." }, { status: 401 });
    }
    console.error("GET /api/organizacao/loja/orders/[orderId] error:", err);
    return NextResponse.json({ ok: false, error: "Erro ao carregar encomenda." }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  try {
    if (!isStoreFeatureEnabled()) {
      return NextResponse.json({ ok: false, error: "Loja desativada." }, { status: 403 });
    }

    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const context = await getOrganizationContext(req, user.id, { requireVerifiedEmail: req.method !== "GET" });
    if (!context.ok) {
      return NextResponse.json({ ok: false, error: context.error }, { status: 403 });
    }

    const resolvedParams = await params;
    const orderId = parseId(resolvedParams.orderId);
    if (!orderId.ok) {
      return NextResponse.json({ ok: false, error: orderId.error }, { status: 400 });
    }

    const body = await req.json().catch(() => null);
    const parsed = updateOrderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Dados invalidos." }, { status: 400 });
    }

    const existing = await prisma.storeOrder.findFirst({
      where: { id: orderId.id, storeId: context.store.id },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ ok: false, error: "Encomenda nao encontrada." }, { status: 404 });
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

    return NextResponse.json({ ok: true, order: updated });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "Nao autenticado." }, { status: 401 });
    }
    console.error("PATCH /api/organizacao/loja/orders/[orderId] error:", err);
    return NextResponse.json({ ok: false, error: "Erro ao atualizar encomenda." }, { status: 500 });
  }
}
