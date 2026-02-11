import { getRequestContext } from "@/lib/http/requestContext";
import { respondError } from "@/lib/http/envelope";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

function legacyGone(req: Request) {
  const ctx = getRequestContext(req);
  return respondError(
    ctx,
    {
      errorCode: "GONE",
      message: "Endpoint legado removido. Usa /api/org/:orgId/store/**.",
      retryable: false,
    },
    { status: 410 },
  );
}

export const GET = withApiEnvelope(legacyGone);
export const POST = withApiEnvelope(legacyGone);
export const PUT = withApiEnvelope(legacyGone);
export const PATCH = withApiEnvelope(legacyGone);
export const DELETE = withApiEnvelope(legacyGone);
export const HEAD = withApiEnvelope(legacyGone);
export const OPTIONS = withApiEnvelope(legacyGone);
