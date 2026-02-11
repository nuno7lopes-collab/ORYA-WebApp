import Stripe from "stripe";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { CrmInteractionSource, CrmInteractionType, EntitlementStatus, EntitlementType, StoreInventoryMovementType, StoreOrderStatus, StoreStockPolicy } from "@prisma/client";
import { ingestCrmInteraction } from "@/lib/crm/ingest";
import { sendStoreOrderConfirmationEmail } from "@/lib/emailSender";
import { getAppBaseUrl } from "@/lib/appBaseUrl";
import { applyPromoRedemptionOperation } from "@/lib/operations/applyPromoRedemption";
import { logError, logWarn } from "@/lib/observability/logger";
import { normalizeEmail } from "@/lib/utils/email";
import { ensureEmailIdentity, resolveIdentityForUser } from "@/lib/ownership/identity";

function parseId(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}

const DEFAULT_TIMEZONE = "Europe/Lisbon";

function buildOwnerKey(params: { ownerUserId?: string | null; ownerIdentityId?: string | null; guestEmail?: string | null }) {
  const { ownerUserId, ownerIdentityId, guestEmail } = params;
  if (ownerIdentityId) return `identity:${ownerIdentityId}`;
  if (ownerUserId) return `user:${ownerUserId}`;
  const normalized = normalizeEmail(guestEmail);
  if (normalized) return `email:${normalized}`;
  return "unknown";
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
      createdAt: true,
      storeId: true,
      store: { select: { ownerOrganizationId: true } },
    },
  });
  if (!order) {
    throw new Error("STORE_ORDER_NOT_FOUND");
  }

  const resolvedPurchaseId =
    (typeof meta.purchaseId === "string" && meta.purchaseId.trim()
      ? meta.purchaseId.trim()
      : order.purchaseId) ?? `store_order_${order.id}`;
  const ownerUserId = order.userId ?? (typeof meta.userId === "string" ? meta.userId : null);
  const ownerEmail = order.customerEmail ?? (typeof meta.customerEmail === "string" ? meta.customerEmail : null);
  let ownerIdentityId: string | null = null;
  if (ownerUserId) {
    const identity = await resolveIdentityForUser({ userId: ownerUserId, email: ownerEmail });
    ownerIdentityId = identity.id;
  } else if (ownerEmail) {
    const identity = await ensureEmailIdentity({ email: ownerEmail });
    ownerIdentityId = identity.id;
  }
  const entitlementOwnerUserId = ownerIdentityId ? null : ownerUserId;
  const ownerKey = buildOwnerKey({ ownerUserId: entitlementOwnerUserId, ownerIdentityId, guestEmail: ownerEmail });
  const snapshotStartAt = order.createdAt ?? new Date();
  let paymentApplied = false;

  await prisma.$transaction(async (tx) => {
    const orderLines = await tx.storeOrderLine.findMany({
      where: { orderId: order.id },
      select: {
        id: true,
        productId: true,
        variantId: true,
        quantity: true,
        nameSnapshot: true,
        product: { select: { stockPolicy: true, stockQty: true } },
        variant: { select: { stockQty: true } },
      },
    });

    const updateResult = await tx.storeOrder.updateMany({
      where: { id: order.id, status: StoreOrderStatus.PENDING },
      data: {
        status: StoreOrderStatus.PAID,
        paymentIntentId: intent.id,
        purchaseId: resolvedPurchaseId,
      },
    });
    paymentApplied = updateResult.count > 0;
    if (!paymentApplied) {
      await tx.storeOrder.updateMany({
        where: { id: order.id, paymentIntentId: null },
        data: { paymentIntentId: intent.id },
      });
      await tx.storeOrder.updateMany({
        where: { id: order.id, OR: [{ purchaseId: null }, { purchaseId: "" }] },
        data: { purchaseId: resolvedPurchaseId },
      });
    }

    for (const line of orderLines) {
      const quantity = Math.max(1, Number(line.quantity ?? 1));
      for (let i = 0; i < quantity; i += 1) {
        await tx.entitlement.upsert({
          where: {
            storeOrderLineId_lineItemIndex_ownerKey_type: {
              storeOrderLineId: line.id,
              lineItemIndex: i,
              ownerKey,
              type: EntitlementType.STORE_ITEM,
            },
          },
          update: {
            status: EntitlementStatus.ACTIVE,
            ownerUserId: entitlementOwnerUserId,
            ownerIdentityId,
            purchaseId: resolvedPurchaseId,
            snapshotTitle: line.nameSnapshot,
            snapshotCoverUrl: null,
            snapshotVenueName: null,
            snapshotStartAt,
            snapshotTimezone: DEFAULT_TIMEZONE,
          },
          create: {
            type: EntitlementType.STORE_ITEM,
            status: EntitlementStatus.ACTIVE,
            ownerUserId: entitlementOwnerUserId,
            ownerIdentityId,
            ownerKey,
            purchaseId: resolvedPurchaseId,
            storeOrderLineId: line.id,
            lineItemIndex: i,
            snapshotTitle: line.nameSnapshot,
            snapshotCoverUrl: null,
            snapshotVenueName: null,
            snapshotStartAt,
            snapshotTimezone: DEFAULT_TIMEZONE,
          },
        });
      }
    }

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
            userId: ownerUserId ?? null,
            downloadToken: token,
          },
        });
      }
    }

    if (paymentApplied) {
      for (const line of orderLines) {
        if (!line.productId || !line.product || line.product.stockPolicy !== StoreStockPolicy.TRACKED) continue;
        if (line.variantId) {
          const updated = await tx.storeProductVariant.updateMany({
            where: { id: line.variantId, productId: line.productId, stockQty: { gte: line.quantity } },
            data: { stockQty: { decrement: line.quantity } },
          });
          if (updated.count === 0) {
            logWarn("fulfill_store_order.stock_insufficient_variant", {
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
          logWarn("fulfill_store_order.stock_insufficient_product", {
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
    }

    if (typeof meta.cartId === "string" && meta.cartId.trim()) {
      await tx.storeCart.updateMany({
        where: { id: meta.cartId.trim() },
        data: { status: "ABANDONED" },
      });
    }
  });

  if (order.store?.ownerOrganizationId && (order.userId || ownerIdentityId)) {
    try {
      await ingestCrmInteraction({
        organizationId: order.store.ownerOrganizationId,
        userId: order.userId ?? undefined,
        emailIdentityId: ownerIdentityId ?? undefined,
        type: CrmInteractionType.STORE_ORDER_PAID,
        sourceType: CrmInteractionSource.STORE_ORDER,
        sourceId: resolvedPurchaseId,
        occurredAt: new Date(),
        amountCents: order.totalCents,
        currency: order.currency,
        contactEmail: order.customerEmail ?? ownerEmail ?? undefined,
        metadata: { orderId: order.id, storeId: order.storeId },
      });
    } catch (err) {
      logError("fulfill_store_order.crm_interaction_failed", err, { orderId: order.id });
    }
  }

  const promoCodeId =
    typeof meta.promoCodeId === "string" && meta.promoCodeId.trim()
      ? Number(meta.promoCodeId)
      : null;
  if (promoCodeId) {
    try {
      await applyPromoRedemptionOperation({
        purchaseId: resolvedPurchaseId,
        paymentIntentId: intent.id,
        promoCodeId,
        userId: ownerUserId,
        guestEmail: ownerEmail ?? null,
      });
    } catch (err) {
      logError("fulfill_store_order.apply_promo_failed", err, { orderId: order.id });
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
      logError("fulfill_store_order.email_failed", err, { orderId: order.id });
    }
  }

  return true;
}
