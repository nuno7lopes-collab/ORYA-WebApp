import type Stripe from "stripe";
import { stripe } from "@/lib/stripeClient";
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
  params: Parameters<typeof stripe.paymentIntents.create>[0],
  opts?: {
    idempotencyKey?: string;
    requireStripe?: boolean;
    org?: StripeOrgContext | null;
  },
) {
  assertConnectReady(opts?.org ?? null, opts?.requireStripe ?? true);
  return stripe.paymentIntents.create(
    params,
    opts?.idempotencyKey ? { idempotencyKey: opts.idempotencyKey } : undefined,
  );
}

export async function retrievePaymentIntent(
  id: string,
  params?: Parameters<typeof stripe.paymentIntents.retrieve>[1],
) {
  return stripe.paymentIntents.retrieve(id, params);
}

export async function cancelPaymentIntent(
  id: string,
  params?: Parameters<typeof stripe.paymentIntents.cancel>[1],
) {
  return stripe.paymentIntents.cancel(id, params);
}

export async function createStripeAccount(
  params: Parameters<typeof stripe.accounts.create>[0],
) {
  return stripe.accounts.create(params);
}

export async function createAccountLink(
  params: Parameters<typeof stripe.accountLinks.create>[0],
) {
  return stripe.accountLinks.create(params);
}

export async function retrieveStripeAccount(id: string) {
  return stripe.accounts.retrieve(id);
}

export async function retrieveCharge(
  id: string,
  params?: Parameters<typeof stripe.charges.retrieve>[1],
) {
  return stripe.charges.retrieve(id, params);
}

export async function createRefund(
  params: Parameters<typeof stripe.refunds.create>[0],
  opts?: {
    idempotencyKey?: string;
    requireStripe?: boolean;
    org?: StripeOrgContext | null;
  },
) {
  assertConnectReady(opts?.org ?? null, opts?.requireStripe ?? true);
  return stripe.refunds.create(
    params,
    opts?.idempotencyKey ? { idempotencyKey: opts.idempotencyKey } : undefined,
  );
}

export async function createTransfer(
  params: Parameters<typeof stripe.transfers.create>[0],
  opts?: {
    idempotencyKey?: string;
    requireStripe?: boolean;
    org?: StripeOrgContext | null;
  },
) {
  assertConnectReady(opts?.org ?? null, opts?.requireStripe ?? true);
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
  return stripe.webhooks.constructEvent(payload, signature, secret);
}
