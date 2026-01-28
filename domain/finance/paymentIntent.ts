import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import {
  createCheckout,
  type PricingSnapshot,
  type ResolvedSnapshotOverride,
} from "@/domain/finance/checkout";
import {
  createPaymentIntent,
  retrievePaymentIntent,
  type StripeOrgContext,
} from "@/domain/finance/gateway/stripeGateway";
import { checkoutKey, clampIdempotencyKey } from "@/lib/stripe/idempotency";
import { paymentEventRepo } from "@/domain/finance/readModelConsumer";
import { PaymentEventSource, PaymentStatus, type SourceType } from "@prisma/client";

const TERMINAL_INTENT_STATUSES = new Set([
  "succeeded",
  "canceled",
  "requires_capture",
]);

function isTerminalIntentStatus(status?: string | null) {
  return Boolean(status && TERMINAL_INTENT_STATUSES.has(status));
}

function normalizePurchaseId(purchaseId: string) {
  const normalized = purchaseId.trim();
  if (!normalized) {
    throw new Error("PURCHASE_ID_REQUIRED");
  }
  return normalized;
}

export type EnsurePaymentIntentInput = {
  purchaseId: string;
  sourceType: SourceType;
  sourceId: string;
  amountCents: number;
  currency: string;
  intentParams?: Omit<Stripe.PaymentIntentCreateParams, "amount" | "currency">;
  metadata: Record<string, string>;
  orgContext?: StripeOrgContext | null;
  requireStripe: boolean;
  clientIdempotencyKey?: string | null;
  resolvedSnapshot?: ResolvedSnapshotOverride | null;
  buyerIdentityRef?: string | null;
  inviteToken?: string | null;
  skipAccessChecks?: boolean;
  paymentEvent?: {
    eventId?: number | null;
    userId?: string | null;
    amountCents?: number | null;
    platformFeeCents?: number | null;
  };
};

export type EnsurePaymentIntentResult = {
  purchaseId: string;
  paymentId: string;
  idempotencyKey: string;
  paymentIntent: Stripe.PaymentIntent;
  reused: boolean;
};

