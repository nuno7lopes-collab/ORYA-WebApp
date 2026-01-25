export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { createPaymentIntent } from "@/domain/finance/gateway/stripeGateway";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { isStoreFeatureEnabled, canCheckoutStore } from "@/lib/storeAccess";
import { SourceType, StoreAddressType, StoreOrderStatus, StoreStockPolicy } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { createPurchaseId } from "@/lib/checkoutSchemas";
import { computePricing } from "@/lib/pricing";
import { computeCombinedFees } from "@/lib/fees";
import { getPlatformFees, getStripeBaseFees } from "@/lib/platformSettings";
import { formatPaidSalesGateMessage, getPaidSalesGate } from "@/lib/organizationPayments";
import { computeStoreShippingQuote } from "@/lib/store/shipping";
import { validateStorePersonalization } from "@/lib/store/personalization";
import { computeBundleTotals } from "@/lib/store/bundles";
import { computePromoDiscountCents } from "@/lib/promoMath";

const CART_SESSION_COOKIE = "orya_store_cart";

const addressSchema = z.object({
  fullName: z.string().trim().min(1).max(160),
  line1: z.string().trim().min(1).max(160),
  line2: z.string().trim().max(160).optional().nullable(),
  city: z.string().trim().min(1).max(120),
  region: z.string().trim().max(120).optional().nullable(),
  postalCode: z.string().trim().min(1).max(32),
  country: z.string().trim().min(2).max(3),
  nif: z.string().trim().max(32).optional().nullable(),
});

const checkoutSchema = z.object({
  customer: z.object({
    email: z.string().email().trim(),
    name: z.string().trim().min(1).max(160),
    phone: z.string().trim().max(32).optional().nullable(),
  }),
  shippingAddress: addressSchema.optional().nullable(),
  billingAddress: addressSchema.optional().nullable(),
  shippingMethodId: z.number().int().positive().optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  purchaseId: z.string().trim().max(120).optional(),
  promoCode: z.string().trim().max(60).optional().nullable(),
});

