import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { isStoreFeatureEnabled } from "@/lib/storeAccess";
import { StoreAddressType, StoreOrderStatus } from "@prisma/client";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

type StoreLabel = {
  id: number;
  displayName: string;
  username: string | null;
  supportEmail: string | null;
  supportPhone: string | null;
};

function buildStoreLabel(store: {
  id: number;
  supportEmail: string | null;
  supportPhone: string | null;
  organization: { username: string | null; publicName: string | null; businessName: string | null } | null;
  ownerUser: { username: string | null; fullName: string | null } | null;
}): StoreLabel {
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

async function _GET(req: NextRequest) {
  try {
    if (!isStoreFeatureEnabled()) {
      return jsonWrap({ ok: false, error: "Loja desativada." }, { status: 403 });
    }

    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const statusRaw = req.nextUrl.searchParams.get("status");
    const status = Object.values(StoreOrderStatus).includes(statusRaw as StoreOrderStatus)
      ? (statusRaw as StoreOrderStatus)
      : null;
    const cursorParam = req.nextUrl.searchParams.get("cursor");
    const cursorDate = cursorParam ? new Date(cursorParam) : null;
    const limitRaw = Number(req.nextUrl.searchParams.get("limit") ?? "20");
    const limit = Number.isFinite(limitRaw) ? Math.min(60, Math.max(1, limitRaw)) : 20;

    const email = user.email ?? null;
    const where = {
      status: status ?? undefined,
      OR: [
        { userId: user.id },
        email ? { userId: null, customerEmail: email } : undefined,
      ].filter(Boolean) as object[],
      ...(cursorDate && !Number.isNaN(cursorDate.getTime()) ? { createdAt: { lt: cursorDate } } : {}),
    };

    const orders = await prisma.storeOrder.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      take: limit + 1,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        subtotalCents: true,
        shippingCents: true,
        totalCents: true,
        currency: true,
        createdAt: true,
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
            city: true,
            country: true,
            postalCode: true,
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
          },
        },
        lines: {
          select: {
            id: true,
            nameSnapshot: true,
            quantity: true,
            unitPriceCents: true,
            totalCents: true,
            requiresShipping: true,
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

    const items = orders.slice(0, limit).map((order) => {
      const shippingAddress = order.addresses.find((address) => address.addressType === StoreAddressType.SHIPPING);
      return {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        subtotalCents: order.subtotalCents,
        shippingCents: order.shippingCents,
        totalCents: order.totalCents,
        currency: order.currency,
        createdAt: order.createdAt.toISOString(),
        store: buildStoreLabel(order.store),
        shipping: {
          zoneName: order.shippingZone?.name ?? null,
          methodName: order.shippingMethod?.name ?? null,
          etaMinDays: order.shippingMethod?.etaMinDays ?? null,
          etaMaxDays: order.shippingMethod?.etaMaxDays ?? null,
          address: shippingAddress
            ? {
                city: shippingAddress.city,
                country: shippingAddress.country,
                postalCode: shippingAddress.postalCode,
              }
            : null,
        },
        shipments: order.shipments.map((shipment) => ({
          id: shipment.id,
          status: shipment.status,
          carrier: shipment.carrier,
          trackingNumber: shipment.trackingNumber,
          trackingUrl: shipment.trackingUrl,
          shippedAt: shipment.shippedAt ? shipment.shippedAt.toISOString() : null,
          deliveredAt: shipment.deliveredAt ? shipment.deliveredAt.toISOString() : null,
          createdAt: shipment.createdAt.toISOString(),
        })),
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
        })),
      };
    });

    const nextCursor = orders.length > limit ? orders[limit].createdAt.toISOString() : null;

    return jsonWrap({ ok: true, items, nextCursor });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ ok: false, error: "Nao autenticado." }, { status: 401 });
    }
    console.error("GET /api/me/store/purchases error:", err);
    return jsonWrap({ ok: false, error: "Erro ao carregar compras da loja." }, { status: 500 });
  }
}
export const GET = withApiEnvelope(_GET);