import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { isStoreFeatureEnabled, isStorePublic } from "@/lib/storeAccess";
import { StoreStockPolicy } from "@prisma/client";
import { z } from "zod";

const CART_SESSION_COOKIE = "orya_store_cart";

const updateItemSchema = z
  .object({
    quantity: z.number().int().positive().optional(),
    personalization: z.any().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: "Sem dados." });

type PersonalizationSelection = {
  optionId: number;
  valueId?: number | null;
  value?: string | number | boolean | null;
};

function parseStoreId(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("storeId");
  const storeId = raw ? Number(raw) : null;
  if (!storeId || !Number.isFinite(storeId)) {
    return { ok: false as const, error: "Store invalida." };
  }
  return { ok: true as const, storeId };
}

function parseItemId(value: string) {
  const id = Number(value);
  if (!Number.isFinite(id)) {
    return { ok: false as const, error: "Item invalido." };
  }
  return { ok: true as const, id };
}

async function resolveStore(storeId: number) {
  const store = await prisma.store.findFirst({
    where: { id: storeId },
    select: { id: true, status: true, catalogLocked: true },
  });
  if (!store) {
    return { ok: false as const, error: "Store nao encontrada." };
  }
  if (!isStorePublic(store)) {
    return { ok: false as const, error: "Loja fechada." };
  }
  if (store.catalogLocked) {
    return { ok: false as const, error: "Catalogo bloqueado." };
  }
  return { ok: true as const, store };
}

async function resolveCart(storeId: number, userId: string | null, sessionId: string | null) {
  if (userId) {
    const cart = await prisma.storeCart.findFirst({
      where: { storeId, userId, status: "ACTIVE" },
      include: { items: true },
    });
    if (cart) return { ok: true as const, cart };
  }

  if (sessionId) {
    const cart = await prisma.storeCart.findFirst({
      where: { storeId, sessionId, status: "ACTIVE" },
      include: { items: true },
    });
    if (cart) return { ok: true as const, cart };
  }

  return { ok: false as const, error: "Carrinho nao encontrado." };
}