function parseStoreId(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("storeId");
  const storeId = raw ? Number(raw) : null;
  if (!storeId || !Number.isFinite(storeId)) {
    return { ok: false as const, error: "Store invalida." };
  }
  return { ok: true as const, storeId };
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

function buildOrderNumber(storeId: number) {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `ORD-${storeId}-${stamp}-${rand}`;
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

    const store = await prisma.store.findFirst({
      where: { id: storeParsed.storeId },
      select: {
        id: true,
        status: true,
        checkoutEnabled: true,
        showOnProfile: true,
        catalogLocked: true,
        currency: true,
        ownerOrganizationId: true,
        ownerUserId: true,
      },
    });
    if (!store) {
      return NextResponse.json({ ok: false, error: "Store nao encontrada." }, { status: 404 });
    }
    if (!canCheckoutStore(store)) {
      return NextResponse.json({ ok: false, error: "Checkout indisponivel." }, { status: 403 });
    }
    if (store.catalogLocked) {
      return NextResponse.json({ ok: false, error: "Catalogo bloqueado." }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    const parsed = checkoutSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Dados invalidos." }, { status: 400 });
    }

    const payload = parsed.data;
    const supabase = await createSupabaseServer();
    const { data } = await supabase.auth.getUser();
    const userId = data?.user?.id ?? null;

    const cookieSession = req.cookies.get(CART_SESSION_COOKIE)?.value ?? null;
    const sessionId = userId ? null : cookieSession;
    const cart = await resolveCart(store.id, userId, sessionId);
    if (!cart.ok) {
      return NextResponse.json({ ok: false, error: cart.error }, { status: 404 });
    }
    if (!cart.cart.items.length) {
      return NextResponse.json({ ok: false, error: "Carrinho vazio." }, { status: 409 });
    }

    const bundleItems = cart.cart.items.filter((item) => item.bundleKey);
    const standaloneItems = cart.cart.items.filter((item) => !item.bundleKey);

    const productIds = Array.from(new Set(cart.cart.items.map((item) => item.productId)));
    const products = await prisma.storeProduct.findMany({
      where: { id: { in: productIds }, storeId: store.id },
      select: {
        id: true,
        name: true,
        sku: true,
        priceCents: true,
        currency: true,
        status: true,
        isVisible: true,
        requiresShipping: true,
        stockPolicy: true,
        stockQty: true,
      },
    });
    const productMap = new Map(products.map((product) => [product.id, product]));

    const variantIds = cart.cart.items
      .map((item) => item.variantId)
      .filter((id): id is number => Boolean(id));
    const variants = variantIds.length
      ? await prisma.storeProductVariant.findMany({
          where: { id: { in: variantIds } },
          select: { id: true, productId: true, label: true, sku: true, priceCents: true, stockQty: true, isActive: true },
        })
      : [];
    const variantMap = new Map(variants.map((variant) => [variant.id, variant]));

    const bundleIds = Array.from(
      new Set(bundleItems.map((item) => item.bundleId).filter((id): id is number => Boolean(id))),
    );
    const bundleDefinitions = bundleIds.length
      ? await prisma.storeBundle.findMany({
          where: { id: { in: bundleIds }, storeId: store.id },
          select: {
            id: true,
            name: true,
            status: true,
            isVisible: true,
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

    type LineDraft = {
      productId: number;
      variantId: number | null;
      nameSnapshot: string;
      skuSnapshot: string | null;
      quantity: number;
      unitPriceCents: number;
      discountCents: number;
      totalCents: number;
      requiresShipping: boolean;
      personalization: unknown;
      bundleKey?: string | null;
    };

    type BundleDraft = {
      bundleKey: string;
      bundleId: number;
      nameSnapshot: string;
      pricingMode: typeof bundleDefinitions[number]["pricingMode"];
      priceCents: number | null;
      percentOff: number | null;
      bundleQuantity: number;
      totalCents: number;
      items: Array<{
        productId: number;
        variantId: number | null;
        quantity: number;
        nameSnapshot: string;
        skuSnapshot: string | null;
      }>;
    };

    const lineDrafts: LineDraft[] = [];
    const bundleDrafts: BundleDraft[] = [];
    let baseSubtotalCents = 0;
    let bundleDiscountCents = 0;
    let requiresShipping = false;
    const requestedQtyMap = new Map<string, number>();
    let totalQuantity = 0;

    for (const item of cart.cart.items) {
      const key = `${item.productId}:${item.variantId ?? "base"}`;
      requestedQtyMap.set(key, (requestedQtyMap.get(key) ?? 0) + item.quantity);
    }

    for (const item of cart.cart.items) {
      const product = productMap.get(item.productId);
      if (!product || product.status !== "ACTIVE" || !product.isVisible) {
        return NextResponse.json({ ok: false, error: "Produto indisponivel." }, { status: 409 });
      }
      if (product.currency !== store.currency) {
        return NextResponse.json({ ok: false, error: "Moeda invalida." }, { status: 400 });
      }

      let variant: typeof variants[number] | null = null;
      if (item.variantId) {
        const found = variantMap.get(item.variantId);
        if (!found || found.productId !== product.id || !found.isActive) {
          return NextResponse.json({ ok: false, error: "Variante invalida." }, { status: 400 });
        }
        variant = found;
      }

      if (product.stockPolicy === StoreStockPolicy.TRACKED) {
        const key = `${item.productId}:${item.variantId ?? "base"}`;
        const requestedQty = requestedQtyMap.get(key) ?? item.quantity;
        const available = variant ? variant.stockQty ?? 0 : product.stockQty ?? 0;
        if (requestedQty > available) {
          return NextResponse.json({ ok: false, error: "Stock insuficiente." }, { status: 409 });
        }
      }
    }

    const bundleGroups = bundleItems.reduce((map, item) => {
      const key = item.bundleKey ?? "unknown";
      const current = map.get(key) ?? [];
      current.push(item);
      map.set(key, current);
      return map;
    }, new Map<string, typeof bundleItems>());

    for (const [bundleKey, groupItems] of bundleGroups.entries()) {
      const bundleId = groupItems[0]?.bundleId;
      if (!bundleId) {
        return NextResponse.json({ ok: false, error: "Bundle invalido." }, { status: 400 });
      }
      const bundle = bundleMap.get(bundleId);
      if (!bundle || bundle.status !== "ACTIVE" || !bundle.isVisible) {
        return NextResponse.json({ ok: false, error: "Bundle indisponivel." }, { status: 409 });
      }

      const definitionMap = new Map<string, number>();
      bundle.items.forEach((item) => {
        const mapKey = `${item.productId}:${item.variantId ?? "base"}`;
        definitionMap.set(mapKey, item.quantity);
      });

      const bundleQuantity =
        bundle.items.length > 0
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

      for (const item of bundle.items) {
        const match = groupItems.find(
          (entry) =>
            entry.productId === item.productId &&
            entry.variantId === (item.variantId ?? null),
        );
        if (!match || match.quantity % item.quantity !== 0) {
          return NextResponse.json({ ok: false, error: "Bundle invalido." }, { status: 409 });
        }
      }

      const baseCents = groupItems.reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0);
      const totals = computeBundleTotals({
        pricingMode: bundle.pricingMode,
        priceCents: bundle.priceCents,
        percentOff: bundle.percentOff,
        baseCents,
        bundleQuantity,
      });
      if (bundle.items.length < 2 || baseCents <= 0 || totals.totalCents >= baseCents) {
        return NextResponse.json({ ok: false, error: "Bundle invalido." }, { status: 409 });
      }

      baseSubtotalCents += baseCents;
      bundleDiscountCents += totals.discountCents;

      const draftItems: BundleDraft["items"] = [];
      for (const item of bundle.items) {
        const product = productMap.get(item.productId);
        const variant = item.variantId ? variantMap.get(item.variantId) : null;
        if (!product) {
          return NextResponse.json({ ok: false, error: "Produto indisponivel." }, { status: 409 });
        }
        if (item.variantId && !variant) {
          return NextResponse.json({ ok: false, error: "Variante invalida." }, { status: 400 });
        }
        draftItems.push({
          productId: item.productId,
          variantId: item.variantId ?? null,
          quantity: item.quantity * bundleQuantity,
          nameSnapshot: variant ? `${product.name} - ${variant.label}` : product.name,
          skuSnapshot: variant?.sku ?? product.sku ?? null,
        });
      }

      bundleDrafts.push({
        bundleKey,
        bundleId: bundle.id,
        nameSnapshot: bundle.name,
        pricingMode: bundle.pricingMode,
        priceCents: bundle.priceCents,
        percentOff: bundle.percentOff,
        bundleQuantity,
        totalCents: totals.totalCents,
        items: draftItems,
      });

      let remainingDiscount = totals.discountCents;
      for (let index = 0; index < groupItems.length; index += 1) {
        const item = groupItems[index];
        const product = productMap.get(item.productId);
        if (!product) {
          return NextResponse.json({ ok: false, error: "Produto indisponivel." }, { status: 409 });
        }
        const variant = item.variantId ? variantMap.get(item.variantId) : null;
        const personalizationDelta = await validateStorePersonalization({
          productId: product.id,
          personalization: item.personalization,
        });
        if (!personalizationDelta.ok) {
          throw new Error(personalizationDelta.error);
        }

        const baseLineTotal = item.unitPriceCents * item.quantity;
        const discountShare =
          totals.discountCents > 0
            ? index === groupItems.length - 1
              ? remainingDiscount
              : Math.round((baseLineTotal / baseCents) * totals.discountCents)
            : 0;
        remainingDiscount -= discountShare;

        const lineTotal = Math.max(0, baseLineTotal - discountShare);
        requiresShipping = requiresShipping || product.requiresShipping;

        lineDrafts.push({
          productId: product.id,
          variantId: variant?.id ?? null,
          nameSnapshot: variant ? `${product.name} - ${variant.label}` : product.name,
          skuSnapshot: variant?.sku ?? product.sku ?? null,
          quantity: item.quantity,
          unitPriceCents: item.unitPriceCents,
          discountCents: discountShare,
          totalCents: lineTotal,
          requiresShipping: product.requiresShipping,
          personalization: personalizationDelta.normalized ?? {},
          bundleKey,
        });
        totalQuantity += item.quantity;
      }
    }

    for (const item of standaloneItems) {
      const product = productMap.get(item.productId);
      if (!product) {
        return NextResponse.json({ ok: false, error: "Produto indisponivel." }, { status: 409 });
      }

      let variant: typeof variants[number] | null = null;
      if (item.variantId) {
        const found = variantMap.get(item.variantId);
        if (!found || found.productId !== product.id || !found.isActive) {
          return NextResponse.json({ ok: false, error: "Variante invalida." }, { status: 400 });
        }
        variant = found;
      }

      const personalizationDelta = await validateStorePersonalization({
        productId: product.id,
        personalization: item.personalization,
      });
      if (!personalizationDelta.ok) {
        return NextResponse.json({ ok: false, error: personalizationDelta.error }, { status: 400 });
      }

      const unitPriceCents = item.unitPriceCents;
      const totalCents = unitPriceCents * item.quantity;
      baseSubtotalCents += totalCents;
      requiresShipping = requiresShipping || product.requiresShipping;

      lineDrafts.push({
        productId: product.id,
        variantId: variant?.id ?? null,
        nameSnapshot: variant ? `${product.name} - ${variant.label}` : product.name,
        skuSnapshot: variant?.sku ?? product.sku ?? null,
        quantity: item.quantity,
        unitPriceCents,
        discountCents: 0,
        totalCents,
        requiresShipping: product.requiresShipping,
        personalization: personalizationDelta.normalized ?? {},
      });
      totalQuantity += item.quantity;
    }

    const subtotalCents = Math.max(0, baseSubtotalCents - bundleDiscountCents);
    let promoDiscountCents = 0;
    let promoCodeId: number | null = null;
    let promoCodeLabel: string | null = null;

    const promoCodeInput = payload.promoCode?.trim();
    if (promoCodeInput) {
      const nowDate = new Date();
      const promoScopes: Prisma.PromoCodeWhereInput[] = [];
      if (store.ownerOrganizationId) {
        promoScopes.push({ organizationId: store.ownerOrganizationId });
      }
      if (store.ownerUserId) {
        promoScopes.push({ promoterUserId: store.ownerUserId });
      }
      promoScopes.push({ organizationId: null });

      const promo = await prisma.promoCode.findFirst({
        where: {
          code: { equals: promoCodeInput, mode: "insensitive" },
          active: true,
          eventId: null,
          ...(promoScopes.length ? { OR: promoScopes } : {}),
        },
        select: {
          id: true,
          code: true,
          type: true,
          value: true,
          minQuantity: true,
          minTotalCents: true,
          maxUses: true,
          perUserLimit: true,
          validFrom: true,
          validUntil: true,
        },
      });

      if (!promo) {
        return NextResponse.json({ ok: false, error: "Codigo promocional invalido." }, { status: 400 });
      }
      if (promo.validFrom && promo.validFrom > nowDate) {
        return NextResponse.json({ ok: false, error: "Codigo promocional ainda nao esta ativo." }, { status: 400 });
      }
      if (promo.validUntil && promo.validUntil < nowDate) {
        return NextResponse.json({ ok: false, error: "Codigo promocional expirado." }, { status: 400 });
      }
      if (promo.minQuantity !== null && totalQuantity < promo.minQuantity) {
        return NextResponse.json({ ok: false, error: "Quantidade insuficiente para aplicar o codigo." }, { status: 400 });
      }
      if (promo.minTotalCents !== null && subtotalCents < promo.minTotalCents) {
        return NextResponse.json({ ok: false, error: "Valor minimo nao atingido para aplicar o codigo." }, { status: 400 });
      }
      const totalUses = await prisma.promoRedemption.count({ where: { promoCodeId: promo.id } });
      if (promo.maxUses !== null && totalUses >= promo.maxUses) {
        return NextResponse.json({ ok: false, error: "Codigo promocional esgotado." }, { status: 400 });
      }
      if (promo.perUserLimit !== null) {
        if (userId) {
          const userUses = await prisma.promoRedemption.count({ where: { promoCodeId: promo.id, userId } });
          if (userUses >= promo.perUserLimit) {
            return NextResponse.json({ ok: false, error: "Ja usaste este codigo o maximo de vezes." }, { status: 400 });
          }
        } else if (payload.customer.email) {
          const guestUses = await prisma.promoRedemption.count({
            where: { promoCodeId: promo.id, guestEmail: { equals: payload.customer.email, mode: "insensitive" } },
          });
          if (guestUses >= promo.perUserLimit) {
            return NextResponse.json({ ok: false, error: "Ja usaste este codigo o maximo de vezes." }, { status: 400 });
          }
        }
      }

      promoDiscountCents = computePromoDiscountCents({
        promo: {
          type: promo.type,
          value: promo.value,
          minQuantity: promo.minQuantity,
          minTotalCents: promo.minTotalCents,
        },
        totalQuantity,
        amountInCents: subtotalCents,
      });
      if (promoDiscountCents <= 0) {
        return NextResponse.json({ ok: false, error: "Codigo promocional nao aplicavel." }, { status: 400 });
      }
      promoCodeId = promo.id;
      promoCodeLabel = promo.code;
    }

    const orderDiscountCents = bundleDiscountCents + promoDiscountCents;

    if (requiresShipping && !payload.shippingAddress) {
      return NextResponse.json({ ok: false, error: "Morada obrigatoria." }, { status: 400 });
    }

    const organization = store.ownerOrganizationId
      ? await prisma.organization.findUnique({
          where: { id: store.ownerOrganizationId },
          select: {
            id: true,
            orgType: true,
            stripeAccountId: true,
            stripeChargesEnabled: true,
            stripePayoutsEnabled: true,
            officialEmail: true,
            officialEmailVerifiedAt: true,
            feeMode: true,
            platformFeeBps: true,
            platformFeeFixedCents: true,
          },
        })
      : null;

    const isPlatformOrg = organization?.orgType === "PLATFORM" || !organization;

    if (organization && subtotalCents > 0) {
      const gate = getPaidSalesGate({
        officialEmail: organization.officialEmail ?? null,
        officialEmailVerifiedAt: organization.officialEmailVerifiedAt ?? null,
        stripeAccountId: organization.stripeAccountId ?? null,
        stripeChargesEnabled: organization.stripeChargesEnabled ?? false,
        stripePayoutsEnabled: organization.stripePayoutsEnabled ?? false,
        requireStripe: !isPlatformOrg,
      });
      if (!gate.ok) {
        return NextResponse.json(
          {
            ok: false,
            error: "PAYMENTS_NOT_READY",
            message: formatPaidSalesGateMessage(gate, "Pagamentos indisponiveis. Para ativar,"),
            missingEmail: gate.missingEmail,
            missingStripe: gate.missingStripe,
          },
          { status: 409 },
        );
      }
    }

    const purchaseId = payload.purchaseId?.trim() || createPurchaseId();
    let shippingCents = 0;
    let shippingMethodId: number | null = null;
    let shippingZoneId: number | null = null;
    if (requiresShipping) {
      const quote = await computeStoreShippingQuote({
        storeId: store.id,
        country: payload.shippingAddress?.country ?? "",
        subtotalCents,
        methodId: payload.shippingMethodId ?? null,
      });
      if (!quote.ok) {
        return NextResponse.json({ ok: false, error: quote.error }, { status: 400 });
      }
      shippingCents = quote.quote.shippingCents;
      shippingMethodId = quote.quote.methodId;
      shippingZoneId = quote.quote.zoneId;
    }
    const amountCents = subtotalCents + shippingCents;
    const pricingDiscountCents = promoDiscountCents;

    const { feeBps: defaultFeeBps, feeFixedCents: defaultFeeFixed } = await getPlatformFees();
    const stripeBaseFees = await getStripeBaseFees();
    const pricing = computePricing(amountCents, pricingDiscountCents, {
      platformDefaultFeeMode: "INCLUDED",
      organizationFeeMode: organization?.feeMode ?? undefined,
      organizationPlatformFeeBps: organization?.platformFeeBps ?? undefined,
      organizationPlatformFeeFixedCents: organization?.platformFeeFixedCents ?? undefined,
      platformDefaultFeeBps: defaultFeeBps,
      platformDefaultFeeFixedCents: defaultFeeFixed,
      isPlatformOrg,
    });
    const combinedFees = computeCombinedFees({
      amountCents,
      discountCents: pricingDiscountCents,
      feeMode: pricing.feeMode,
      platformFeeBps: pricing.feeBpsApplied,
      platformFeeFixedCents: pricing.feeFixedApplied,
      stripeFeeBps: stripeBaseFees.feeBps,
      stripeFeeFixedCents: stripeBaseFees.feeFixedCents,
    });
    const totalCents = combinedFees.totalCents;
    const stripeFeeEstimateCents = combinedFees.stripeFeeCentsEstimate;
    const payoutAmountCents = Math.max(0, totalCents - pricing.platformFeeCents - stripeFeeEstimateCents);

    const order = await prisma.$transaction(async (tx) => {
      const created = await tx.storeOrder.create({
        data: {
          storeId: store.id,
          userId,
          orderNumber: buildOrderNumber(store.id),
          status: StoreOrderStatus.PENDING,
          subtotalCents,
          discountCents: orderDiscountCents,
          shippingCents,
          shippingZoneId,
          shippingMethodId,
          totalCents,
          currency: store.currency,
          customerEmail: payload.customer.email,
          customerName: payload.customer.name,
          customerPhone: payload.customer.phone ?? null,
          notes: payload.notes ?? null,
          purchaseId,
          addresses: {
            create: [
              payload.shippingAddress
                ? {
                    addressType: StoreAddressType.SHIPPING,
                    ...payload.shippingAddress,
                    line2: payload.shippingAddress.line2 ?? null,
                    region: payload.shippingAddress.region ?? null,
                    nif: payload.shippingAddress.nif ?? null,
                  }
                : null,
              payload.billingAddress
                ? {
                    addressType: StoreAddressType.BILLING,
                    ...payload.billingAddress,
                    line2: payload.billingAddress.line2 ?? null,
                    region: payload.billingAddress.region ?? null,
                    nif: payload.billingAddress.nif ?? null,
                  }
                : null,
            ].filter(Boolean) as Prisma.StoreOrderAddressCreateWithoutOrderInput[],
          },
        },
        select: { id: true, orderNumber: true },
      });

      const bundleKeyToOrderBundleId = new Map<string, number>();
      for (const bundle of bundleDrafts) {
        const createdBundle = await tx.storeOrderBundle.create({
          data: {
            orderId: created.id,
            bundleId: bundle.bundleId,
            nameSnapshot: bundle.nameSnapshot,
            pricingMode: bundle.pricingMode,
            priceCents: bundle.priceCents,
            percentOff: bundle.percentOff,
            bundleQuantity: bundle.bundleQuantity,
            totalCents: bundle.totalCents,
            items: {
              create: bundle.items.map((item) => ({
                productId: item.productId,
                variantId: item.variantId,
                quantity: item.quantity,
                nameSnapshot: item.nameSnapshot,
                skuSnapshot: item.skuSnapshot,
              })),
            },
          },
          select: { id: true },
        });
        bundleKeyToOrderBundleId.set(bundle.bundleKey, createdBundle.id);
      }

      if (lineDrafts.length) {
        await tx.storeOrderLine.createMany({
          data: lineDrafts.map((line) => ({
            orderId: created.id,
            productId: line.productId,
            variantId: line.variantId,
            orderBundleId: line.bundleKey ? bundleKeyToOrderBundleId.get(line.bundleKey) ?? null : null,
            nameSnapshot: line.nameSnapshot,
            skuSnapshot: line.skuSnapshot,
            quantity: line.quantity,
            unitPriceCents: line.unitPriceCents,
            discountCents: line.discountCents,
            totalCents: line.totalCents,
            requiresShipping: line.requiresShipping,
            personalization: line.personalization ?? {},
          })),
        });
      }

      await tx.storeCart.update({
        where: { id: cart.cart.id },
        data: { status: "CHECKOUT_LOCKED" },
      });

      return created;
    });

    let intent;
    try {
      intent = await createPaymentIntent(
        {
          amount: totalCents,
          currency: store.currency.toLowerCase(),
          payment_method_types: ["card"],
          receipt_email: payload.customer.email ?? undefined,
          metadata: {
            storeOrderId: String(order.id),
            storeId: String(store.id),
            cartId: cart.cart.id,
            purchaseId,
            userId: userId ?? "",
            orderNumber: order.orderNumber ?? "",
            grossAmountCents: String(totalCents),
            platformFeeCents: String(pricing.platformFeeCents),
            feeMode: pricing.feeMode,
            payoutAmountCents: String(payoutAmountCents),
            discountCents: String(orderDiscountCents),
            promoCodeId: promoCodeId ? String(promoCodeId) : "",
            promoCode: promoCodeLabel ?? "",
            recipientConnectAccountId: organization && !isPlatformOrg ? organization.stripeAccountId ?? "" : "",
            sourceType: SourceType.STORE_ORDER,
            sourceId: `store_order_${order.id}`,
            currency: store.currency,
            stripeFeeEstimateCents: String(stripeFeeEstimateCents),
            shippingCents: String(shippingCents),
            shippingMethodId: shippingMethodId ? String(shippingMethodId) : "",
            shippingZoneId: shippingZoneId ? String(shippingZoneId) : "",
          },
          description: order.orderNumber ? `Loja ${order.orderNumber}` : `Loja ${order.id}`,
        },
        {
          idempotencyKey: purchaseId,
          requireStripe: !isPlatformOrg,
          org: {
            stripeAccountId: organization?.stripeAccountId ?? null,
            stripeChargesEnabled: organization?.stripeChargesEnabled ?? null,
            stripePayoutsEnabled: organization?.stripePayoutsEnabled ?? null,
            orgType: organization?.orgType ?? null,
          },
        },
      );
    } catch (err) {
      await prisma.storeOrder.update({
        where: { id: order.id },
        data: { status: StoreOrderStatus.CANCELLED },
      });
      throw err;
    }

    await prisma.storeOrder.update({
      where: { id: order.id },
      data: { paymentIntentId: intent.id },
    });

    return NextResponse.json({
      ok: true,
      orderId: order.id,
      orderNumber: order.orderNumber,
      paymentIntentId: intent.id,
      clientSecret: intent.client_secret,
      amountCents: totalCents,
      discountCents: orderDiscountCents,
      currency: store.currency,
      shippingCents,
      shippingZoneId,
      shippingMethodId,
    });
  } catch (err) {
    console.error("POST /api/store/checkout error:", err);
    return NextResponse.json({ ok: false, error: "Erro ao iniciar checkout." }, { status: 500 });
  }
}
