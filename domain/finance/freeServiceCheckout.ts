import type Stripe from "stripe";
import { SourceType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fulfillServiceBookingIntent } from "@/lib/operations/fulfillServiceBooking";

type FinalizeFreeServiceBookingParams = {
  bookingId: number;
  serviceId: number;
  orgId: number;
  userId?: string | null;
  guestEmail?: string | null;
  currency?: string | null;
  paymentMethod?: "mbway" | "card";
};

function buildFreeIntent(params: FinalizeFreeServiceBookingParams): Stripe.PaymentIntent {
  return {
    id: `free_booking_${params.bookingId}`,
    amount: 0,
    amount_received: 0,
    currency: (params.currency ?? "eur").toLowerCase(),
    livemode: false,
    latest_charge: null,
    metadata: {
      serviceBooking: "1",
      bookingId: String(params.bookingId),
      serviceId: String(params.serviceId),
      orgId: String(params.orgId),
      userId: params.userId ?? "",
      guestEmail: params.guestEmail ?? "",
      paymentScenario: "FREE_CHECKOUT",
      paymentMethod: params.paymentMethod ?? "card",
      sourceType: SourceType.BOOKING,
      sourceId: String(params.bookingId),
      grossAmountCents: "0",
      platformFeeCents: "0",
      payoutAmountCents: "0",
      cardPlatformFeeCents: "0",
      cardPlatformFeeBps: "0",
      feeMode: "INCLUDED",
    },
  } as unknown as Stripe.PaymentIntent;
}

export async function finalizeFreeServiceBooking(params: FinalizeFreeServiceBookingParams): Promise<{
  purchaseId: string;
  paymentIntentId: string;
}> {
  const freeIntent = buildFreeIntent(params);
  await fulfillServiceBookingIntent(freeIntent);

  const payment = await prisma.payment.findFirst({
    where: {
      sourceType: SourceType.BOOKING,
      sourceId: String(params.bookingId),
    },
    select: { id: true },
  });

  return {
    purchaseId: payment?.id ?? `booking_${params.bookingId}_v1`,
    paymentIntentId: freeIntent.id,
  };
}
