import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { isStoreFeatureEnabled, isStorePublic } from "@/lib/storeAccess";

const CART_SESSION_COOKIE = "orya_store_cart";

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
    select: { id: true, status: true, catalogLocked: true, currency: true },
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

export async function GET(req: NextRequest) {
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

    const items = await prisma.storeCartItem.findMany({
      where: { cartId: resolved.cart.id },
      orderBy: [{ createdAt: "asc" }],
      select: {
        id: true,
        productId: true,
        variantId: true,
        quantity: true,
        unitPriceCents: true,
        personalization: true,
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
            priceCents: true,
            compareAtPriceCents: true,
            currency: true,
            requiresShipping: true,
            images: {
              select: { url: true, altText: true, isPrimary: true, sortOrder: true },
              orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
            },
          },
        },
        variant: {
          select: { id: true, label: true, priceCents: true },
        },
      },
    });

    const response = NextResponse.json({
      ok: true,
      cart: {
        id: resolved.cart.id,
        storeId: resolved.cart.storeId,
        currency: resolved.cart.currency,
        items,
      },
    });

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
    console.error("GET /api/store/cart error:", err);
    return NextResponse.json({ ok: false, error: "Erro ao carregar carrinho." }, { status: 500 });
  }
}
