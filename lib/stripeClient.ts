// ⚠️ Nunca importar este cliente em componentes com "use client" (apenas backend / API routes).
import "server-only";
import Stripe from "stripe";
import { getAppEnv } from "@/lib/appEnv";
import { getStripeSecretKeyForEnv } from "@/lib/stripeKeys";

const cached: { prod?: Stripe; test?: Stripe } = {};

export function getStripeClient() {
  const env = getAppEnv();
  if (env === "test" && cached.test) return cached.test;
  if (env === "prod" && cached.prod) return cached.prod;
  const client = new Stripe(getStripeSecretKeyForEnv(env), {
    maxNetworkRetries: 2,
    timeout: 20000,
  });
  if (env === "test") cached.test = client;
  else cached.prod = client;
  return client;
}
