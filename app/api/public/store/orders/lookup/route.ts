import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isStoreFeatureEnabled } from "@/lib/storeAccess";
import { StoreAddressType } from "@prisma/client";
import { buildStoreOrderTimeline } from "@/lib/store/orderTimeline";
import { buildPersonalizationSummary } from "@/lib/store/personalization";
import { resolvePaymentStatusMap } from "@/domain/finance/resolvePaymentStatus";
import type { CheckoutStatus } from "@/domain/finance/status";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

const lookupSchema = z.object({
  orderNumber: z.string().trim().min(3).max(120),
  email: z.string().trim().email(),
});

function buildStoreLabel(store: {
  id: number;
  supportEmail: string | null;
  supportPhone: string | null;
  returnPolicy: string | null;
  privacyPolicy: string | null;
  termsUrl: string | null;
  organization: { username: string | null; publicName: string | null; businessName: string | null } | null;
}) {
  const org = store.organization;
  const displayName =
    org?.publicName ||
    org?.businessName ||
    org?.username ||
    `Loja ${store.id}`;
  const username = org?.username || null;
  return {
    id: store.id,
    displayName,
    username,
    supportEmail: store.supportEmail ?? null,
    supportPhone: store.supportPhone ?? null,
    returnPolicy: store.returnPolicy ?? null,
    privacyPolicy: store.privacyPolicy ?? null,
    termsUrl: store.termsUrl ?? null,
  };
}

function mapCheckoutStatus(status: CheckoutStatus) {
  switch (status) {
    case "PAID":
      return "PAID";
    case "REFUNDED":
      return "REFUNDED";
    case "DISPUTED":
      return "DISPUTED";
    case "FAILED":
      return "FAILED";
    default:
      return "PROCESSING";
  }
}

