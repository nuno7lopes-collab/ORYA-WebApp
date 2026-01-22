import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { isStoreFeatureEnabled, isStorePublic } from "@/lib/storeAccess";
import { StoreStockPolicy } from "@prisma/client";
import { z } from "zod";

const CART_SESSION_COOKIE = "orya_store_cart";

const updateBundleSchema = z
  .object({
    quantity: z.number().int().positive(),
  })
  .strict();

function parseStoreId(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("storeId");
  const storeId = raw ? Number(raw) : null;
  if (!storeId || !Number.isFinite(storeId)) {
    return { ok: false as const, error: "Store invalida." };
  }
  return { ok: true as const, storeId };
}

async function resolveStore(storeId: number) {
  const store = await prisma.store.findFirst({
    where: { id: storeId },
    select: { id: true, status: true, showOnProfile: true, catalogLocked: true },
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

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ bundleKey: string }> },
) {
  try {
    const resolvedParams = await params;
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

    const body = await req.json().catch(() => null);
    const parsed = updateBundleSchema.safeParse(body);
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

    const bundleKey = resolvedParams.bundleKey;
    const bundleItems = cart.cart.items.filter((item) => item.bundleKey === bundleKey);
    if (!bundleItems.length) {
      return NextResponse.json({ ok: false, error: "Bundle nao encontrado." }, { status: 404 });
    }

    const bundleId = bundleItems[0].bundleId;
    if (!bundleId) {
      return NextResponse.json({ ok: false, error: "Bundle invalido." }, { status: 404 });
    }

    const bundle = await prisma.storeBundle.findFirst({
      where: { id: bundleId, storeId: store.store.id },
      select: {
        id: true,
        items: {
          select: {
            id: true,
            quantity: true,
            productId: true,
            variantId: true,
            product: { select: { stockPolicy: true, stockQty: true } },
            variant: { select: { stockQty: true } },
          },
        },
      },
    });
    if (!bundle || !bundle.items.length) {
      return NextResponse.json({ ok: false, error: "Bundle indisponivel." }, { status: 409 });
    }

    const nextQuantity = parsed.data.quantity;
    const requiredQtyMap = new Map<string, number>();

    for (const item of bundle.items) {
      const key = `${item.productId}:${item.variantId ?? "base"}`;
      requiredQtyMap.set(key, (requiredQtyMap.get(key) ?? 0) + item.quantity * nextQuantity);
    }

    for (const item of bundle.items) {
      if (item.product.stockPolicy !== StoreStockPolicy.TRACKED) continue;
      const key = `${item.productId}:${item.variantId ?? "base"}`;
      const requiredQty = requiredQtyMap.get(key) ?? 0;
      const otherQty = cart.cart.items
        .filter(
          (cartItem) =>
            cartItem.bundleKey !== bundleKey &&
            cartItem.productId === item.productId &&
            cartItem.variantId === (item.variantId ?? null),
        )
        .reduce((sum, cartItem) => sum + cartItem.quantity, 0);
      const available = item.variantId ? item.variant?.stockQty ?? 0 : item.product.stockQty ?? 0;
      if (otherQty + requiredQty > available) {
        return NextResponse.json({ ok: false, error: "Stock insuficiente." }, { status: 409 });
      }
    }

    await prisma.$transaction(async (tx) => {
      for (const item of bundle.items) {
        await tx.storeCartItem.updateMany({
          where: {
            cartId: cart.cart.id,
            bundleKey,
            productId: item.productId,
            variantId: item.variantId ?? null,
          },
          data: { quantity: item.quantity * nextQuantity },
        });
      }
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("PATCH /api/store/cart/bundles/[bundleKey] error:", err);
    return NextResponse.json({ ok: false, error: "Erro ao atualizar bundle." }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ bundleKey: string }> },
) {
  try {
    const resolvedParams = await params;
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

    const supabase = await createSupabaseServer();
    const { data } = await supabase.auth.getUser();
    const userId = data?.user?.id ?? null;

    const cookieSession = req.cookies.get(CART_SESSION_COOKIE)?.value ?? null;
    const sessionId = userId ? null : cookieSession;

    const cart = await resolveCart(store.store.id, userId, sessionId);
    if (!cart.ok) {
      return NextResponse.json({ ok: false, error: cart.error }, { status: 404 });
    }

    const bundleKey = resolvedParams.bundleKey;
    const bundleItems = cart.cart.items.filter((item) => item.bundleKey === bundleKey);
    if (!bundleItems.length) {
      return NextResponse.json({ ok: false, error: "Bundle nao encontrado." }, { status: 404 });
    }

    await prisma.storeCartItem.deleteMany({
      where: { cartId: cart.cart.id, bundleKey },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/store/cart/bundles/[bundleKey] error:", err);
    return NextResponse.json({ ok: false, error: "Erro ao remover bundle." }, { status: 500 });
  }
}
