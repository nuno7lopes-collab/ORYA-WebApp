import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { isStoreFeatureEnabled } from "@/lib/storeAccess";
import { z } from "zod";

const createVariantSchema = z.object({
  label: z.string().trim().min(1, "Label obrigatorio.").max(120),
  sku: z.string().trim().max(60).optional().nullable(),
  priceCents: z.number().int().nonnegative().optional().nullable(),
  stockQty: z.number().int().nonnegative().optional().nullable(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().nonnegative().optional(),
});

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

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    const resolvedParams = await params;
    const productId = parseId(resolvedParams.id);
    if (!productId.ok) {
      return NextResponse.json({ ok: false, error: productId.error }, { status: 400 });
    }

    const product = await prisma.storeProduct.findFirst({
      where: { id: productId.id, storeId: context.store.id },
      select: { id: true },
    });
    if (!product) {
      return NextResponse.json({ ok: false, error: "Produto nao encontrado." }, { status: 404 });
    }

    const items = await prisma.storeProductVariant.findMany({
      where: { productId: productId.id },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
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

    return NextResponse.json({ ok: true, items });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "Nao autenticado." }, { status: 401 });
    }
    console.error("GET /api/me/store/products/[id]/variants error:", err);
    return NextResponse.json({ ok: false, error: "Erro ao carregar variantes." }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    const resolvedParams = await params;
    const productId = parseId(resolvedParams.id);
    if (!productId.ok) {
      return NextResponse.json({ ok: false, error: productId.error }, { status: 400 });
    }

    const body = await req.json().catch(() => null);
    const parsed = createVariantSchema.safeParse(body);
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

    const payload = parsed.data;
    const created = await prisma.storeProductVariant.create({
      data: {
        productId: productId.id,
        label: payload.label.trim(),
        sku: payload.sku ?? null,
        priceCents: payload.priceCents ?? null,
        stockQty: payload.stockQty ?? null,
        isActive: payload.isActive ?? true,
        sortOrder: payload.sortOrder ?? 0,
      },
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

    return NextResponse.json({ ok: true, item: created }, { status: 201 });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "Nao autenticado." }, { status: 401 });
    }
    console.error("POST /api/me/store/products/[id]/variants error:", err);
    return NextResponse.json({ ok: false, error: "Erro ao criar variante." }, { status: 500 });
  }
}
