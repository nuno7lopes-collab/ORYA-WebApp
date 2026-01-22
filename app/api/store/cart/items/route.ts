import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { isStoreFeatureEnabled, isStorePublic } from "@/lib/storeAccess";
import { StoreStockPolicy } from "@prisma/client";
import { validateStorePersonalization } from "@/lib/store/personalization";
import { z } from "zod";

const CART_SESSION_COOKIE = "orya_store_cart";

const addItemSchema = z.object({
  productId: z.number().int().positive(),
  variantId: z.number().int().positive().optional().nullable(),
  quantity: z.number().int().positive().optional(),
  personalization: z.any().optional(),
});

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
    select: { id: true, status: true, showOnProfile: true, catalogLocked: true, currency: true },
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

async function resolveCart(params: {
  storeId: number;
  currency: string;
  userId: string | null;
  sessionId: string | null;
}) {
  if (params.userId) {
    const cart = await prisma.storeCart.findFirst({
      where: { storeId: params.storeId, userId: params.userId, status: "ACTIVE" },
      include: { items: true },
    });
    if (cart) return { ok: true as const, cart };
  }

  if (params.sessionId) {
    const cart = await prisma.storeCart.findFirst({
      where: { storeId: params.storeId, sessionId: params.sessionId, status: "ACTIVE" },
      include: { items: true },
    });
    if (cart) return { ok: true as const, cart };
  }

  const cart = await prisma.storeCart.create({
    data: {
      storeId: params.storeId,
      userId: params.userId ?? null,
      sessionId: params.userId ? null : params.sessionId,
      currency: params.currency,
    },
    include: { items: true },
  });
  return { ok: true as const, cart, created: true };
}

export async function POST(req: NextRequest) {
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

    const body = await req.json().catch(() => null);
    const parsed = addItemSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Dados invalidos." }, { status: 400 });
    }

    const payload = parsed.data;
    const quantity = payload.quantity ?? 1;

    const product = await prisma.storeProduct.findFirst({
      where: {
        id: payload.productId,
        storeId: store.store.id,
        status: "ACTIVE",
        isVisible: true,
      },
      select: {
        id: true,
        priceCents: true,
        currency: true,
        requiresShipping: true,
        stockPolicy: true,
        stockQty: true,
      },
    });
    if (!product) {
      return NextResponse.json({ ok: false, error: "Produto indisponivel." }, { status: 404 });
    }
    if (product.currency !== store.store.currency) {
      return NextResponse.json({ ok: false, error: "Moeda invalida." }, { status: 400 });
    }

    let variantPriceCents: number | null = null;
    let variantStockQty: number | null = null;
    if (payload.variantId) {
      const variant = await prisma.storeProductVariant.findFirst({
        where: { id: payload.variantId, productId: payload.productId, isActive: true },
        select: { id: true, priceCents: true, stockQty: true },
      });
      if (!variant) {
        return NextResponse.json({ ok: false, error: "Variante invalida." }, { status: 400 });
      }
      variantPriceCents = variant.priceCents ?? null;
      variantStockQty = variant.stockQty ?? null;
    }

    const personalizationDelta = await validateStorePersonalization({
      productId: product.id,
      personalization: payload.personalization,
    });
    if (!personalizationDelta.ok) {
      return NextResponse.json({ ok: false, error: personalizationDelta.error }, { status: 400 });
    }

    const basePrice = variantPriceCents ?? product.priceCents;
    const unitPriceCents = basePrice + personalizationDelta.deltaCents;

    const supabase = await createSupabaseServer();
    const { data } = await supabase.auth.getUser();
    const userId = data?.user?.id ?? null;

    const cookieSession = req.cookies.get(CART_SESSION_COOKIE)?.value ?? null;
    const sessionId = userId ? null : cookieSession ?? crypto.randomUUID();

    const resolved = await resolveCart({
      storeId: store.store.id,
      currency: store.store.currency,
      userId,
      sessionId,
    });

    if (product.stockPolicy === StoreStockPolicy.TRACKED) {
      const available = payload.variantId ? variantStockQty ?? 0 : product.stockQty ?? 0;
      const existingQty = resolved.cart.items
        .filter((item) => item.productId === payload.productId && item.variantId === (payload.variantId ?? null))
        .reduce((sum, item) => sum + item.quantity, 0);
      const nextQty = existingQty + quantity;
      if (nextQty > available) {
        return NextResponse.json({ ok: false, error: "Stock insuficiente." }, { status: 409 });
      }
    }

    const personalization = personalizationDelta.normalized;
    const personalizationKey = JSON.stringify(personalization ?? {});
    const existingItem = resolved.cart.items.find((item) => {
      const itemKey = JSON.stringify(item.personalization ?? {});
      return (
        item.productId === payload.productId &&
        item.variantId === (payload.variantId ?? null) &&
        !item.bundleKey &&
        itemKey === personalizationKey
      );
    });

    const result = existingItem
      ? await prisma.storeCartItem.update({
          where: { id: existingItem.id },
          data: { quantity: existingItem.quantity + quantity },
          select: {
            id: true,
            cartId: true,
            productId: true,
            variantId: true,
            quantity: true,
            unitPriceCents: true,
            personalization: true,
          },
        })
      : await prisma.storeCartItem.create({
          data: {
            cartId: resolved.cart.id,
            productId: payload.productId,
            variantId: payload.variantId ?? null,
            quantity,
            unitPriceCents,
            personalization,
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

    const response = NextResponse.json({ ok: true, item: result });
    if (!userId && (!cookieSession || resolved.created)) {
      response.cookies.set(CART_SESSION_COOKIE, sessionId, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      });
    }

    return response;
  } catch (err) {
    console.error("POST /api/store/cart/items error:", err);
    return NextResponse.json({ ok: false, error: "Erro ao adicionar item." }, { status: 500 });
  }
}
