export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { releaseDuePayouts } from "@/lib/payments/releaseWorker";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { requireInternalSecret } from "@/lib/security/requireInternalSecret";

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

export async function POST(req: NextRequest) {
  const ctx = getRequestContext(req);
  const unauthorized = ensureInternalSecret(req, ctx);
  if (unauthorized) return unauthorized;

  const results = await releaseDuePayouts();
  return respondOk(ctx, { processed: results.length, results }, { status: 200 });
}
