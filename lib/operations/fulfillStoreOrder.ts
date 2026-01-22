import Stripe from "stripe";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { CrmInteractionSource, CrmInteractionType, StoreInventoryMovementType, StoreOrderStatus, StoreStockPolicy } from "@prisma/client";
import { ingestCrmInteraction } from "@/lib/crm/ingest";
import { sendStoreOrderConfirmationEmail } from "@/lib/emailSender";
import { getAppBaseUrl } from "@/lib/appBaseUrl";
import { applyPromoRedemptionOperation } from "@/lib/operations/applyPromoRedemption";

function parseId(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}

export async function fulfillStoreOrderIntent(intent: Stripe.PaymentIntent): Promise<boolean> {
  const meta = intent.metadata ?? {};
  const orderId = parseId(meta.storeOrderId);
  if (!orderId) return false;

  const order = await prisma.storeOrder.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      status: true,
      purchaseId: true,
      totalCents: true,
      currency: true,
      userId: true,
      customerEmail: true,
      storeId: true,
      store: { select: { ownerOrganizationId: true } },
    },
  });
  if (!order) {
    throw new Error("STORE_ORDER_NOT_FOUND");
  }

  if (order.status === StoreOrderStatus.PAID || order.status === StoreOrderStatus.FULFILLED) {
    if (order.store?.ownerOrganizationId && order.userId) {
      try {
        await ingestCrmInteraction({
          organizationId: order.store.ownerOrganizationId,
          userId: order.userId,
          type: CrmInteractionType.STORE_ORDER_PAID,
          sourceType: CrmInteractionSource.STORE_ORDER,
          sourceId: order.purchaseId ?? String(order.id),
          occurredAt: new Date(),
          amountCents: order.totalCents,
          currency: order.currency,
          metadata: { orderId: order.id, storeId: order.storeId },
        });
      } catch (err) {
        console.warn("[fulfillStoreOrder] Falha ao criar interação CRM", err);
      }
    }
    return true;
  }

  await prisma.$transaction(async (tx) => {
    const orderLines = await tx.storeOrderLine.findMany({
      where: { orderId: order.id },
      select: {
        id: true,
        productId: true,
        variantId: true,
        quantity: true,
        product: { select: { stockPolicy: true, stockQty: true } },
        variant: { select: { stockQty: true } },
      },
    });

    await tx.storeOrder.update({
      where: { id: order.id },
      data: {
        status: StoreOrderStatus.PAID,
        paymentIntentId: intent.id,
        purchaseId: typeof meta.purchaseId === "string" && meta.purchaseId.trim() ? meta.purchaseId.trim() : order.purchaseId,
      },
    });

    const lineIds = orderLines.map((line) => line.id);
    const existingGrants = await tx.storeDigitalGrant.findMany({
      where: { orderLineId: { in: lineIds } },
      select: { orderLineId: true },
    });
    const grantedLines = new Set(existingGrants.map((grant) => grant.orderLineId));

    const productIds = Array.from(new Set(orderLines.map((line) => line.productId).filter(Boolean))) as number[];
    if (productIds.length) {
      const assets = await tx.storeDigitalAsset.findMany({
        where: { productId: { in: productIds }, isActive: true },
        select: { id: true, productId: true },
      });
      const hasAsset = new Set(assets.map((asset) => asset.productId));
      for (const line of orderLines) {
        if (!line.productId || !hasAsset.has(line.productId)) continue;
        if (grantedLines.has(line.id)) continue;
        const token = crypto.randomBytes(24).toString("hex");
        await tx.storeDigitalGrant.create({
          data: {
            orderLineId: line.id,
            userId: typeof meta.userId === "string" ? meta.userId : null,
            downloadToken: token,
          },
        });
      }
    }

    for (const line of orderLines) {
      if (!line.productId || !line.product || line.product.stockPolicy !== StoreStockPolicy.TRACKED) continue;
      if (line.variantId) {
        const updated = await tx.storeProductVariant.updateMany({
          where: { id: line.variantId, productId: line.productId, stockQty: { gte: line.quantity } },
          data: { stockQty: { decrement: line.quantity } },
        });
        if (updated.count === 0) {
          console.warn("[fulfillStoreOrder] Stock insuficiente para variante", {
            orderId: order.id,
            productId: line.productId,
            variantId: line.variantId,
          });
          continue;
        }
        await tx.storeInventoryMovement.create({
          data: {
            productId: line.productId,
            variantId: line.variantId,
            movementType: StoreInventoryMovementType.SALE,
            quantity: line.quantity,
            reason: `ORDER:${order.id}`,
          },
        });
        continue;
      }

      const updated = await tx.storeProduct.updateMany({
        where: { id: line.productId, stockQty: { gte: line.quantity } },
        data: { stockQty: { decrement: line.quantity } },
      });
      if (updated.count === 0) {
        console.warn("[fulfillStoreOrder] Stock insuficiente para produto", {
          orderId: order.id,
          productId: line.productId,
        });
        continue;
      }
      await tx.storeInventoryMovement.create({
        data: {
          productId: line.productId,
          movementType: StoreInventoryMovementType.SALE,
          quantity: line.quantity,
          reason: `ORDER:${order.id}`,
        },
      });
    }

    if (typeof meta.cartId === "string" && meta.cartId.trim()) {
      await tx.storeCart.updateMany({
        where: { id: meta.cartId.trim() },
        data: { status: "ABANDONED" },
      });
    }
  });

  if (order.store?.ownerOrganizationId && order.userId) {
    try {
      await ingestCrmInteraction({
        organizationId: order.store.ownerOrganizationId,
        userId: order.userId,
        type: CrmInteractionType.STORE_ORDER_PAID,
        sourceType: CrmInteractionSource.STORE_ORDER,
        sourceId: order.purchaseId ?? String(order.id),
        occurredAt: new Date(),
        amountCents: order.totalCents,
        currency: order.currency,
        metadata: { orderId: order.id, storeId: order.storeId },
      });
    } catch (err) {
      console.warn("[fulfillStoreOrder] Falha ao criar interação CRM", err);
    }
  }

  const promoCodeId =
    typeof meta.promoCodeId === "string" && meta.promoCodeId.trim()
      ? Number(meta.promoCodeId)
      : null;
  if (promoCodeId) {
    try {
      await applyPromoRedemptionOperation({
        purchaseId: order.purchaseId ?? (typeof meta.purchaseId === "string" ? meta.purchaseId : null),
        paymentIntentId: intent.id,
        promoCodeId,
        userId: order.userId ?? (typeof meta.userId === "string" ? meta.userId : null),
        guestEmail: order.customerEmail ?? null,
      });
    } catch (err) {
      console.warn("[fulfillStoreOrder] Falha ao aplicar promo redemption", err);
    }
  }

  if (order.customerEmail) {
    try {
      const orderDetail = await prisma.storeOrder.findUnique({
        where: { id: order.id },
        select: {
          id: true,
          orderNumber: true,
          totalCents: true,
          currency: true,
          customerEmail: true,
          store: {
            select: {
              id: true,
              supportEmail: true,
              supportPhone: true,
              organization: { select: { username: true, publicName: true, businessName: true } },
              ownerUser: { select: { username: true, fullName: true } },
            },
          },
          lines: {
            select: {
              nameSnapshot: true,
              quantity: true,
            },
          },
        },
      });

      if (orderDetail?.customerEmail) {
        const org = orderDetail.store.organization;
        const owner = orderDetail.store.ownerUser;
        const storeName =
          org?.publicName ||
          org?.businessName ||
          org?.username ||
          owner?.fullName ||
          owner?.username ||
          `Loja ${orderDetail.store.id}`;
        const totalLabel = new Intl.NumberFormat("pt-PT", {
          style: "currency",
          currency: orderDetail.currency,
        }).format(orderDetail.totalCents / 100);
        const baseUrl = getAppBaseUrl();
        const trackingUrl = `${baseUrl}/loja/seguimento?orderNumber=${encodeURIComponent(
          orderDetail.orderNumber ?? String(orderDetail.id),
        )}`;
        const orderUrl = order.userId ? `${baseUrl}/me/compras/loja/${orderDetail.id}` : null;

        await sendStoreOrderConfirmationEmail({
          to: orderDetail.customerEmail,
          storeName,
          orderNumber: orderDetail.orderNumber ?? `ORD-${orderDetail.id}`,
          orderTotal: totalLabel,
          items: orderDetail.lines.map((line) => ({
            name: line.nameSnapshot,
            quantity: line.quantity,
          })),
          trackingUrl,
          orderUrl,
          supportEmail: orderDetail.store.supportEmail,
          supportPhone: orderDetail.store.supportPhone,
          replyTo: orderDetail.store.supportEmail,
        });
      }
    } catch (err) {
      console.warn("[fulfillStoreOrder] Falha ao enviar email de compra", err);
    }
  }

  return true;
}
