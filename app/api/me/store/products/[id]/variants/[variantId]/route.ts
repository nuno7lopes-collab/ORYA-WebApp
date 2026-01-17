import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { isStoreFeatureEnabled } from "@/lib/storeAccess";
import { z } from "zod";

const updateVariantSchema = z
  .object({
    label: z.string().trim().min(1).max(120).optional(),
    sku: z.string().trim().max(60).optional().nullable(),
    priceCents: z.number().int().nonnegative().optional().nullable(),
    stockQty: z.number().int().nonnegative().optional().nullable(),
    isActive: z.boolean().optional(),
    sortOrder: z.number().int().nonnegative().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: "Sem dados." });

async function getStoreContext(userId: string) {
  const store = await prisma.store.findFirst({
    where: { ownerUserId: userId },
    select: { id: true, catalogLocked: true },
  });

  if (!store) {
    return { ok: false as const, error: "Loja ainda nao criada." };
  }

  return { ok: true as const, store };
}

function parseId(value: string) {
  const id = Number(value);
  if (!Number.isFinite(id)) {
    return { ok: false as const, error: "ID invalido." };
  }
  return { ok: true as const, id };
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; variantId: string } },
) {
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

    if (context.store.catalogLocked) {
      return NextResponse.json({ ok: false, error: "Catalogo bloqueado." }, { status: 403 });
    }

    const productId = parseId(params.id);
    if (!productId.ok) {
      return NextResponse.json({ ok: false, error: productId.error }, { status: 400 });
    }

    const variantId = parseId(params.variantId);
    if (!variantId.ok) {
      return NextResponse.json({ ok: false, error: variantId.error }, { status: 400 });
    }

    const body = await req.json().catch(() => null);
    const parsed = updateVariantSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Dados invalidos." }, { status: 400 });
    }

    const product = await prisma.storeProduct.findFirst({
      where: { id: productId.id, storeId: context.store.id },
      select: { id: true },
    });
    if (!product) {
      return NextResponse.json({ ok: false, error: "Produto nao encontrado." }, { status: 404 });
    }

    const existing = await prisma.storeProductVariant.findFirst({
      where: { id: variantId.id, productId: productId.id },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ ok: false, error: "Variante nao encontrada." }, { status: 404 });
    }

    const payload = parsed.data;
    const data: {
      label?: string;
      sku?: string | null;
      priceCents?: number | null;
      stockQty?: number | null;
      isActive?: boolean;
      sortOrder?: number;
    } = {};

    if (payload.label) data.label = payload.label.trim();
    if (payload.sku !== undefined) data.sku = payload.sku ?? null;
    if (payload.priceCents !== undefined) data.priceCents = payload.priceCents ?? null;
    if (payload.stockQty !== undefined) data.stockQty = payload.stockQty ?? null;
    if (payload.isActive !== undefined) data.isActive = payload.isActive;
    if (payload.sortOrder !== undefined) data.sortOrder = payload.sortOrder;

    const updated = await prisma.storeProductVariant.update({
      where: { id: variantId.id },
      data,
      select: {
        id: true,
        label: true,
        sku: true,
        priceCents: true,
        stockQty: true,
        isActive: true,
        sortOrder: true,
      },
    });

    return NextResponse.json({ ok: true, item: updated });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "Nao autenticado." }, { status: 401 });
    }
    console.error("PATCH /api/me/store/products/[id]/variants/[variantId] error:", err);
    return NextResponse.json({ ok: false, error: "Erro ao atualizar variante." }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; variantId: string } },
) {
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

    if (context.store.catalogLocked) {
      return NextResponse.json({ ok: false, error: "Catalogo bloqueado." }, { status: 403 });
    }

    const productId = parseId(params.id);
    if (!productId.ok) {
      return NextResponse.json({ ok: false, error: productId.error }, { status: 400 });
    }

    const variantId = parseId(params.variantId);
    if (!variantId.ok) {
      return NextResponse.json({ ok: false, error: variantId.error }, { status: 400 });
    }

    const product = await prisma.storeProduct.findFirst({
      where: { id: productId.id, storeId: context.store.id },
      select: { id: true },
    });
    if (!product) {
      return NextResponse.json({ ok: false, error: "Produto nao encontrado." }, { status: 404 });
    }

    const existing = await prisma.storeProductVariant.findFirst({
      where: { id: variantId.id, productId: productId.id },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ ok: false, error: "Variante nao encontrada." }, { status: 404 });
    }

    await prisma.storeProductVariant.delete({ where: { id: variantId.id } });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "Nao autenticado." }, { status: 401 });
    }
    console.error("DELETE /api/me/store/products/[id]/variants/[variantId] error:", err);
    return NextResponse.json({ ok: false, error: "Erro ao remover variante." }, { status: 500 });
  }
}
