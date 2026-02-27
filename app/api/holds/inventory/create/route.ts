export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { createInventoryHold } from "@/lib/holds/inventoryHold";
import { resolveInventorySubject } from "@/lib/holds/inventorySubject";

type CreatePayload = {
  orgId?: number;
  storeId?: number;
  eventId?: number;
  productId?: number;
  variantId?: number | null;
  ticketTypeId?: number | null;
  quantity?: number;
  clientSessionId?: string;
  subjectFingerprint?: string | null;
  metadata?: Record<string, unknown>;
};

function parsePayload(input: unknown): CreatePayload {
  const payload =
    input && typeof input === "object"
      ? (input as Record<string, unknown>)
      : {};
  return {
    orgId: Number(payload.orgId),
    storeId: Number(payload.storeId),
    eventId: Number(payload.eventId),
    productId: Number(payload.productId),
    variantId:
      payload.variantId === null || payload.variantId === undefined
        ? null
        : Number(payload.variantId),
    ticketTypeId:
      payload.ticketTypeId === null || payload.ticketTypeId === undefined
        ? null
        : Number(payload.ticketTypeId),
    quantity: Number(payload.quantity),
    clientSessionId: String(payload.clientSessionId ?? ""),
    subjectFingerprint:
      typeof payload.subjectFingerprint === "string"
        ? payload.subjectFingerprint
        : null,
    metadata:
      payload.metadata && typeof payload.metadata === "object"
        ? (payload.metadata as Record<string, unknown>)
        : {},
  };
}

async function _POST(req: NextRequest) {
  const ctx = getRequestContext(req);
  const body = await req.json().catch(() => ({}));
  const payload = parsePayload(body);

  const subject = await resolveInventorySubject({
    orgId: payload.orgId,
    storeId: payload.storeId,
    eventId: payload.eventId,
    productId: payload.productId,
    variantId: payload.variantId,
    ticketTypeId: payload.ticketTypeId,
  });
  if (!subject.ok) {
    return respondError(
      ctx,
      {
        errorCode: subject.code,
        message: subject.message,
        retryable: false,
      },
      { status: subject.status },
    );
  }

  if (!subject.subject.limited || subject.subject.maxStock === null) {
    return respondOk(
      ctx,
      {
        holdRequired: false,
        holdId: null,
        expiresAt: null,
        quantity: Math.max(1, Number(payload.quantity ?? 1)),
        subjectFingerprint: subject.subject.subjectFingerprint,
      },
      { status: 200 },
    );
  }

  const hold = await createInventoryHold({
    orgId: subject.subject.orgId,
    subjectType: subject.subject.subjectType,
    subjectFingerprint: payload.subjectFingerprint ?? subject.subject.subjectFingerprint,
    quantity: Number(payload.quantity),
    maxStock: subject.subject.maxStock,
    clientSessionId: String(payload.clientSessionId ?? ""),
    storeId: subject.subject.kind === "STORE_ITEM" ? subject.subject.storeId : null,
    eventId: subject.subject.kind === "TICKET_TYPE" ? subject.subject.eventId : null,
    productId: subject.subject.kind === "STORE_ITEM" ? subject.subject.productId : null,
    variantId: subject.subject.kind === "STORE_ITEM" ? subject.subject.variantId : null,
    ticketTypeId: subject.subject.kind === "TICKET_TYPE" ? subject.subject.ticketTypeId : null,
    metadata: payload.metadata ?? {},
  });

  if (!hold.ok) {
    const status = hold.code === "OUT_OF_STOCK" ? 409 : 400;
    return respondError(
      ctx,
      {
        errorCode: hold.code,
        message: hold.message,
        retryable: Boolean(hold.retryable),
        ...(typeof hold.available === "number"
          ? { details: { available: hold.available } }
          : {}),
      },
      { status },
    );
  }

  return respondOk(
    ctx,
    {
      holdRequired: true,
      holdId: hold.data.holdId,
      expiresAt: hold.data.expiresAt,
      quantity: hold.data.quantity,
      subjectFingerprint: hold.data.subjectFingerprint,
    },
    { status: 200 },
  );
}

export const POST = withApiEnvelope(_POST);

