export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripeClient";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { isStoreFeatureEnabled, canCheckoutStore } from "@/lib/storeAccess";
import { StoreAddressType, StoreOrderStatus, StoreStockPolicy } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { createPurchaseId } from "@/lib/checkoutSchemas";
import { computePricing } from "@/lib/pricing";
import { computeCombinedFees } from "@/lib/fees";
import { getPlatformFees, getStripeBaseFees } from "@/lib/platformSettings";
import { formatPaidSalesGateMessage, getPaidSalesGate } from "@/lib/organizationPayments";
import { computeStoreShippingQuote } from "@/lib/store/shipping";

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
});

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

    const lines: Array<{
      productId: number;
      variantId: number | null;
      nameSnapshot: string;
      skuSnapshot: string | null;
      quantity: number;
      unitPriceCents: number;
      totalCents: number;
      requiresShipping: boolean;
      personalization: unknown;
    }> = [];

    let subtotalCents = 0;
    let requiresShipping = false;

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
        const available = variant ? variant.stockQty ?? 0 : product.stockQty ?? 0;
        if (item.quantity > available) {
          return NextResponse.json({ ok: false, error: "Stock insuficiente." }, { status: 409 });
        }
      }

      const personalizationDelta = await computePersonalizationDelta({
        productId: product.id,
        personalization: item.personalization,
      });
      if (!personalizationDelta.ok) {
        return NextResponse.json({ ok: false, error: personalizationDelta.error }, { status: 400 });
      }

      const basePrice = variant?.priceCents ?? product.priceCents;
      const unitPriceCents = basePrice + personalizationDelta.deltaCents;
      const totalCents = unitPriceCents * item.quantity;
      subtotalCents += totalCents;
      requiresShipping = requiresShipping || product.requiresShipping;

      lines.push({
        productId: product.id,
        variantId: variant?.id ?? null,
        nameSnapshot: variant ? `${product.name} - ${variant.label}` : product.name,
        skuSnapshot: variant?.sku ?? product.sku ?? null,
        quantity: item.quantity,
        unitPriceCents,
        totalCents,
        requiresShipping: product.requiresShipping,
        personalization: item.personalization ?? {},
      });
    }

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
    const discountCents = 0;
    const amountCents = subtotalCents + shippingCents;

    const { feeBps: defaultFeeBps, feeFixedCents: defaultFeeFixed } = await getPlatformFees();
    const stripeBaseFees = await getStripeBaseFees();
    const pricing = computePricing(amountCents, discountCents, {
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
      discountCents,
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
          discountCents,
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
          lines: {
            create: lines.map((line) => ({
              productId: line.productId,
              variantId: line.variantId,
              nameSnapshot: line.nameSnapshot,
              skuSnapshot: line.skuSnapshot,
              quantity: line.quantity,
              unitPriceCents: line.unitPriceCents,
              discountCents: 0,
              totalCents: line.totalCents,
              requiresShipping: line.requiresShipping,
              personalization: line.personalization ?? {},
            })),
          },
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

      await tx.storeCart.update({
        where: { id: cart.cart.id },
        data: { status: "CHECKOUT_LOCKED" },
      });

      return created;
    });

    let intent;
    try {
      intent = await stripe.paymentIntents.create(
        {
          amount: totalCents,
          currency: store.currency.toLowerCase(),
          payment_method_types: ["card"],
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
            recipientConnectAccountId: organization && !isPlatformOrg ? organization.stripeAccountId ?? "" : "",
            sourceType: "STORE_ORDER",
            sourceId: `store_order_${order.id}`,
            currency: store.currency,
            stripeFeeEstimateCents: String(stripeFeeEstimateCents),
            shippingCents: String(shippingCents),
            shippingMethodId: shippingMethodId ? String(shippingMethodId) : "",
            shippingZoneId: shippingZoneId ? String(shippingZoneId) : "",
          },
          description: order.orderNumber ? `Loja ${order.orderNumber}` : `Loja ${order.id}`,
        },
        { idempotencyKey: purchaseId },
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
