export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { pingInventoryHold } from "@/lib/holds/inventoryHold";

function parsePayload(input: unknown) {
  const payload =
    input && typeof input === "object"
      ? (input as Record<string, unknown>)
      : {};
  return {
    holdId: String(payload.holdId ?? ""),
    clientSessionId: String(payload.clientSessionId ?? ""),
  };
}

async function _POST(req: NextRequest) {
  const ctx = getRequestContext(req);
  const body = await req.json().catch(() => ({}));
  const payload = parsePayload(body);
  const refreshed = await pingInventoryHold({
    holdId: payload.holdId,
    clientSessionId: payload.clientSessionId,
  });
  if (!refreshed.ok) {
    const status =
      refreshed.code === "SLOT_NOT_AVAILABLE" || refreshed.code === "HOLD_EXPIRED"
        ? 409
        : 400;
    return respondError(
      ctx,
      {
        errorCode: refreshed.code,
        message: refreshed.message,
        retryable: Boolean(refreshed.retryable),
      },
      { status },
    );
  }
  return respondOk(
    ctx,
    { holdId: refreshed.data.holdId, expiresAt: refreshed.data.expiresAt },
    { status: 200 },
  );
}

export const POST = withApiEnvelope(_POST);