async function _POST(req: NextRequest) {
  try {
    if (!isStoreFeatureEnabled()) {
      return jsonWrap({ ok: false, error: "Loja desativada." }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    const parsed = lookupSchema.safeParse(body);
    if (!parsed.success) {
      return jsonWrap({ ok: false, error: "Dados invalidos." }, { status: 400 });
    }

    const payload = parsed.data;
    const order = await prisma.storeOrder.findFirst({
      where: {
        orderNumber: payload.orderNumber.trim(),
        customerEmail: payload.email.trim(),
      },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        purchaseId: true,
        paymentIntentId: true,
        subtotalCents: true,
        discountCents: true,
        shippingCents: true,
        totalCents: true,
        currency: true,
        customerName: true,
        createdAt: true,
        updatedAt: true,
        store: {
          select: {
            id: true,
            supportEmail: true,
            supportPhone: true,
            returnPolicy: true,
            privacyPolicy: true,
            termsUrl: true,
            organization: { select: { username: true, publicName: true, businessName: true } },
          },
        },
        shippingZone: { select: { name: true } },
        shippingMethod: { select: { name: true, etaMinDays: true, etaMaxDays: true } },
        addresses: {
          select: {
            addressType: true,
            addressId: true,
            fullName: true,
            nif: true,
            addressRef: { select: { formattedAddress: true } },
          },
        },
        shipments: {
          orderBy: [{ createdAt: "desc" }],
          select: {
            id: true,
            status: true,
            carrier: true,
            trackingNumber: true,
            trackingUrl: true,
            shippedAt: true,
            deliveredAt: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        lines: {
          select: {
            id: true,
            productId: true,
            nameSnapshot: true,
            quantity: true,
            unitPriceCents: true,
            totalCents: true,
            requiresShipping: true,
            personalization: true,
            product: {
              select: {
                id: true,
                name: true,
                slug: true,
                images: {
                  select: { url: true, altText: true, isPrimary: true, sortOrder: true },
                  orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
                  take: 1,
                },
              },
            },
            variant: { select: { label: true } },
          },
        },
      },
    });

    if (!order) {
      return jsonWrap({ ok: false, error: "Encomenda nao encontrada." }, { status: 404 });
    }

    const productIds = Array.from(
      new Set(order.lines.map((line) => line.productId).filter((id): id is number => Boolean(id))),
    );
    const options = productIds.length
      ? await prisma.storeProductOption.findMany({
          where: { productId: { in: productIds } },
          select: { id: true, productId: true, optionType: true, label: true },
        })
      : [];
    const optionIds = options.map((option) => option.id);
    const values = optionIds.length
      ? await prisma.storeProductOptionValue.findMany({
          where: { optionId: { in: optionIds } },
          select: { id: true, optionId: true, value: true, label: true, priceDeltaCents: true },
        })
      : [];
    const optionsByProduct = new Map<number, typeof options>();
    options.forEach((option) => {
      const existing = optionsByProduct.get(option.productId) ?? [];
      existing.push(option);
      optionsByProduct.set(option.productId, existing);
    });
    const valuesByOption = new Map<number, typeof values>();
    values.forEach((value) => {
      const existing = valuesByOption.get(value.optionId) ?? [];
      existing.push(value);
      valuesByOption.set(value.optionId, existing);
    });

    const paymentEventsRaw = await prisma.paymentEvent.findMany({
      where: {
        OR: [
          order.purchaseId ? { purchaseId: order.purchaseId } : undefined,
          order.paymentIntentId ? { stripePaymentIntentId: order.paymentIntentId } : undefined,
        ].filter(Boolean) as object[],
      },
      orderBy: [{ createdAt: "asc" }],
      select: { status: true, createdAt: true },
    });
    const paymentEvents = paymentEventsRaw.map((event) => ({
      status: event.status,
      createdAt: event.createdAt ?? order.createdAt,
    }));
    const statusMap = await resolvePaymentStatusMap(order.purchaseId ? [order.purchaseId] : []);
    const resolved = order.purchaseId ? statusMap.get(order.purchaseId) : null;
    const paymentStatus = resolved ? mapCheckoutStatus(resolved.status) : "PROCESSING";

    const shipments = order.shipments.map((shipment) => ({
      id: shipment.id,
      status: shipment.status,
      carrier: shipment.carrier,
      trackingNumber: shipment.trackingNumber,
      trackingUrl: shipment.trackingUrl,
      shippedAt: shipment.shippedAt ? shipment.shippedAt.toISOString() : null,
      deliveredAt: shipment.deliveredAt ? shipment.deliveredAt.toISOString() : null,
      createdAt: shipment.createdAt.toISOString(),
      updatedAt: shipment.updatedAt.toISOString(),
    }));

    const shippingAddress = order.addresses.find((address) => address.addressType === StoreAddressType.SHIPPING);
    const timeline = buildStoreOrderTimeline({
      orderStatus: order.status,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      paymentStatus,
      paymentEvents,
      shipments: order.shipments.map((shipment) => ({
        id: shipment.id,
        status: shipment.status,
        shippedAt: shipment.shippedAt ?? null,
        deliveredAt: shipment.deliveredAt ?? null,
        createdAt: shipment.createdAt,
        updatedAt: shipment.updatedAt,
      })),
    });

    return jsonWrap({
      ok: true,
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        paymentStatus,
        subtotalCents: order.subtotalCents,
        discountCents: order.discountCents,
        shippingCents: order.shippingCents,
        totalCents: order.totalCents,
        currency: order.currency,
        customerName: order.customerName,
        createdAt: order.createdAt.toISOString(),
        store: buildStoreLabel(order.store),
        shipping: {
          zoneName: order.shippingZone?.name ?? null,
          methodName: order.shippingMethod?.name ?? null,
          etaMinDays: order.shippingMethod?.etaMinDays ?? null,
          etaMaxDays: order.shippingMethod?.etaMaxDays ?? null,
          address: shippingAddress
            ? {
                addressId: shippingAddress.addressId,
                fullName: shippingAddress.fullName,
                formattedAddress: shippingAddress.addressRef?.formattedAddress ?? null,
                nif: shippingAddress.nif ?? null,
              }
            : null,
        },
        shipments,
        timeline,
        lines: order.lines.map((line) => ({
          id: line.id,
          name: line.product?.name ?? line.nameSnapshot,
          slug: line.product?.slug ?? null,
          quantity: line.quantity,
          unitPriceCents: line.unitPriceCents,
          totalCents: line.totalCents,
          requiresShipping: line.requiresShipping,
          variantLabel: line.variant?.label ?? null,
          image:
            line.product?.images?.[0]
              ? {
                  url: line.product.images[0].url,
                  altText: line.product.images[0].altText ?? line.product?.name ?? line.nameSnapshot,
                }
              : null,
          personalization: buildPersonalizationSummary({
            personalization: line.personalization,
            options: line.productId ? optionsByProduct.get(line.productId) ?? [] : [],
            values: line.productId
              ? (optionsByProduct.get(line.productId) ?? []).flatMap(
                  (option) => valuesByOption.get(option.id) ?? [],
                )
              : [],
          }),
        })),
      },
    });
  } catch (err) {
    console.error("POST /api/public/store/orders/lookup error:", err);
    return jsonWrap({ ok: false, error: "Erro ao procurar encomenda." }, { status: 500 });
  }
}
export const POST = withApiEnvelope(_POST);
