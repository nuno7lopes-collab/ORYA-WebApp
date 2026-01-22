import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { isStoreFeatureEnabled } from "@/lib/storeAccess";
import { z } from "zod";

const createValueSchema = z.object({
  value: z.string().trim().min(1, "Valor obrigatorio.").max(120),
  label: z.string().trim().max(120).optional().nullable(),
  priceDeltaCents: z.number().int().optional(),
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

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; optionId: string }> },
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

    const resolvedParams = await params;
    const productId = parseId(resolvedParams.id);
    if (!productId.ok) {
      return NextResponse.json({ ok: false, error: productId.error }, { status: 400 });
    }

    const optionId = parseId(resolvedParams.optionId);
    if (!optionId.ok) {
      return NextResponse.json({ ok: false, error: optionId.error }, { status: 400 });
    }

    const product = await prisma.storeProduct.findFirst({
      where: { id: productId.id, storeId: context.store.id },
      select: { id: true },
    });
    if (!product) {
      return NextResponse.json({ ok: false, error: "Produto nao encontrado." }, { status: 404 });
    }

    const option = await prisma.storeProductOption.findFirst({
      where: { id: optionId.id, productId: productId.id },
      select: { id: true },
    });
    if (!option) {
      return NextResponse.json({ ok: false, error: "Opcao nao encontrada." }, { status: 404 });
    }

    const items = await prisma.storeProductOptionValue.findMany({
      where: { optionId: optionId.id },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        value: true,
        label: true,
        priceDeltaCents: true,
        sortOrder: true,
      },
    });

    return NextResponse.json({ ok: true, items });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "Nao autenticado." }, { status: 401 });
    }
    console.error("GET /api/me/store/products/[id]/options/[optionId]/values error:", err);
    return NextResponse.json({ ok: false, error: "Erro ao carregar valores." }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; optionId: string }> },
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

    const resolvedParams = await params;
    const productId = parseId(resolvedParams.id);
    if (!productId.ok) {
      return NextResponse.json({ ok: false, error: productId.error }, { status: 400 });
    }

    const optionId = parseId(resolvedParams.optionId);
    if (!optionId.ok) {
      return NextResponse.json({ ok: false, error: optionId.error }, { status: 400 });
    }

    const body = await req.json().catch(() => null);
    const parsed = createValueSchema.safeParse(body);
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

    const option = await prisma.storeProductOption.findFirst({
      where: { id: optionId.id, productId: productId.id },
      select: { id: true },
    });
    if (!option) {
      return NextResponse.json({ ok: false, error: "Opcao nao encontrada." }, { status: 404 });
    }

    const payload = parsed.data;
    const created = await prisma.storeProductOptionValue.create({
      data: {
        optionId: optionId.id,
        value: payload.value.trim(),
        label: payload.label ?? null,
        priceDeltaCents: payload.priceDeltaCents ?? 0,
        sortOrder: payload.sortOrder ?? 0,
      },
      select: {
        id: true,
        value: true,
        label: true,
        priceDeltaCents: true,
        sortOrder: true,
      },
    });

    return NextResponse.json({ ok: true, item: created }, { status: 201 });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "Nao autenticado." }, { status: 401 });
    }
    console.error("POST /api/me/store/products/[id]/options/[optionId]/values error:", err);
    return NextResponse.json({ ok: false, error: "Erro ao criar valor." }, { status: 500 });
  }
}
