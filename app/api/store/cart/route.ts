import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { isStoreFeatureEnabled, isStorePublic } from "@/lib/storeAccess";
import { computeBundleTotals } from "@/lib/store/bundles";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

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

async function _GET(req: NextRequest) {
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

    let items = [] as Awaited<ReturnType<typeof prisma.storeCartItem.findMany>>;
    try {
      items = await prisma.storeCartItem.findMany({
        where: { cartId: resolved.cart.id },
        orderBy: [{ createdAt: "asc" }],
        select: {
          id: true,
          productId: true,
          variantId: true,
          bundleId: true,
          bundleKey: true,
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
    } catch (err) {
      if (!(err instanceof Prisma.PrismaClientValidationError)) {
        throw err;
      }
      items = await prisma.storeCartItem.findMany({
        where: { cartId: resolved.cart.id },
        orderBy: [{ createdAt: "asc" }],
        select: {
          id: true,
          productId: true,
          variantId: true,
          bundleKey: true,
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
    }

    const bundleItems = items.filter((item) => item.bundleKey);
    const standaloneItems = items.filter((item) => !item.bundleKey);
    const bundleIds = Array.from(
      new Set(
        bundleItems
          .map((item) => ("bundleId" in item ? (item.bundleId as number | null) : null))
          .filter((id): id is number => Boolean(id)),
      ),
    );

    const bundleDefinitions = bundleIds.length
      ? await prisma.storeBundle.findMany({
          where: { id: { in: bundleIds }, storeId: store.store.id },
          select: {
            id: true,
            name: true,
            description: true,
            pricingMode: true,
            priceCents: true,
            percentOff: true,
            items: {
              select: { productId: true, variantId: true, quantity: true },
            },
          },
        })
      : [];

    const bundleMap = new Map(bundleDefinitions.map((bundle) => [bundle.id, bundle]));

    const bundles = Array.from(
      bundleItems.reduce((map, item) => {
        const key = item.bundleKey ?? "unknown";
        const current = map.get(key) ?? [];
        current.push(item);
        map.set(key, current);
        return map;
      }, new Map<string, typeof bundleItems>()),
    ).map(([bundleKey, groupItems]) => {
      const bundleId = groupItems[0]?.bundleId ?? null;
      const bundle = bundleId ? bundleMap.get(bundleId) : null;
      const baseCents = groupItems.reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0);
      const definitionMap = new Map<string, number>();

      if (bundle) {
        bundle.items.forEach((item) => {
          const mapKey = `${item.productId}:${item.variantId ?? "base"}`;
          definitionMap.set(mapKey, item.quantity);
        });
      }

      const bundleQuantity =
        bundle && bundle.items.length
          ? Math.min(
              ...bundle.items.map((item) => {
                const match = groupItems.find(
                  (entry) =>
                    entry.productId === item.productId &&
                    entry.variantId === (item.variantId ?? null),
                );
                if (!match || item.quantity <= 0) return 1;
                return Math.max(1, Math.floor(match.quantity / item.quantity));
              }),
            )
          : 1;

      let totals = bundle
        ? computeBundleTotals({
            pricingMode: bundle.pricingMode,
            priceCents: bundle.priceCents,
            percentOff: bundle.percentOff,
            baseCents,
            bundleQuantity,
          })
        : { totalCents: baseCents, discountCents: 0 };
      if (bundle && (bundle.items.length < 2 || baseCents <= 0 || totals.totalCents >= baseCents)) {
        totals = { totalCents: baseCents, discountCents: 0 };
      }

      return {
        bundleKey,
        bundleId,
        name: bundle?.name ?? "Bundle",
        description: bundle?.description ?? null,
        pricingMode: bundle?.pricingMode ?? "FIXED",
        priceCents: bundle?.priceCents ?? null,
        percentOff: bundle?.percentOff ?? null,
        baseCents,
        totalCents: totals.totalCents,
        discountCents: totals.discountCents,
        quantity: bundleQuantity,
        items: groupItems.map((item) => {
          const itemKey = `${item.productId}:${item.variantId ?? "base"}`;
          const perBundleQty = definitionMap.get(itemKey) ?? item.quantity;
          return {
            id: item.id,
            productId: item.productId,
            variantId: item.variantId,
            quantity: item.quantity,
            perBundleQty,
            unitPriceCents: item.unitPriceCents,
            product: item.product,
            variant: item.variant,
          };
        }),
      };
    });

    const response = jsonWrap({
      ok: true,
      cart: {
        id: resolved.cart.id,
        storeId: resolved.cart.storeId,
        currency: resolved.cart.currency,
        items: standaloneItems,
        bundles,
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
    return jsonWrap({ ok: false, error: "Erro ao carregar carrinho." }, { status: 500 });
  }
}
export const GET = withApiEnvelope(_GET);