// lib/stripeClient.ts
import { loadStripe, Stripe } from "@stripe/stripe-js";

let stripePromise: Promise<Stripe | null> | null = null;

export function getStripe() {
  if (!stripePromise) {
    const pk = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

    if (!pk) {
      console.warn(
        "[stripeClient] NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY em falta. O checkout nativo não vai funcionar."
      );
      // Mesmo assim devolvemos uma promise resolvida a null para não rebentar o app
      stripePromise = Promise.resolve(null);
    } else {
      stripePromise = loadStripe(pk);
    }
  }

  return stripePromise;
}