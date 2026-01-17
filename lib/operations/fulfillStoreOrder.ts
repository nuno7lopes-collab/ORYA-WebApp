import Stripe from "stripe";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { StoreOrderStatus } from "@prisma/client";

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
    select: { id: true, status: true, purchaseId: true },
  });
  if (!order) {
    throw new Error("STORE_ORDER_NOT_FOUND");
  }

  if (order.status === StoreOrderStatus.PAID || order.status === StoreOrderStatus.FULFILLED) {
    return true;
  }

  await prisma.$transaction(async (tx) => {
    const orderLines = await tx.storeOrderLine.findMany({
      where: { orderId: order.id },
      select: { id: true, productId: true },
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

    if (typeof meta.cartId === "string" && meta.cartId.trim()) {
      await tx.storeCart.updateMany({
        where: { id: meta.cartId.trim() },
        data: { status: "ABANDONED" },
      });
    }
  });

  return true;
}