export async function ensurePaymentIntent(
  input: EnsurePaymentIntentInput,
): Promise<EnsurePaymentIntentResult> {
  const purchaseId = normalizePurchaseId(input.purchaseId);
  const checkoutIdempotencyKey = checkoutKey(purchaseId);
  const requestedAmount = Math.max(0, input.amountCents);

  // Materialize the financial SSOT (Payment + Ledger) before touching Stripe.
  await createCheckout({
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    idempotencyKey: checkoutIdempotencyKey,
    paymentId: purchaseId,
    resolvedSnapshot: input.resolvedSnapshot ?? null,
    buyerIdentityRef: input.buyerIdentityRef ?? null,
    inviteToken: input.inviteToken ?? null,
    skipAccessChecks: input.skipAccessChecks ?? false,
  });

  const payment = await prisma.payment.findUnique({
    where: { id: purchaseId },
    select: {
      pricingSnapshotJson: true,
    },
  });
  const snapshot = (payment?.pricingSnapshotJson ?? null) as PricingSnapshot | null;
  const snapshotTotal = typeof snapshot?.total === "number" ? snapshot.total : null;
  if (snapshotTotal != null && snapshotTotal !== requestedAmount) {
    throw new Error("IDEMPOTENCY_KEY_PAYLOAD_MISMATCH");
  }
  const expectedAmount = snapshotTotal ?? requestedAmount;

  const existingEvent = await prisma.paymentEvent.findFirst({
    where: {
      OR: [{ dedupeKey: checkoutIdempotencyKey }, { purchaseId }],
    },
    select: {
      stripePaymentIntentId: true,
      amountCents: true,
      attempt: true,
    },
  });

  if (existingEvent?.amountCents != null && existingEvent.amountCents !== expectedAmount) {
    throw new Error("IDEMPOTENCY_KEY_PAYLOAD_MISMATCH");
  }

  if (existingEvent?.stripePaymentIntentId?.startsWith("pi_")) {
    let existingIntent: Stripe.PaymentIntent;
    try {
      existingIntent = await retrievePaymentIntent(existingEvent.stripePaymentIntentId);
    } catch (err) {
      console.warn(
        "[finance/paymentIntent] failed to retrieve existing PaymentIntent",
        err,
      );
      throw new Error("PAYMENT_INTENT_RETRIEVE_FAILED");
    }
    if (typeof existingIntent.amount === "number" && existingIntent.amount !== expectedAmount) {
      throw new Error("IDEMPOTENCY_KEY_PAYLOAD_MISMATCH");
    }
    const terminal = isTerminalIntentStatus(existingIntent.status);
    if (!terminal) {
      await paymentEventRepo(prisma).upsert({
        where: { purchaseId },
        update: {
          stripePaymentIntentId: existingIntent.id,
          dedupeKey: checkoutIdempotencyKey,
          status: "PROCESSING",
          source: PaymentEventSource.API,
          amountCents:
            input.paymentEvent?.amountCents ??
            existingIntent.amount ??
            existingEvent.amountCents ??
            null,
          platformFeeCents: input.paymentEvent?.platformFeeCents ?? null,
          eventId:
            typeof input.paymentEvent?.eventId === "number"
              ? input.paymentEvent.eventId
              : undefined,
          userId: input.paymentEvent?.userId ?? undefined,
          updatedAt: new Date(),
          mode: existingIntent.livemode ? "LIVE" : "TEST",
          isTest: !existingIntent.livemode,
        },
        create: {
          purchaseId,
          stripePaymentIntentId: existingIntent.id,
          dedupeKey: checkoutIdempotencyKey,
          status: "PROCESSING",
          source: PaymentEventSource.API,
          amountCents:
            input.paymentEvent?.amountCents ??
            existingIntent.amount ??
            existingEvent.amountCents ??
            null,
          platformFeeCents: input.paymentEvent?.platformFeeCents ?? null,
          eventId:
            typeof input.paymentEvent?.eventId === "number"
              ? input.paymentEvent.eventId
              : undefined,
          userId: input.paymentEvent?.userId ?? undefined,
          attempt: existingEvent.attempt ?? 1,
          mode: existingIntent.livemode ? "LIVE" : "TEST",
          isTest: !existingIntent.livemode,
        },
      });
      await prisma.payment.updateMany({
        where: {
          id: purchaseId,
          status: {
            in: [
              PaymentStatus.CREATED,
              PaymentStatus.REQUIRES_ACTION,
              PaymentStatus.PROCESSING,
            ],
          },
        },
        data: { status: PaymentStatus.REQUIRES_ACTION },
      });
      return {
        purchaseId,
        paymentId: purchaseId,
        idempotencyKey: checkoutIdempotencyKey,
        paymentIntent: existingIntent,
        reused: true,
      };
    }
  }

  const metadata: Record<string, string> = {
    ...input.metadata,
    purchaseId,
    paymentId: purchaseId,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    idempotencyKey: checkoutIdempotencyKey,
  };
  if (input.clientIdempotencyKey?.trim()) {
    metadata.clientIdempotencyKey = input.clientIdempotencyKey.trim();
  }

  const intentParams: Stripe.PaymentIntentCreateParams = {
    ...(input.intentParams ?? {}),
    amount: expectedAmount,
    currency: input.currency.toLowerCase(),
    metadata,
  };

  const stripeIdempotencyKey =
    input.clientIdempotencyKey && input.clientIdempotencyKey.trim()
      ? clampIdempotencyKey(
          `${checkoutIdempotencyKey}:${input.clientIdempotencyKey.trim()}`,
        )
      : checkoutIdempotencyKey;

  const createPi = async (idemKey?: string) =>
    createPaymentIntent(intentParams, {
      idempotencyKey: idemKey,
      requireStripe: input.requireStripe,
      org: input.orgContext ?? null,
    });

  let paymentIntent: Stripe.PaymentIntent;
  try {
    paymentIntent = await createPi(stripeIdempotencyKey);
  } catch (err: unknown) {
    const anyErr = err as { type?: string; code?: string; message?: string };
    const isIdem =
      anyErr?.type === "StripeIdempotencyError" ||
      anyErr?.code === "idempotency_error" ||
      (typeof anyErr?.message === "string" &&
        anyErr.message.toLowerCase().includes("idempot"));
    if (isIdem) {
      throw new Error("IDEMPOTENCY_KEY_PAYLOAD_MISMATCH");
    }
    throw err;
  }

  if (isTerminalIntentStatus(paymentIntent.status)) {
    throw new Error("PAYMENT_INTENT_TERMINAL");
  }
  if (typeof paymentIntent.amount === "number" && paymentIntent.amount !== expectedAmount) {
    throw new Error("IDEMPOTENCY_KEY_PAYLOAD_MISMATCH");
  }

  const nextAttempt = Math.max(1, (existingEvent?.attempt ?? 0) + 1);
  const amountCents =
    input.paymentEvent?.amountCents ?? paymentIntent.amount ?? null;

  await paymentEventRepo(prisma).upsert({
    where: { purchaseId },
    update: {
      stripePaymentIntentId: paymentIntent.id,
      dedupeKey: checkoutIdempotencyKey,
      status: "PROCESSING",
      source: PaymentEventSource.API,
      amountCents,
      platformFeeCents: input.paymentEvent?.platformFeeCents ?? null,
      eventId:
        typeof input.paymentEvent?.eventId === "number"
          ? input.paymentEvent.eventId
          : undefined,
      userId: input.paymentEvent?.userId ?? undefined,
      attempt: nextAttempt,
      updatedAt: new Date(),
      mode: paymentIntent.livemode ? "LIVE" : "TEST",
      isTest: !paymentIntent.livemode,
    },
    create: {
      purchaseId,
      stripePaymentIntentId: paymentIntent.id,
      dedupeKey: checkoutIdempotencyKey,
      status: "PROCESSING",
      source: PaymentEventSource.API,
      amountCents,
      platformFeeCents: input.paymentEvent?.platformFeeCents ?? null,
      eventId:
        typeof input.paymentEvent?.eventId === "number"
          ? input.paymentEvent.eventId
          : undefined,
      userId: input.paymentEvent?.userId ?? undefined,
      attempt: nextAttempt,
      mode: paymentIntent.livemode ? "LIVE" : "TEST",
      isTest: !paymentIntent.livemode,
    },
  });

  await prisma.payment.updateMany({
    where: {
      id: purchaseId,
      status: {
        in: [
          PaymentStatus.CREATED,
          PaymentStatus.REQUIRES_ACTION,
          PaymentStatus.PROCESSING,
        ],
      },
    },
    data: { status: PaymentStatus.REQUIRES_ACTION },
  });

  return {
    purchaseId,
    paymentId: purchaseId,
    idempotencyKey: checkoutIdempotencyKey,
    paymentIntent,
    reused: false,
  };
}
