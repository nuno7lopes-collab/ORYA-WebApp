export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { releaseCheckoutHold } from "@/lib/holds/service";

function parsePayload(input: unknown) {
  const payload = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  return {
    holdId: String(payload.holdId ?? ""),
    orgId: Number(payload.orgId),
    subjectType: String(payload.subjectType ?? ""),
    subjectFingerprint: String(payload.subjectFingerprint ?? ""),
    clientSessionId: String(payload.clientSessionId ?? ""),
  };
}

async function _DELETE(req: NextRequest) {
  const ctx = getRequestContext(req);
  const body = await req.json().catch(() => ({}));
  const payload = parsePayload(body);
  const result = await releaseCheckoutHold(payload);

  if (!result.ok) {
    const status =
      result.code === "SLOT_NOT_AVAILABLE" || result.code === "HOLD_EXPIRED" ? 409 : 400;
    return respondError(
      ctx,
      { errorCode: result.code, message: result.message, retryable: Boolean(result.retryable) },
      { status },
    );
  }

  return respondOk(
    ctx,
    {
      released: true,
      holdId: result.data.holdId,
    },
    { status: 200 },
  );
}

export const DELETE = withApiEnvelope(_DELETE);

