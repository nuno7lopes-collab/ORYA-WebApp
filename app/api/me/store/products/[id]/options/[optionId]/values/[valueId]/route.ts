import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { isStoreFeatureEnabled } from "@/lib/storeAccess";
import { z } from "zod";

const updateValueSchema = z
  .object({
    value: z.string().trim().min(1).max(120).optional(),
    label: z.string().trim().max(120).optional().nullable(),
    priceDeltaCents: z.number().int().optional(),
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
  { params }: { params: { id: string; optionId: string; valueId: string } },
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

    const optionId = parseId(params.optionId);
    if (!optionId.ok) {
      return NextResponse.json({ ok: false, error: optionId.error }, { status: 400 });
    }

    const valueId = parseId(params.valueId);
    if (!valueId.ok) {
      return NextResponse.json({ ok: false, error: valueId.error }, { status: 400 });
    }

    const body = await req.json().catch(() => null);
    const parsed = updateValueSchema.safeParse(body);
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

    const existing = await prisma.storeProductOptionValue.findFirst({
      where: { id: valueId.id, optionId: optionId.id },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ ok: false, error: "Valor nao encontrado." }, { status: 404 });
    }

    const payload = parsed.data;
    const data: {
      value?: string;
      label?: string | null;
      priceDeltaCents?: number;
      sortOrder?: number;
    } = {};

    if (payload.value) data.value = payload.value.trim();
    if (payload.label !== undefined) data.label = payload.label ?? null;
    if (payload.priceDeltaCents !== undefined) data.priceDeltaCents = payload.priceDeltaCents;
    if (payload.sortOrder !== undefined) data.sortOrder = payload.sortOrder;

    const updated = await prisma.storeProductOptionValue.update({
      where: { id: valueId.id },
      data,
      select: {
        id: true,
        value: true,
        label: true,
        priceDeltaCents: true,
        sortOrder: true,
      },
    });

    return NextResponse.json({ ok: true, item: updated });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "Nao autenticado." }, { status: 401 });
    }
    console.error(
      "PATCH /api/me/store/products/[id]/options/[optionId]/values/[valueId] error:",
      err,
    );
    return NextResponse.json({ ok: false, error: "Erro ao atualizar valor." }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; optionId: string; valueId: string } },
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

    const optionId = parseId(params.optionId);
    if (!optionId.ok) {
      return NextResponse.json({ ok: false, error: optionId.error }, { status: 400 });
    }

    const valueId = parseId(params.valueId);
    if (!valueId.ok) {
      return NextResponse.json({ ok: false, error: valueId.error }, { status: 400 });
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

    const existing = await prisma.storeProductOptionValue.findFirst({
      where: { id: valueId.id, optionId: optionId.id },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ ok: false, error: "Valor nao encontrado." }, { status: 404 });
    }

    await prisma.storeProductOptionValue.delete({ where: { id: valueId.id } });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "Nao autenticado." }, { status: 401 });
    }
    console.error(
      "DELETE /api/me/store/products/[id]/options/[optionId]/values/[valueId] error:",
      err,
    );
    return NextResponse.json({ ok: false, error: "Erro ao remover valor." }, { status: 500 });
  }
}
