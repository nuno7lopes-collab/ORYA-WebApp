export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import type Stripe from "stripe";
import { NextRequest } from "next/server";
import { enqueueOperation } from "@/lib/operations/enqueue";
import { retrieveStripeEvent } from "@/domain/finance/gateway/stripeGateway";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { requireInternalSecret } from "@/lib/security/requireInternalSecret";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

function ensureInternalSecret(req: NextRequest, ctx: { requestId: string; correlationId: string }) {
  if (!requireInternalSecret(req)) {
    return respondError(
      ctx,
      { errorCode: "UNAUTHORIZED", message: "Unauthorized.", retryable: false },
      { status: 401 },
    );
  }
  return null;
}

function normalizeString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function normalizePaymentIntentId(value: unknown) {
  const normalized = normalizeString(value);
  return normalized && normalized.startsWith("pi_") ? normalized : null;
}

function extractPaymentIntentIdFromObject(object: Record<string, unknown> | null) {
  if (!object) return null;
  const paymentIntentRaw = object.payment_intent;
  if (typeof paymentIntentRaw === "string") return normalizePaymentIntentId(paymentIntentRaw);
  if (paymentIntentRaw && typeof paymentIntentRaw === "object") {
    const nestedId = normalizeString((paymentIntentRaw as { id?: unknown }).id);
    return normalizePaymentIntentId(nestedId);
  }
  return normalizePaymentIntentId(object.id);
}

function extractPurchaseIdFromMetadata(object: Record<string, unknown> | null) {
  if (!object || typeof object.metadata !== "object" || !object.metadata) return null;
  const metadata = object.metadata as Record<string, unknown>;
  return normalizeString(metadata.purchaseId ?? metadata.purchase_id);
}

function toSerializableObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

function mapStripeEventForOperation(params: {
  stripeEvent: Stripe.Event;
  fallbackPaymentIntentId: string | null;
}) {
  const { stripeEvent, fallbackPaymentIntentId } = params;
  const object = toSerializableObject(stripeEvent.data.object);
  const paymentIntentId = extractPaymentIntentIdFromObject(object) ?? fallbackPaymentIntentId;
  const purchaseId = extractPurchaseIdFromMetadata(object);

  switch (stripeEvent.type) {
    case "payment_intent.succeeded": {
      if (!paymentIntentId) {
        throw new Error("MISSING_PAYMENT_INTENT_ID");
      }
      return {
        paymentIntentId,
        purchaseId,
        payload: {
          stripeEventType: "payment_intent.succeeded",
          paymentIntentId,
          purchaseId,
          stripeEventId: stripeEvent.id,
        },
      };
    }
    case "charge.refunded": {
      const chargeId = normalizeString(object?.id);
      if (!chargeId) throw new Error("MISSING_CHARGE_ID");
      return {
        paymentIntentId,
        purchaseId,
        payload: {
          stripeEventType: "charge.refunded",
          chargeId,
          paymentIntentId,
          purchaseId,
          stripeEventId: stripeEvent.id,
        },
      };
    }
    case "charge.dispute.created":
    case "charge.dispute.closed": {
      const disputeStatus = normalizeString(object?.status)?.toLowerCase();
      const disputeOutcome =
        disputeStatus === "won" ? "WON" : disputeStatus === "lost" ? "LOST" : null;
      if (stripeEvent.type === "charge.dispute.closed" && !disputeOutcome) {
        throw new Error("MISSING_DISPUTE_OUTCOME");
      }
      return {
        paymentIntentId,
        purchaseId,
        payload: {
          stripeEventType:
            stripeEvent.type === "charge.dispute.created"
              ? "payment.dispute_opened"
              : "payment.dispute_closed",
          stripeEventId: stripeEvent.id,
          paymentIntentId,
          purchaseId,
          stripeEventObject: {
            ...(object ?? {}),
            outcome: disputeOutcome,
          },
        },
      };
    }
    default:
      throw new Error(`UNSUPPORTED_STRIPE_EVENT_TYPE:${stripeEvent.type}`);
  }
}

function isNoSuchStripeEventError(err: unknown) {
  if (!(err instanceof Error)) return false;
  return err.message.toLowerCase().includes("no such event");
}

async function _POST(req: NextRequest) {
  const ctx = getRequestContext(req);
  const unauthorized = ensureInternalSecret(req, ctx);
  if (unauthorized) return unauthorized;

  const body = (await req.json().catch(() => null)) as {
    stripeEventId?: string;
    paymentIntentId?: string | null;
  } | null;
  const stripeEventId = typeof body?.stripeEventId === "string" ? body.stripeEventId.trim() : "";
  const paymentIntentId = normalizePaymentIntentId(body?.paymentIntentId ?? null);

  if (!stripeEventId) {
    return respondError(
      ctx,
      { errorCode: "INVALID_STRIPE_EVENT_ID", message: "stripeEventId inválido.", retryable: false },
      { status: 400 },
    );
  }

  let stripeEvent: Stripe.Event;
  try {
    stripeEvent = await retrieveStripeEvent(stripeEventId);
  } catch (err) {
    const notFound = isNoSuchStripeEventError(err);
    return respondError(
      ctx,
      {
        errorCode: notFound ? "STRIPE_EVENT_NOT_FOUND" : "STRIPE_EVENT_FETCH_FAILED",
        message: notFound ? "Evento Stripe não encontrado." : "Falha ao ler evento Stripe.",
        retryable: !notFound,
      },
      { status: notFound ? 404 : 502 },
    );
  }

  let mapped: ReturnType<typeof mapStripeEventForOperation>;
  try {
    mapped = mapStripeEventForOperation({
      stripeEvent,
      fallbackPaymentIntentId: paymentIntentId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.startsWith("UNSUPPORTED_STRIPE_EVENT_TYPE:")) {
      return respondError(
        ctx,
        {
          errorCode: "UNSUPPORTED_STRIPE_EVENT_TYPE",
          message: `Tipo de evento não suportado: ${stripeEvent.type}.`,
          retryable: false,
        },
        { status: 400 },
      );
    }
    if (message === "MISSING_PAYMENT_INTENT_ID") {
      return respondError(
        ctx,
        {
          errorCode: "MISSING_PAYMENT_INTENT_ID",
          message: "Evento Stripe sem paymentIntentId válido.",
          retryable: false,
        },
        { status: 400 },
      );
    }
    if (message === "MISSING_CHARGE_ID") {
      return respondError(
        ctx,
        {
          errorCode: "MISSING_CHARGE_ID",
          message: "Evento Stripe sem chargeId válido.",
          retryable: false,
        },
        { status: 400 },
      );
    }
    if (message === "MISSING_DISPUTE_OUTCOME") {
      return respondError(
        ctx,
        {
          errorCode: "MISSING_DISPUTE_OUTCOME",
          message: "Disputa fechada sem outcome válido.",
          retryable: false,
        },
        { status: 400 },
      );
    }
    throw err;
  }

  await enqueueOperation({
    operationType: "PROCESS_STRIPE_EVENT",
    dedupeKey: stripeEvent.id,
    forceRequeue: true,
    correlations: {
      stripeEventId: stripeEvent.id,
      paymentIntentId: mapped.paymentIntentId,
      purchaseId: mapped.purchaseId,
    },
    payload: mapped.payload,
  });

  return respondOk(
    ctx,
    {
      requeued: true,
      operationType: "PROCESS_STRIPE_EVENT",
      dedupeKey: stripeEvent.id,
      stripeEventType: mapped.payload.stripeEventType,
    },
    { status: 200 },
  );
}
export const POST = withApiEnvelope(_POST);
