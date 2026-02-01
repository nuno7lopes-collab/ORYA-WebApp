import type Stripe from "stripe";
import { getStripeClient } from "@/lib/stripeClient";
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
  const stripe = getStripeClient();
  return stripe.paymentIntents.retrieve(id, params as Stripe.PaymentIntentRetrieveParams);
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

export async function retrieveCharge(
  id: string,
  params?: Stripe.ChargeRetrieveParams,
) {
  const stripe = getStripeClient();
  return stripe.charges.retrieve(id, params as Stripe.ChargeRetrieveParams);
}

export async function createRefund(
  params: Stripe.RefundCreateParams,
  opts?: {
    idempotencyKey?: string;
    requireStripe?: boolean;
    org?: StripeOrgContext | null;
  },
) {
  assertConnectReady(opts?.org ?? null, opts?.requireStripe ?? true);
  const stripe = getStripeClient();
  return stripe.refunds.create(
    params,
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

export function constructStripeWebhookEvent(
  payload: string | Buffer,
  signature: string,
  secret: string,
): Stripe.Event {
  const stripe = getStripeClient();
  return stripe.webhooks.constructEvent(payload, signature, secret);
}
