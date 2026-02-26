import type Stripe from "stripe";
import { getStripeClient, getStripeClientForEnv, type StripeRuntimeEnv } from "@/lib/stripeClient";
import { getStripeEnv } from "@/lib/stripeKeys";
import { resolveConnectStatus } from "@/domain/finance/stripeConnectStatus";

export type StripeOrgContext = {
  stripeAccountId?: string | null;
  stripeChargesEnabled?: boolean | null;
  stripePayoutsEnabled?: boolean | null;
  orgType?: string | null;
};

export function assertConnectReady(
  org: StripeOrgContext | null | undefined,
  requireStripe = true,
) {
  if (!requireStripe) return;
  const status = resolveConnectStatus(
    org?.stripeAccountId ?? null,
    org?.stripeChargesEnabled ?? false,
    org?.stripePayoutsEnabled ?? false,
  );
  if (status !== "READY") {
    const err = new Error("FINANCE_CONNECT_NOT_READY");
    throw err;
  }
}

export async function createPaymentIntent(
  params: Stripe.PaymentIntentCreateParams,
  opts?: {
    idempotencyKey?: string;
    requireStripe?: boolean;
    org?: StripeOrgContext | null;
  },
) {
  assertConnectReady(opts?.org ?? null, opts?.requireStripe ?? true);
  const stripe = getStripeClient();
  return stripe.paymentIntents.create(
    params,
    opts?.idempotencyKey ? { idempotencyKey: opts.idempotencyKey } : undefined,
  );
}

export async function retrievePaymentIntent(
  id: string,
  params?: Stripe.PaymentIntentRetrieveParams,
) {
  const primaryEnv = getStripeEnv();
  const primary = getStripeClientForEnv(primaryEnv);
  try {
    return primary.paymentIntents.retrieve(id, params as Stripe.PaymentIntentRetrieveParams);
  } catch (err) {
    if (!isNoSuchPaymentIntentError(err)) throw err;
    const fallbackEnv: StripeRuntimeEnv = primaryEnv === "test" ? "prod" : "test";
    const fallback = getStripeClientForEnv(fallbackEnv);
    return fallback.paymentIntents.retrieve(
      id,
      params as Stripe.PaymentIntentRetrieveParams,
    );
  }
}

export async function cancelPaymentIntent(
  id: string,
  params?: Stripe.PaymentIntentCancelParams,
) {
  const stripe = getStripeClient();
  return stripe.paymentIntents.cancel(id, params);
}

export async function createStripeAccount(params: Stripe.AccountCreateParams) {
  const stripe = getStripeClient();
  return stripe.accounts.create(params);
}

export async function createAccountLink(
  params: Stripe.AccountLinkCreateParams,
) {
  const stripe = getStripeClient();
  return stripe.accountLinks.create(params);
}

export async function retrieveStripeAccount(id: string) {
  const stripe = getStripeClient();
  return stripe.accounts.retrieve(id);
}

export async function retrieveStripeEvent(
  id: string,
  params?: Stripe.EventRetrieveParams,
) {
  const primaryEnv = getStripeEnv();
  const primary = getStripeClientForEnv(primaryEnv);
  try {
    return primary.events.retrieve(id, params as Stripe.EventRetrieveParams);
  } catch (err) {
    if (!isNoSuchStripeEventError(err)) throw err;
    const fallbackEnv: StripeRuntimeEnv = primaryEnv === "test" ? "prod" : "test";
    const fallback = getStripeClientForEnv(fallbackEnv);
    return fallback.events.retrieve(
      id,
      params as Stripe.EventRetrieveParams,
    );
  }
}

export async function retrieveCharge(
  id: string,
  params?: Stripe.ChargeRetrieveParams,
) {
  const primaryEnv = getStripeEnv();
  const primary = getStripeClientForEnv(primaryEnv);
  try {
    return primary.charges.retrieve(id, params as Stripe.ChargeRetrieveParams);
  } catch (err) {
    if (!isNoSuchChargeError(err)) throw err;
    const fallbackEnv: StripeRuntimeEnv = primaryEnv === "test" ? "prod" : "test";
    const fallback = getStripeClientForEnv(fallbackEnv);
    return fallback.charges.retrieve(
      id,
      params as Stripe.ChargeRetrieveParams,
    );
  }
}

export async function createRefund(
  params: Stripe.RefundCreateParams,
  opts?: {
    idempotencyKey?: string;
    requireStripe?: boolean;
    org?: StripeOrgContext | null;
    reverseTransfer?: boolean;
    refundApplicationFee?: boolean;
  },
) {
  assertConnectReady(opts?.org ?? null, opts?.requireStripe ?? true);
  const stripe = getStripeClient();
  const requestParams: Stripe.RefundCreateParams = {
    ...params,
    ...(opts?.reverseTransfer ? { reverse_transfer: true } : {}),
    ...(opts?.refundApplicationFee ? { refund_application_fee: true } : {}),
  };
  return stripe.refunds.create(
    requestParams,
    opts?.idempotencyKey ? { idempotencyKey: opts.idempotencyKey } : undefined,
  );
}

export async function createTransfer(
  params: Stripe.TransferCreateParams,
  opts?: {
    idempotencyKey?: string;
    requireStripe?: boolean;
    org?: StripeOrgContext | null;
  },
) {
  assertConnectReady(opts?.org ?? null, opts?.requireStripe ?? true);
  const stripe = getStripeClient();
  return stripe.transfers.create(
    params,
    opts?.idempotencyKey ? { idempotencyKey: opts.idempotencyKey } : undefined,
  );
}

function isNoSuchPaymentIntentError(err: unknown) {
  const anyErr = err as { message?: string; code?: string; statusCode?: number };
  if (anyErr?.code === "resource_missing" || anyErr?.statusCode === 404) return true;
  if (!(err instanceof Error)) return false;
  return err.message.toLowerCase().includes("no such payment_intent");
}

function isNoSuchStripeEventError(err: unknown) {
  const anyErr = err as { message?: string; code?: string; statusCode?: number };
  if (anyErr?.code === "resource_missing" || anyErr?.statusCode === 404) return true;
  if (!(err instanceof Error)) return false;
  return err.message.toLowerCase().includes("no such event");
}

function isNoSuchChargeError(err: unknown) {
  const anyErr = err as { message?: string; code?: string; statusCode?: number };
  if (anyErr?.code === "resource_missing" || anyErr?.statusCode === 404) return true;
  if (!(err instanceof Error)) return false;
  return err.message.toLowerCase().includes("no such charge");
}

export function constructStripeWebhookEvent(
  payload: string | Buffer,
  signature: string,
  secret: string,
): Stripe.Event {
  const stripe = getStripeClient();
  return stripe.webhooks.constructEvent(payload, signature, secret);
}
