export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { releaseInventoryHold } from "@/lib/holds/inventoryHold";

function parsePayload(input: unknown) {
  const payload =
    input && typeof input === "object"
      ? (input as Record<string, unknown>)
      : {};
  return {
    holdId: String(payload.holdId ?? ""),
    clientSessionId: String(payload.clientSessionId ?? ""),
    consumed: Boolean(payload.consumed),
  };
}

async function _POST(req: NextRequest) {
  const ctx = getRequestContext(req);
  const body = await req.json().catch(() => ({}));
  const payload = parsePayload(body);
  const released = await releaseInventoryHold({
    holdId: payload.holdId,
    clientSessionId: payload.clientSessionId,
    consumed: payload.consumed,
  });
  if (!released.ok) {
    const status =
      released.code === "SLOT_NOT_AVAILABLE" || released.code === "HOLD_EXPIRED"
        ? 409
        : 400;
    return respondError(
      ctx,
      {
        errorCode: released.code,
        message: released.message,
        retryable: Boolean(released.retryable),
      },
      { status },
    );
  }
  return respondOk(
    ctx,
    {
      released: true,
      holdId: released.data.holdId,
      status: released.data.status,
    },
    { status: 200 },
  );
}

export const POST = withApiEnvelope(_POST);

