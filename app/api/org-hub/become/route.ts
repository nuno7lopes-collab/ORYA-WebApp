import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError } from "@/lib/http/envelope";

function deprecated() {
  const ctx = getRequestContext();
  return respondError(
    ctx,
    {
      errorCode: "GONE",
      message: "ENDPOINT_DEPRECATED_USE_API_ORG_HUB_ORGANIZATIONS",
      retryable: false,
      details: {
        endpoint: "/api/org-hub/organizations",
      },
    },
    { status: 410 },
  );
}

export const GET = withApiEnvelope(async () => deprecated());
export const POST = withApiEnvelope(async () => deprecated());
export const DELETE = withApiEnvelope(async () => deprecated());
