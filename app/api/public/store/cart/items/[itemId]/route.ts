import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { isStoreFeatureEnabled, isPublicStore } from "@/lib/storeAccess";
import { Prisma, StoreStockPolicy } from "@prisma/client";
import { validateStorePersonalization } from "@/lib/store/personalization";
import { getPublicStorePaymentsGate } from "@/lib/store/publicPaymentsGate";
import { z } from "zod";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

const CART_SESSION_COOKIE = "orya_store_cart";

const updateItemSchema = z
  .object({
    quantity: z.number().int().positive().optional(),
    personalization: z.any().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: "Sem dados." });

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
    select: {
      id: true,
      status: true,
      showOnProfile: true,
      catalogLocked: true,
      organization: {
        select: {
          orgType: true,
          officialEmail: true,
          officialEmailVerifiedAt: true,
          stripeAccountId: true,
          stripeChargesEnabled: true,
          stripePayoutsEnabled: true,
        },
      },
    },
  });
  if (!store) {
    return { ok: false as const, error: "Store nao encontrada." };
  }
  if (!isPublicStore(store)) {
    return { ok: false as const, error: "Loja fechada." };
  }
  if (store.catalogLocked) {
    return { ok: false as const, error: "Catalogo bloqueado." };
  }
  const paymentsGate = getPublicStorePaymentsGate({
    orgType: store.organization?.orgType,
    officialEmail: store.organization?.officialEmail,
    officialEmailVerifiedAt: store.organization?.officialEmailVerifiedAt,
    stripeAccountId: store.organization?.stripeAccountId,
    stripeChargesEnabled: store.organization?.stripeChargesEnabled,
    stripePayoutsEnabled: store.organization?.stripePayoutsEnabled,
  });
  if (!paymentsGate.ok) {
    return { ok: false as const, error: "PAYMENTS_NOT_READY" };
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

async function _PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ itemId: string }> },
) {
  try {
    const resolvedParams = await params;
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

    const itemId = parseItemId(resolvedParams.itemId);
    if (!itemId.ok) {
      return jsonWrap({ ok: false, error: itemId.error }, { status: 400 });
    }

    const body = await req.json().catch(() => null);
    const parsed = updateItemSchema.safeParse(body);
    if (!parsed.success) {
      return jsonWrap({ ok: false, error: "Dados invalidos." }, { status: 400 });
    }

    const supabase = await createSupabaseServer();
    const { data } = await supabase.auth.getUser();
    const userId = data?.user?.id ?? null;

    const cookieSession = req.cookies.get(CART_SESSION_COOKIE)?.value ?? null;
    const sessionId = userId ? null : cookieSession;

    const cart = await resolveCart(store.store.id, userId, sessionId);
    if (!cart.ok) {
      return jsonWrap({ ok: false, error: cart.error }, { status: 404 });
    }

    const existing = cart.cart.items.find((item) => item.id === itemId.id);
    if (!existing) {
      return jsonWrap({ ok: false, error: "Item nao encontrado." }, { status: 404 });
    }
    if (existing.bundleKey) {
      return jsonWrap({ ok: false, error: "Item pertence a um bundle." }, { status: 409 });
    }

    const payload = parsed.data;
    const nextQuantity = payload.quantity ?? existing.quantity;

    const product = await prisma.storeProduct.findFirst({
      where: { id: existing.productId, storeId: store.store.id },
      select: { id: true, priceCents: true, stockPolicy: true, stockQty: true },
    });
    if (!product) {
      return jsonWrap({ ok: false, error: "Produto indisponivel." }, { status: 404 });
    }

    let variantPriceCents: number | null = null;
    let variantStockQty: number | null = null;
    if (existing.variantId) {
      const variant = await prisma.storeProductVariant.findFirst({
        where: { id: existing.variantId, productId: existing.productId, isActive: true },
        select: { id: true, priceCents: true, stockQty: true },
      });
      if (!variant) {
        return jsonWrap({ ok: false, error: "Variante invalida." }, { status: 400 });
      }
      variantPriceCents = variant.priceCents ?? null;
      variantStockQty = variant.stockQty ?? null;
    }

    if (product.stockPolicy === StoreStockPolicy.TRACKED) {
      const available = existing.variantId ? variantStockQty ?? 0 : product.stockQty ?? 0;
      const otherQty = cart.cart.items
        .filter(
          (item) =>
            item.id !== existing.id &&
            item.productId === existing.productId &&
            item.variantId === (existing.variantId ?? null),
        )
        .reduce((sum, item) => sum + item.quantity, 0);
      const nextTotal = otherQty + nextQuantity;
      if (nextTotal > available) {
        return jsonWrap({ ok: false, error: "Stock insuficiente." }, { status: 409 });
      }
    }

    let unitPriceCents = existing.unitPriceCents;
    let nextPersonalization = existing.personalization;
    if (payload.personalization !== undefined) {
      const personalizationDelta = await validateStorePersonalization({
        productId: product.id,
        personalization: payload.personalization,
      });
      if (!personalizationDelta.ok) {
        return jsonWrap({ ok: false, error: personalizationDelta.error }, { status: 400 });
      }
      const basePrice = variantPriceCents ?? product.priceCents;
      unitPriceCents = basePrice + personalizationDelta.deltaCents;
      nextPersonalization = personalizationDelta.normalized;
    }

    const personalizationValue =
      payload.personalization !== undefined ? nextPersonalization : existing.personalization;
    const personalizationPayload = (personalizationValue ?? Prisma.DbNull) as Prisma.InputJsonValue;

    const updated = await prisma.storeCartItem.update({
      where: { id: existing.id },
      data: {
        quantity: payload.quantity ?? existing.quantity,
        personalization: personalizationPayload,
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

    return jsonWrap({ ok: true, item: updated });
  } catch (err) {
    console.error("PATCH /api/public/store/cart/items/[itemId] error:", err);
    return jsonWrap({ ok: false, error: "Erro ao atualizar item." }, { status: 500 });
  }
}

async function _DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ itemId: string }> },
) {
  try {
    const resolvedParams = await params;
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

    const itemId = parseItemId(resolvedParams.itemId);
    if (!itemId.ok) {
      return jsonWrap({ ok: false, error: itemId.error }, { status: 400 });
    }

    const supabase = await createSupabaseServer();
    const { data } = await supabase.auth.getUser();
    const userId = data?.user?.id ?? null;

    const cookieSession = req.cookies.get(CART_SESSION_COOKIE)?.value ?? null;
    const sessionId = userId ? null : cookieSession;

    const cart = await resolveCart(store.store.id, userId, sessionId);
    if (!cart.ok) {
      return jsonWrap({ ok: false, error: cart.error }, { status: 404 });
    }

    const existing = cart.cart.items.find((item) => item.id === itemId.id);
    if (!existing) {
      return jsonWrap({ ok: false, error: "Item nao encontrado." }, { status: 404 });
    }
    if (existing.bundleKey) {
      return jsonWrap({ ok: false, error: "Item pertence a um bundle." }, { status: 409 });
    }

    await prisma.storeCartItem.delete({ where: { id: existing.id } });

    return jsonWrap({ ok: true });
  } catch (err) {
    console.error("DELETE /api/public/store/cart/items/[itemId] error:", err);
    return jsonWrap({ ok: false, error: "Erro ao remover item." }, { status: 500 });
  }
}
export const PATCH = withApiEnvelope(_PATCH);
export const DELETE = withApiEnvelope(_DELETE);
