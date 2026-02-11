export const runtime = "nodejs";

import { NextRequest } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { ensurePaymentIntent } from "@/domain/finance/paymentIntent";
import { computeFeePolicyVersion } from "@/domain/finance/checkout";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { isStoreFeatureEnabled, canCheckoutStore } from "@/lib/storeAccess";
import { AddressSourceProvider, ProcessorFeesStatus, SourceType, StoreAddressType, StoreOrderStatus, StoreStockPolicy } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { computePricing } from "@/lib/pricing";
import { computeCombinedFees } from "@/lib/fees";
import { getPlatformFees } from "@/lib/platformSettings";
import { formatPaidSalesGateMessage, getPaidSalesGate } from "@/lib/organizationPayments";
import { computeStoreShippingQuote } from "@/lib/store/shipping";
import { validateStorePersonalization } from "@/lib/store/personalization";
import { computeBundleTotals } from "@/lib/store/bundles";
import { computePromoDiscountCents } from "@/lib/promoMath";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { finalizeFreeStoreCheckout } from "@/domain/finance/freeStoreCheckout";

const CART_SESSION_COOKIE = "orya_store_cart";

const addressSchema = z.object({
  addressId: z.string().uuid(),
  fullName: z.string().trim().min(1).max(160),
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
  idempotencyKey: z.string().trim().max(120).optional(),
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

const pickString = (value: unknown) => (typeof value === "string" ? value.trim() || null : null);

function resolveCountryCode(canonical: Record<string, unknown> | null): string | null {
  if (!canonical) return null;
  const code =
    pickString(canonical.countryCode) ||
    pickString(canonical.country_code) ||
    pickString(canonical.countryCodeISO) ||
    pickString(canonical.country_code_iso) ||
    pickString(canonical.isoCountryCode) ||
    pickString(canonical.iso_country_code);
  if (code) return code.toUpperCase();
  const fallback = pickString(canonical.country) || pickString(canonical.countryName);
  if (fallback && fallback.length <= 3) return fallback.toUpperCase();
  return null;
}

async function resolveCheckoutAddress(
  input: z.infer<typeof addressSchema> | null | undefined,
  kind: "shipping" | "billing",
) {
  if (!input) return null;
  const address = await prisma.address.findUnique({
    where: { id: input.addressId },
    select: { id: true, canonical: true, sourceProvider: true },
  });
  if (!address) {
    throw new Error(`${kind.toUpperCase()}_ADDRESS_INVALID`);
  }
  if (address.sourceProvider !== AddressSourceProvider.APPLE_MAPS) {
    throw new Error(`${kind.toUpperCase()}_ADDRESS_PROVIDER`);
  }
  const canonical = (address.canonical as Record<string, unknown> | null) ?? null;
  const countryCode = resolveCountryCode(canonical);
  return {
    addressId: address.id,
    fullName: input.fullName,
    nif: input.nif ?? null,
    countryCode,
  };
}

async function _POST(req: NextRequest) {
  const ctx = getRequestContext(req);
  const fail = (errorCode: string, message: string, status: number, retryable = false, details?: Record<string, unknown>) =>
    respondError(ctx, { errorCode, message, retryable, ...(details ? { details } : {}) }, { status });
  try {
    if (!isStoreFeatureEnabled()) {
      return fail("STORE_DISABLED", "Loja desativada.", 403);
    }

    const storeParsed = parseStoreId(req);
    if (!storeParsed.ok) {
      return fail("INVALID_STORE", storeParsed.error, 400);
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
      },
    });
    if (!store) {
      return fail("STORE_NOT_FOUND", "Store nao encontrada.", 404);
    }
    if (!canCheckoutStore(store)) {
      return fail("CHECKOUT_UNAVAILABLE", "Checkout indisponivel.", 403);
    }
    if (store.catalogLocked) {
      return fail("CATALOG_LOCKED", "Catalogo bloqueado.", 403);
    }

    const body = await req.json().catch(() => null);
    const parsed = checkoutSchema.safeParse(body);
    if (!parsed.success) {
      return fail("INVALID_BODY", "Dados invalidos.", 400);
    }

    const payload = parsed.data;
    const idempotencyKeyHeader = req.headers.get("Idempotency-Key");
    const idempotencyKey = (payload.idempotencyKey ?? idempotencyKeyHeader ?? "").trim() || null;
    const supabase = await createSupabaseServer();
    const { data } = await supabase.auth.getUser();
    const userId = data?.user?.id ?? null;

    const cookieSession = req.cookies.get(CART_SESSION_COOKIE)?.value ?? null;
    const sessionId = userId ? null : cookieSession;
    const cart = await resolveCart(store.id, userId, sessionId);
    if (!cart.ok) {
      return fail("CART_NOT_FOUND", cart.error, 404);
    }
    if (!cart.cart.items.length) {
      return fail("EMPTY_CART", "Carrinho vazio.", 409);
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
        return fail("PRODUCT_UNAVAILABLE", "Produto indisponivel.", 409);
      }
      if (product.currency !== store.currency) {
        return fail("INVALID_CURRENCY", "Moeda invalida.", 400);
      }

      let variant: typeof variants[number] | null = null;
      if (item.variantId) {
        const found = variantMap.get(item.variantId);
        if (!found || found.productId !== product.id || !found.isActive) {
          return fail("INVALID_VARIANT", "Variante invalida.", 400);
        }
        variant = found;
      }

      if (product.stockPolicy === StoreStockPolicy.TRACKED) {
        const key = `${item.productId}:${item.variantId ?? "base"}`;
        const requestedQty = requestedQtyMap.get(key) ?? item.quantity;
        const available = variant ? variant.stockQty ?? 0 : product.stockQty ?? 0;
        if (requestedQty > available) {
          return fail("INSUFFICIENT_STOCK", "Stock insuficiente.", 409);
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
        return fail("INVALID_BUNDLE", "Bundle invalido.", 400);
      }
      const bundle = bundleMap.get(bundleId);
      if (!bundle || bundle.status !== "ACTIVE" || !bundle.isVisible) {
        return fail("BUNDLE_UNAVAILABLE", "Bundle indisponivel.", 409);
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
          return fail("INVALID_BUNDLE", "Bundle invalido.", 409);
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
        return fail("INVALID_BUNDLE", "Bundle invalido.", 409);
      }

      baseSubtotalCents += baseCents;
      bundleDiscountCents += totals.discountCents;

      const draftItems: BundleDraft["items"] = [];
      for (const item of bundle.items) {
        const product = productMap.get(item.productId);
        const variant = item.variantId ? variantMap.get(item.variantId) : null;
        if (!product) {
          return fail("PRODUCT_UNAVAILABLE", "Produto indisponivel.", 409);
        }
        if (item.variantId && !variant) {
          return fail("INVALID_VARIANT", "Variante invalida.", 400);
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
          return fail("PRODUCT_UNAVAILABLE", "Produto indisponivel.", 409);
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
        return fail("PRODUCT_UNAVAILABLE", "Produto indisponivel.", 409);
      }

      let variant: typeof variants[number] | null = null;
      if (item.variantId) {
        const found = variantMap.get(item.variantId);
        if (!found || found.productId !== product.id || !found.isActive) {
          return fail("INVALID_VARIANT", "Variante invalida.", 400);
        }
        variant = found;
      }

      const personalizationDelta = await validateStorePersonalization({
        productId: product.id,
        personalization: item.personalization,
      });
      if (!personalizationDelta.ok) {
        return fail("INVALID_PERSONALIZATION", personalizationDelta.error, 400);
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
        return fail("PROMO_INVALID", "Codigo promocional invalido.", 400);
      }
      if (promo.validFrom && promo.validFrom > nowDate) {
        return fail("PROMO_NOT_ACTIVE", "Codigo promocional ainda nao esta ativo.", 400);
      }
      if (promo.validUntil && promo.validUntil < nowDate) {
        return fail("PROMO_EXPIRED", "Codigo promocional expirado.", 400);
      }
      if (promo.minQuantity !== null && totalQuantity < promo.minQuantity) {
        return fail("PROMO_MIN_QUANTITY", "Quantidade insuficiente para aplicar o codigo.", 400);
      }
      if (promo.minTotalCents !== null && subtotalCents < promo.minTotalCents) {
        return fail("PROMO_MIN_TOTAL", "Valor minimo nao atingido para aplicar o codigo.", 400);
      }
      const totalUses = await prisma.promoRedemption.count({ where: { promoCodeId: promo.id } });
      if (promo.maxUses !== null && totalUses >= promo.maxUses) {
        return fail("PROMO_MAX_USES", "Codigo promocional esgotado.", 400);
      }
      if (promo.perUserLimit !== null) {
        if (userId) {
          const userUses = await prisma.promoRedemption.count({ where: { promoCodeId: promo.id, userId } });
          if (userUses >= promo.perUserLimit) {
            return fail("PROMO_USER_LIMIT", "Ja usaste este codigo o maximo de vezes.", 400);
          }
        } else if (payload.customer.email) {
          const guestUses = await prisma.promoRedemption.count({
            where: { promoCodeId: promo.id, guestEmail: { equals: payload.customer.email, mode: "insensitive" } },
          });
          if (guestUses >= promo.perUserLimit) {
            return fail("PROMO_USER_LIMIT", "Ja usaste este codigo o maximo de vezes.", 400);
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
        return fail("PROMO_NOT_APPLICABLE", "Codigo promocional nao aplicavel.", 400);
      }
      promoCodeId = promo.id;
      promoCodeLabel = promo.code;
    }

    const orderDiscountCents = bundleDiscountCents + promoDiscountCents;

    let shippingAddress = null as Awaited<ReturnType<typeof resolveCheckoutAddress>> | null;
    let billingAddress = null as Awaited<ReturnType<typeof resolveCheckoutAddress>> | null;
    try {
      shippingAddress = await resolveCheckoutAddress(payload.shippingAddress ?? null, "shipping");
      billingAddress = await resolveCheckoutAddress(payload.billingAddress ?? null, "billing");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("SHIPPING_ADDRESS_INVALID") || message.includes("BILLING_ADDRESS_INVALID")) {
        return fail("ADDRESS_INVALID", "Morada inválida.", 400);
      }
      if (message.includes("SHIPPING_ADDRESS_PROVIDER") || message.includes("BILLING_ADDRESS_PROVIDER")) {
        return fail("ADDRESS_PROVIDER", "Morada deve ser Apple Maps.", 400);
      }
      throw err;
    }

    if (requiresShipping && !shippingAddress) {
      return fail("ADDRESS_REQUIRED", "Morada obrigatoria.", 400);
    }

    if (!store.ownerOrganizationId) {
      throw new Error("STORE_ORG_NOT_FOUND");
    }
    const organization = await prisma.organization.findUnique({
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
    });
    if (!organization) {
      throw new Error("STORE_ORG_NOT_FOUND");
    }
    const organizationId = organization.id;

    const isPlatformOrg = organization.orgType === "PLATFORM";

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
        return fail(
          "PAYMENTS_NOT_READY",
          formatPaidSalesGateMessage(gate, "Pagamentos indisponiveis. Para ativar,"),
          409,
          false,
          { missingEmail: gate.missingEmail, missingStripe: gate.missingStripe },
        );
      }
    }

    const providedPurchaseId = payload.purchaseId?.trim() || null;
    let shippingCents = 0;
    let shippingMethodId: number | null = null;
    let shippingZoneId: number | null = null;
    if (requiresShipping) {
      if (!shippingAddress?.countryCode) {
        return fail("ADDRESS_COUNTRY_MISSING", "País da morada inválido.", 400);
      }
      const quote = await computeStoreShippingQuote({
        storeId: store.id,
        country: shippingAddress.countryCode,
        subtotalCents,
        methodId: payload.shippingMethodId ?? null,
      });
      if (!quote.ok) {
        return fail("SHIPPING_QUOTE_FAILED", quote.error, 400);
      }
      shippingCents = quote.quote.shippingCents;
      shippingMethodId = quote.quote.methodId;
      shippingZoneId = quote.quote.zoneId;
    }
    const amountCents = subtotalCents + shippingCents;
    const pricingDiscountCents = promoDiscountCents;

    const { feeBps: defaultFeeBps, feeFixedCents: defaultFeeFixed } = await getPlatformFees();
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
      stripeFeeBps: 0,
      stripeFeeFixedCents: 0,
    });
    const totalCents = combinedFees.totalCents;
    const stripeFeeEstimateCents = 0;
    const payoutAmountCents = Math.max(0, totalCents - pricing.platformFeeCents);

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
          purchaseId: providedPurchaseId ?? null,
          addresses: {
            create: (() => {
              const items: Prisma.StoreOrderAddressCreateWithoutOrderInput[] = [];
              if (shippingAddress) {
                items.push({
                  addressType: StoreAddressType.SHIPPING,
                  addressRef: { connect: { id: shippingAddress.addressId } },
                  fullName: shippingAddress.fullName,
                  nif: shippingAddress.nif ?? null,
                });
              }
              if (billingAddress) {
                items.push({
                  addressType: StoreAddressType.BILLING,
                  addressRef: { connect: { id: billingAddress.addressId } },
                  fullName: billingAddress.fullName,
                  nif: billingAddress.nif ?? null,
                });
              }
              return items;
            })(),
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
    const purchaseId = providedPurchaseId ?? `store_order_${order.id}`;

    const feePolicyVersion = computeFeePolicyVersion({
      feeMode: pricing.feeMode,
      feeBps: pricing.feeBpsApplied,
      feeFixed: pricing.feeFixedApplied,
    });
    const resolvedSnapshot = {
      organizationId,
      buyerIdentityId: userId ?? null,
      snapshot: {
        currency: store.currency,
        gross: totalCents,
        discounts: orderDiscountCents,
        taxes: 0,
        platformFee: Math.min(pricing.platformFeeCents, totalCents),
        total: totalCents,
        netToOrgPending: Math.max(0, totalCents - Math.min(pricing.platformFeeCents, totalCents)),
        processorFeesStatus: ProcessorFeesStatus.PENDING,
        processorFeesActual: null,
        feeMode: pricing.feeMode,
        feeBps: pricing.feeBpsApplied,
        feeFixed: pricing.feeFixedApplied,
        feePolicyVersion,
        promoPolicyVersion: null,
        sourceType: SourceType.STORE_ORDER,
        sourceId: String(order.id),
        lineItems: lineDrafts.map((line, index) => ({
          quantity: line.quantity,
          unitPriceCents: line.unitPriceCents,
          totalAmountCents: line.totalCents,
          currency: store.currency,
          sourceLineId: line.bundleKey
            ? `${line.productId}:${line.variantId ?? "base"}:${line.bundleKey}:${index}`
            : `${line.productId}:${line.variantId ?? "base"}:${index}`,
          label: line.nameSnapshot,
        })),
      },
    };

    if (totalCents <= 0) {
      const freeCheckout = await finalizeFreeStoreCheckout({
        orderId: order.id,
        storeId: store.id,
        purchaseId,
        userId,
        customerEmail: payload.customer.email ?? null,
        currency: store.currency,
      });
      await prisma.storeOrder.update({
        where: { id: order.id },
        data: {
          paymentIntentId: freeCheckout.paymentIntentId,
          ...(providedPurchaseId ? {} : { purchaseId: freeCheckout.purchaseId }),
        },
      });

      return respondOk(ctx, {
        orderId: order.id,
        orderNumber: order.orderNumber,
        purchaseId: freeCheckout.purchaseId,
        paymentIntentId: freeCheckout.paymentIntentId,
        clientSecret: null,
        amountCents: 0,
        discountCents: orderDiscountCents,
        currency: store.currency,
        shippingCents,
        shippingZoneId,
        shippingMethodId,
        freeCheckout: true,
        status: "PAID",
        final: true,
      });
    }

    let intent;
    try {
      const ensured = await ensurePaymentIntent({
        purchaseId,
        sourceType: SourceType.STORE_ORDER,
        sourceId: String(order.id),
        amountCents: totalCents,
        currency: store.currency,
        intentParams: {
        payment_method_types: ["card"],
        receipt_email: payload.customer.email ?? undefined,
        description: order.orderNumber ? `Loja ${order.orderNumber}` : `Loja ${order.id}`,
      },
        metadata: {
          storeOrderId: String(order.id),
          storeId: String(store.id),
          cartId: cart.cart.id,
          userId: userId ?? "",
          orderNumber: order.orderNumber ?? "",
          grossAmountCents: String(totalCents),
          platformFeeCents: String(Math.min(pricing.platformFeeCents, totalCents)),
          feeMode: pricing.feeMode,
          payoutAmountCents: String(payoutAmountCents),
          discountCents: String(orderDiscountCents),
          promoCodeId: promoCodeId ? String(promoCodeId) : "",
          promoCode: promoCodeLabel ?? "",
          recipientConnectAccountId: organization && !isPlatformOrg ? organization.stripeAccountId ?? "" : "",
          sourceType: SourceType.STORE_ORDER,
          sourceId: String(order.id),
          currency: store.currency,
          stripeFeeEstimateCents: String(stripeFeeEstimateCents),
          shippingCents: String(shippingCents),
          shippingMethodId: shippingMethodId ? String(shippingMethodId) : "",
          shippingZoneId: shippingZoneId ? String(shippingZoneId) : "",
        },
        orgContext: {
          stripeAccountId: organization?.stripeAccountId ?? null,
          stripeChargesEnabled: organization?.stripeChargesEnabled ?? null,
          stripePayoutsEnabled: organization?.stripePayoutsEnabled ?? null,
          orgType: organization?.orgType ?? null,
        },
        requireStripe: !isPlatformOrg,
        clientIdempotencyKey: idempotencyKey,
        resolvedSnapshot,
        buyerIdentityRef: userId ?? null,
        paymentEvent: {
          userId: userId ?? null,
          amountCents: totalCents,
          platformFeeCents: Math.min(pricing.platformFeeCents, totalCents),
        },
      });
      intent = ensured.paymentIntent;
    } catch (err) {
      await prisma.storeOrder.update({
        where: { id: order.id },
        data: { status: StoreOrderStatus.CANCELLED },
      });
      if (err instanceof Error && err.message === "IDEMPOTENCY_KEY_PAYLOAD_MISMATCH") {
        return fail(
          "IDEMPOTENCY_KEY_PAYLOAD_MISMATCH",
          "Chave de idempotência reutilizada com um carrinho diferente.",
          409,
        );
      }
      if (err instanceof Error && err.message === "PAYMENT_INTENT_TERMINAL") {
        return fail(
          "PAYMENT_INTENT_TERMINAL",
          "Sessão de pagamento expirada. Tenta novamente.",
          409,
          true,
        );
      }
      if (err instanceof Error && err.message === "PAYMENT_INTENT_RETRIEVE_FAILED") {
        return fail(
          "PAYMENT_INTENT_RETRIEVE_FAILED",
          "Não foi possível retomar o pagamento. Tenta novamente.",
          503,
          true,
        );
      }
      throw err;
    }

    await prisma.storeOrder.update({
      where: { id: order.id },
      data: { paymentIntentId: intent.id, ...(providedPurchaseId ? {} : { purchaseId }) },
    });

    return respondOk(ctx, {
      orderId: order.id,
      orderNumber: order.orderNumber,
      purchaseId,
      paymentIntentId: intent.id,
      clientSecret: intent.client_secret,
      amountCents: totalCents,
      discountCents: orderDiscountCents,
      currency: store.currency,
      shippingCents,
      shippingZoneId,
      shippingMethodId,
      freeCheckout: false,
      status: "REQUIRES_ACTION",
      final: false,
    });
  } catch (err) {
    console.error("POST /api/store/checkout error:", err);
    return fail("CHECKOUT_FAILED", "Erro ao iniciar checkout.", 500, true);
  }
}
export const POST = withApiEnvelope(_POST);
