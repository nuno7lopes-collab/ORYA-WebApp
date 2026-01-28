import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { isStoreFeatureEnabled } from "@/lib/storeAccess";
import { StoreAddressType } from "@prisma/client";
import { buildStoreOrderTimeline } from "@/lib/store/orderTimeline";
import { buildPersonalizationSummary } from "@/lib/store/personalization";
import { resolvePaymentStatusMap } from "@/domain/finance/resolvePaymentStatus";
import type { CheckoutStatus } from "@/domain/finance/status";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

function resolveOrderId(params: { orderId: string }) {
  const orderId = Number(params.orderId);
  if (!Number.isFinite(orderId)) {
    return { ok: false as const, error: "ID invalido." };
  }
  return { ok: true as const, orderId };
}

function buildStoreLabel(store: {
  id: number;
  supportEmail: string | null;
  supportPhone: string | null;
  organization: { username: string | null; publicName: string | null; businessName: string | null } | null;
  ownerUser: { username: string | null; fullName: string | null } | null;
}) {
  const org = store.organization;
  const owner = store.ownerUser;
  const displayName =
    org?.publicName ||
    org?.businessName ||
    org?.username ||
    owner?.fullName ||
    owner?.username ||
    `Loja ${store.id}`;
  const username = org?.username || owner?.username || null;
  return {
    id: store.id,
    displayName,
    username,
    supportEmail: store.supportEmail ?? null,
    supportPhone: store.supportPhone ?? null,
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

async function _GET(_req: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  try {
    if (!isStoreFeatureEnabled()) {
      return jsonWrap({ ok: false, error: "Loja desativada." }, { status: 403 });
    }

    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);
    const email = user.email ?? null;

    const resolvedParams = await params;
    const resolved = resolveOrderId(resolvedParams);
    if (!resolved.ok) {
      return jsonWrap({ ok: false, error: resolved.error }, { status: 400 });
    }

    const order = await prisma.storeOrder.findFirst({
      where: {
        id: resolved.orderId,
        OR: [
          { userId: user.id },
          email ? { userId: null, customerEmail: email } : undefined,
        ].filter(Boolean) as object[],
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
        customerEmail: true,
        customerPhone: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
        store: {
          select: {
            id: true,
            supportEmail: true,
            supportPhone: true,
            organization: { select: { username: true, publicName: true, businessName: true } },
            ownerUser: { select: { username: true, fullName: true } },
          },
        },
        shippingZone: { select: { name: true } },
        shippingMethod: { select: { name: true, etaMinDays: true, etaMaxDays: true } },
        addresses: {
          select: {
            addressType: true,
            fullName: true,
            line1: true,
            line2: true,
            city: true,
            region: true,
            postalCode: true,
            country: true,
            nif: true,
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
          select: { id: true, optionId: true, value: true, label: true },
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

    const paymentEvents = await prisma.paymentEvent.findMany({
      where: {
        OR: [
          order.purchaseId ? { purchaseId: order.purchaseId } : undefined,
          order.paymentIntentId ? { stripePaymentIntentId: order.paymentIntentId } : undefined,
        ].filter(Boolean) as object[],
      },
      orderBy: [{ createdAt: "asc" }],
      select: { status: true, createdAt: true },
    });

    const paidEvent = paymentEvents.find((event) => event.status === "OK");
    const statusMap = await resolvePaymentStatusMap(order.purchaseId ? [order.purchaseId] : []);
    const resolvedStatus = order.purchaseId ? statusMap.get(order.purchaseId) : null;
    const paymentStatus = resolvedStatus ? mapCheckoutStatus(resolvedStatus.status) : "PROCESSING";

    const shippingAddress = order.addresses.find((address) => address.addressType === StoreAddressType.SHIPPING);
    const billingAddress = order.addresses.find((address) => address.addressType === StoreAddressType.BILLING);

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
        subtotalCents: order.subtotalCents,
        discountCents: order.discountCents,
        shippingCents: order.shippingCents,
        totalCents: order.totalCents,
        currency: order.currency,
        customerName: order.customerName,
        customerEmail: order.customerEmail,
        customerPhone: order.customerPhone,
        notes: order.notes,
        createdAt: order.createdAt.toISOString(),
        updatedAt: order.updatedAt.toISOString(),
        paidAt: paidEvent?.createdAt.toISOString() ?? null,
        paymentStatus,
        store: buildStoreLabel(order.store),
        shipping: {
          zoneName: order.shippingZone?.name ?? null,
          methodName: order.shippingMethod?.name ?? null,
          etaMinDays: order.shippingMethod?.etaMinDays ?? null,
          etaMaxDays: order.shippingMethod?.etaMaxDays ?? null,
          address: shippingAddress
            ? {
                fullName: shippingAddress.fullName,
                line1: shippingAddress.line1,
                line2: shippingAddress.line2,
                city: shippingAddress.city,
                region: shippingAddress.region,
                postalCode: shippingAddress.postalCode,
                country: shippingAddress.country,
                nif: shippingAddress.nif,
              }
            : null,
        },
        billing: billingAddress
          ? {
              fullName: billingAddress.fullName,
              line1: billingAddress.line1,
              line2: billingAddress.line2,
              city: billingAddress.city,
              region: billingAddress.region,
              postalCode: billingAddress.postalCode,
              country: billingAddress.country,
              nif: billingAddress.nif,
            }
          : null,
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
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ ok: false, error: "Nao autenticado." }, { status: 401 });
    }
    console.error("GET /api/me/store/purchases/[orderId] error:", err);
    return jsonWrap({ ok: false, error: "Erro ao carregar encomenda." }, { status: 500 });
  }
}
export const GET = withApiEnvelope(_GET);