import Stripe from "stripe";
import { fulfillStoreOrderIntent } from "@/lib/operations/fulfillStoreOrder";
import { fulfillBookingChargeIntent } from "@/lib/operations/fulfillBookingCharge";
import { fulfillServiceBookingIntent } from "@/lib/operations/fulfillServiceBooking";
import { fulfillServiceCreditPurchaseIntent } from "@/lib/operations/fulfillServiceCredits";
import { fulfillPadelRegistrationIntent } from "@/lib/operations/fulfillPadelRegistration";
import { fulfillPadelSecondCharge } from "@/lib/operations/fulfillPadelSecondCharge";
import { fulfillPaidIntent } from "@/lib/operations/fulfillPaid";

export async function performPaymentFulfillment(
  intent: Stripe.PaymentIntent,
  stripeEventId?: string,
) {
  const handledStore = await fulfillStoreOrderIntent(intent);
  const handledCharge = await fulfillBookingChargeIntent(intent);
  const handledService = handledCharge
    ? false
    : await fulfillServiceBookingIntent(intent);
  const handledCredits = await fulfillServiceCreditPurchaseIntent(intent);
  const handledPadelRegistration = await fulfillPadelRegistrationIntent(
    intent,
    null,
  );
  const handledSecondCharge = await fulfillPadelSecondCharge(intent);
  const handledPaid =
    handledStore ||
    handledCharge ||
    handledService ||
    handledCredits ||
    handledPadelRegistration ||
    handledSecondCharge
      ? true
      : await fulfillPaidIntent(intent, stripeEventId);

  return {
    handled:
      handledStore ||
      handledCharge ||
      handledService ||
      handledCredits ||
      handledPadelRegistration ||
      handledSecondCharge ||
      handledPaid,
    handledStore,
    handledCharge,
    handledService,
    handledCredits,
    handledPadelRegistration,
    handledSecondCharge,
    handledPaid,
  };
}