async function computePersonalizationDelta(params: {
  productId: number;
  personalization: unknown;
}) {
  const selections = Array.isArray((params.personalization as { selections?: unknown })?.selections)
    ? ((params.personalization as { selections?: unknown }).selections as PersonalizationSelection[])
    : [];

  if (selections.length === 0) {
    return { ok: true as const, deltaCents: 0 };
  }

  const optionIds = selections.map((selection) => selection.optionId).filter(Boolean);
  const options = await prisma.storeProductOption.findMany({
    where: { productId: params.productId, id: { in: optionIds } },
    select: { id: true, optionType: true, priceDeltaCents: true },
  });
  const optionMap = new Map(options.map((option) => [option.id, option]));

  for (const selection of selections) {
    if (!optionMap.has(selection.optionId)) {
      return { ok: false as const, error: "Opcao invalida." };
    }
  }

  const valueIds = selections
    .map((selection) => selection.valueId)
    .filter((valueId): valueId is number => Boolean(valueId));
  const values = valueIds.length
    ? await prisma.storeProductOptionValue.findMany({
        where: { id: { in: valueIds } },
        select: { id: true, optionId: true, priceDeltaCents: true },
      })
    : [];
  const valueMap = new Map(values.map((value) => [value.id, value]));

  let deltaCents = 0;
  for (const selection of selections) {
    const option = optionMap.get(selection.optionId);
    if (!option) continue;
    if (option.optionType === "SELECT") {
      if (!selection.valueId) {
        return { ok: false as const, error: "Valor invalido." };
      }
      const value = valueMap.get(selection.valueId);
      if (!value || value.optionId !== option.id) {
        return { ok: false as const, error: "Valor invalido." };
      }
      deltaCents += value.priceDeltaCents;
    } else if (option.optionType === "CHECKBOX") {
      if (selection.value === true) {
        deltaCents += option.priceDeltaCents;
      }
    } else {
      if (selection.value !== undefined && selection.value !== null && String(selection.value).trim() !== "") {
        deltaCents += option.priceDeltaCents;
      }
    }
  }

  return { ok: true as const, deltaCents };
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { itemId: string } },
) {
  try {
    if (!isStoreFeatureEnabled()) {
      return NextResponse.json({ ok: false, error: "Loja desativada." }, { status: 403 });
    }

    const storeParsed = parseStoreId(req);
    if (!storeParsed.ok) {
      return NextResponse.json({ ok: false, error: storeParsed.error }, { status: 400 });
    }

    const store = await resolveStore(storeParsed.storeId);
    if (!store.ok) {
      return NextResponse.json({ ok: false, error: store.error }, { status: 403 });
    }

    const itemId = parseItemId(params.itemId);
    if (!itemId.ok) {
      return NextResponse.json({ ok: false, error: itemId.error }, { status: 400 });
    }

    const body = await req.json().catch(() => null);
    const parsed = updateItemSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Dados invalidos." }, { status: 400 });
    }

    const supabase = await createSupabaseServer();
    const { data } = await supabase.auth.getUser();
    const userId = data?.user?.id ?? null;

    const cookieSession = req.cookies.get(CART_SESSION_COOKIE)?.value ?? null;
    const sessionId = userId ? null : cookieSession;

    const cart = await resolveCart(store.store.id, userId, sessionId);
    if (!cart.ok) {
      return NextResponse.json({ ok: false, error: cart.error }, { status: 404 });
    }

    const existing = cart.cart.items.find((item) => item.id === itemId.id);
    if (!existing) {
      return NextResponse.json({ ok: false, error: "Item nao encontrado." }, { status: 404 });
    }

    const payload = parsed.data;
    const nextQuantity = payload.quantity ?? existing.quantity;

    const product = await prisma.storeProduct.findFirst({
      where: { id: existing.productId, storeId: store.store.id },
      select: { id: true, priceCents: true, stockPolicy: true, stockQty: true },
    });
    if (!product) {
      return NextResponse.json({ ok: false, error: "Produto indisponivel." }, { status: 404 });
    }

    let variantPriceCents: number | null = null;
    let variantStockQty: number | null = null;
    if (existing.variantId) {
      const variant = await prisma.storeProductVariant.findFirst({
        where: { id: existing.variantId, productId: existing.productId, isActive: true },
        select: { id: true, priceCents: true, stockQty: true },
      });
      if (!variant) {
        return NextResponse.json({ ok: false, error: "Variante invalida." }, { status: 400 });
      }
      variantPriceCents = variant.priceCents ?? null;
      variantStockQty = variant.stockQty ?? null;
    }

    if (product.stockPolicy === StoreStockPolicy.TRACKED) {
      const available = existing.variantId ? variantStockQty ?? 0 : product.stockQty ?? 0;
      if (nextQuantity > available) {
        return NextResponse.json({ ok: false, error: "Stock insuficiente." }, { status: 409 });
      }
    }

    let unitPriceCents = existing.unitPriceCents;
    if (payload.personalization !== undefined) {
      const personalizationDelta = await computePersonalizationDelta({
        productId: product.id,
        personalization: payload.personalization,
      });
      if (!personalizationDelta.ok) {
        return NextResponse.json({ ok: false, error: personalizationDelta.error }, { status: 400 });
      }
      const basePrice = variantPriceCents ?? product.priceCents;
      unitPriceCents = basePrice + personalizationDelta.deltaCents;
    }

    const updated = await prisma.storeCartItem.update({
      where: { id: existing.id },
      data: {
        quantity: payload.quantity ?? existing.quantity,
        personalization: payload.personalization !== undefined ? payload.personalization : existing.personalization,
        unitPriceCents,
      },
      select: {
        id: true,
        cartId: true,
        productId: true,
        variantId: true,
        quantity: true,
        unitPriceCents: true,
        personalization: true,
      },
    });

    return NextResponse.json({ ok: true, item: updated });
  } catch (err) {
    console.error("PATCH /api/store/cart/items/[itemId] error:", err);
    return NextResponse.json({ ok: false, error: "Erro ao atualizar item." }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { itemId: string } },
) {
  try {
    if (!isStoreFeatureEnabled()) {
      return NextResponse.json({ ok: false, error: "Loja desativada." }, { status: 403 });
    }

    const storeParsed = parseStoreId(req);
    if (!storeParsed.ok) {
      return NextResponse.json({ ok: false, error: storeParsed.error }, { status: 400 });
    }

    const store = await resolveStore(storeParsed.storeId);
    if (!store.ok) {
      return NextResponse.json({ ok: false, error: store.error }, { status: 403 });
    }

    const itemId = parseItemId(params.itemId);
    if (!itemId.ok) {
      return NextResponse.json({ ok: false, error: itemId.error }, { status: 400 });
    }

    const supabase = await createSupabaseServer();
    const { data } = await supabase.auth.getUser();
    const userId = data?.user?.id ?? null;

    const cookieSession = req.cookies.get(CART_SESSION_COOKIE)?.value ?? null;
    const sessionId = userId ? null : cookieSession;

    const cart = await resolveCart(store.store.id, userId, sessionId);
    if (!cart.ok) {
      return NextResponse.json({ ok: false, error: cart.error }, { status: 404 });
    }

    const existing = cart.cart.items.find((item) => item.id === itemId.id);
    if (!existing) {
      return NextResponse.json({ ok: false, error: "Item nao encontrado." }, { status: 404 });
    }

    await prisma.storeCartItem.delete({ where: { id: existing.id } });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/store/cart/items/[itemId] error:", err);
    return NextResponse.json({ ok: false, error: "Erro ao remover item." }, { status: 500 });
  }
}
