import type Stripe from "stripe";
import { fulfillStoreOrderIntent } from "@/lib/operations/fulfillStoreOrder";

type FinalizeFreeStoreCheckoutParams = {
  orderId: number;
  storeId: number;
  purchaseId: string;
  cartId?: string | null;
  promoCodeId?: number | null;
  userId?: string | null;
  customerEmail?: string | null;
  currency?: string | null;
};

function buildFreeIntent(params: FinalizeFreeStoreCheckoutParams): Stripe.PaymentIntent {
  return {
    id: `free_store_order_${params.orderId}`,
    amount: 0,
    amount_received: 0,
    currency: (params.currency ?? "eur").toLowerCase(),
    livemode: false,
    latest_charge: null,
    metadata: {
      storeOrderId: String(params.orderId),
      storeId: String(params.storeId),
      purchaseId: params.purchaseId,
      cartId: params.cartId ?? "",
      userId: params.userId ?? "",
      customerEmail: params.customerEmail ?? "",
      promoCodeId: params.promoCodeId ? String(params.promoCodeId) : "",
      paymentScenario: "FREE_CHECKOUT",
      grossAmountCents: "0",
      platformFeeCents: "0",
      payoutAmountCents: "0",
      sourceType: "STORE_ORDER",
      sourceId: String(params.orderId),
    },
  } as unknown as Stripe.PaymentIntent;
}

export async function finalizeFreeStoreCheckout(params: FinalizeFreeStoreCheckoutParams): Promise<{
  purchaseId: string;
  paymentIntentId: string;
}> {
  const freeIntent = buildFreeIntent(params);
  await fulfillStoreOrderIntent(freeIntent);
  return {
    purchaseId: params.purchaseId,
    paymentIntentId: freeIntent.id,
  };
}
