export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { runOperationsBatch } from "@/app/api/internal/worker/operations/route";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { requireInternalSecret } from "@/lib/security/requireInternalSecret";
import { recordCronHeartbeat } from "@/lib/cron/heartbeat";
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

async function _POST(req: NextRequest) {
  const ctx = getRequestContext(req);
  const unauthorized = ensureInternalSecret(req, ctx);
  if (unauthorized) return unauthorized;

  const startedAt = new Date();
  try {
    const batch = await runOperationsBatch();
    await recordCronHeartbeat("operations", { status: "SUCCESS", startedAt });
    return respondOk(
      ctx,
      {
        processed: batch.results.length,
        results: batch.results,
        backoffMs: batch.backoffMs,
        stats: batch.stats,
      },
      { status: 200 },
    );
  } catch (err) {
    await recordCronHeartbeat("operations", { status: "ERROR", startedAt, error: err });
    return respondError(
      ctx,
      { errorCode: "INTERNAL_ERROR", message: "Erro ao executar cron.", retryable: true },
      { status: 500 },
    );
  }
}
export const POST = withApiEnvelope(_POST);
