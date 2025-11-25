// ⚠️ Nunca importar este cliente em componentes com "use client" (apenas backend / API routes).
import { env } from "@/lib/env";
import Stripe from "stripe";

export const stripe = new Stripe(env.stripeSecretKey, {
  apiVersion: "2025-10-29.clover",
  maxNetworkRetries: 2,
  timeout: 20000,
});