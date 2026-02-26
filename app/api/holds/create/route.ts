export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { createCheckoutHold } from "@/lib/holds/service";

function parseCreatePayload(input: unknown) {
  const payload = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  return {
    orgId: Number(payload.orgId),
    subjectType: String(payload.subjectType ?? ""),
    subjectFingerprint: String(payload.subjectFingerprint ?? ""),
    clientSessionId: String(payload.clientSessionId ?? ""),
    metadata:
      payload.metadata && typeof payload.metadata === "object"
        ? (payload.metadata as Record<string, unknown>)
        : undefined,
  };
}

async function _POST(req: NextRequest) {
  const ctx = getRequestContext(req);
  const body = await req.json().catch(() => ({}));
  const payload = parseCreatePayload(body);

  const result = await createCheckoutHold(payload);
  if (!result.ok) {
    const status = result.code === "SLOT_NOT_AVAILABLE" ? 409 : 400;
    return respondError(
      ctx,
      { errorCode: result.code, message: result.message, retryable: Boolean(result.retryable) },
      { status },
    );
  }

  return respondOk(
    ctx,
    {
      holdId: result.data.holdId,
      expiresAt: result.data.expiresAt,
      subjectFingerprint: result.data.subjectFingerprint,
    },
    { status: 200 },
  );
}

export const POST = withApiEnvelope(_POST);
