import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { isStoreFeatureEnabled, isStorePublic } from "@/lib/storeAccess";
import { StoreStockPolicy } from "@prisma/client";
import { validateStorePersonalization } from "@/lib/store/personalization";
import { z } from "zod";
import { computeBundleTotals } from "@/lib/store/bundles";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

const CART_SESSION_COOKIE = "orya_store_cart";

const addBundleSchema = z.object({
  bundleId: z.number().int().positive(),
  quantity: z.number().int().positive().optional(),
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

async function _POST(req: NextRequest) {
  try {
    if (!isStoreFeatureEnabled()) {
      return jsonWrap({ ok: false, error: "Loja desativada." }, { status: 403 });
    }

    const storeParsed = parseStoreId(req);
    if (!storeParsed.ok) {
      return jsonWrap({ ok: false, error: storeParsed.error }, { status: 400 });
    }

    const store = await resolveStore(storeParsed.storeId);
    if (!store.ok) {
      return jsonWrap({ ok: false, error: store.error }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    const parsed = addBundleSchema.safeParse(body);
    if (!parsed.success) {
      return jsonWrap({ ok: false, error: "Dados invalidos." }, { status: 400 });
    }

    const payload = parsed.data;
    const bundleQuantity = payload.quantity ?? 1;

    const bundle = await prisma.storeBundle.findFirst({
      where: {
        id: payload.bundleId,
        storeId: store.store.id,
        status: "ACTIVE",
        isVisible: true,
      },
      select: {
        id: true,
        pricingMode: true,
        priceCents: true,
        percentOff: true,
        items: {
          select: {
            id: true,
            quantity: true,
            productId: true,
            variantId: true,
            product: {
              select: {
                id: true,
                priceCents: true,
                currency: true,
                status: true,
                isVisible: true,
                stockPolicy: true,
                stockQty: true,
              },
            },
            variant: {
              select: { id: true, priceCents: true, stockQty: true, isActive: true },
            },
          },
        },
      },
    });

    if (!bundle || !bundle.items.length) {
      return jsonWrap({ ok: false, error: "Bundle indisponivel." }, { status: 404 });
    }
    if (bundle.items.length < 2) {
      return jsonWrap({ ok: false, error: "Bundle invalido." }, { status: 409 });
    }

    for (const item of bundle.items) {
      if (item.product.status !== "ACTIVE" || !item.product.isVisible) {
        return jsonWrap({ ok: false, error: "Bundle indisponivel." }, { status: 409 });
      }
      if (item.product.currency !== store.store.currency) {
        return jsonWrap({ ok: false, error: "Moeda invalida." }, { status: 400 });
      }
      if (item.variant && !item.variant.isActive) {
        return jsonWrap({ ok: false, error: "Variante invalida." }, { status: 400 });
      }
      const personalization = await validateStorePersonalization({
        productId: item.productId,
        personalization: {},
      });
      if (!personalization.ok) {
        return jsonWrap({ ok: false, error: "Bundle requer personalizacao." }, { status: 409 });
      }
    }

    const baseCents = bundle.items.reduce((sum, item) => {
      const unit = item.variant?.priceCents ?? item.product.priceCents;
      return sum + unit * item.quantity * bundleQuantity;
    }, 0);
    const totals = computeBundleTotals({
      pricingMode: bundle.pricingMode,
      priceCents: bundle.priceCents,
      percentOff: bundle.percentOff,
      baseCents,
    });
    if (baseCents <= 0 || totals.totalCents >= baseCents) {
      return jsonWrap({ ok: false, error: "Bundle invalido." }, { status: 409 });
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

    const requiredQtyMap = new Map<string, number>();
    for (const item of bundle.items) {
      const key = `${item.productId}:${item.variantId ?? "base"}`;
      const qty = item.quantity * bundleQuantity;
      requiredQtyMap.set(key, (requiredQtyMap.get(key) ?? 0) + qty);
    }

    for (const item of bundle.items) {
      if (item.product.stockPolicy !== StoreStockPolicy.TRACKED) continue;
      const key = `${item.productId}:${item.variantId ?? "base"}`;
      const requiredQty = requiredQtyMap.get(key) ?? 0;
      const existingQty = resolved.cart.items
        .filter(
          (cartItem) =>
            cartItem.productId === item.productId &&
            cartItem.variantId === (item.variantId ?? null),
        )
        .reduce((sum, cartItem) => sum + cartItem.quantity, 0);
      const available = item.variantId ? item.variant?.stockQty ?? 0 : item.product.stockQty ?? 0;
      if (existingQty + requiredQty > available) {
        return jsonWrap({ ok: false, error: "Stock insuficiente." }, { status: 409 });
      }
    }

    const bundleKey = crypto.randomUUID();

    await prisma.$transaction(async (tx) => {
      for (const item of bundle.items) {
        const unitPriceCents = item.variant?.priceCents ?? item.product.priceCents;
        await tx.storeCartItem.create({
          data: {
            cartId: resolved.cart.id,
            productId: item.productId,
            variantId: item.variantId ?? null,
            quantity: item.quantity * bundleQuantity,
            unitPriceCents,
            personalization: {},
            bundleId: bundle.id,
            bundleKey,
          },
        });
      }
    });

    const response = jsonWrap({ ok: true, bundleKey }) as NextResponse;
    if (!userId && (!cookieSession || resolved.created)) {
      if (!sessionId) {
        return jsonWrap({ ok: false, error: "SESSION_REQUIRED" }, { status: 500 });
      }
      response.cookies.set(CART_SESSION_COOKIE, sessionId, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      });
    }

    return response;
  } catch (err) {
    console.error("POST /api/store/cart/bundles error:", err);
    return jsonWrap({ ok: false, error: "Erro ao adicionar bundle." }, { status: 500 });
  }
}
export const POST = withApiEnvelope(_POST);
