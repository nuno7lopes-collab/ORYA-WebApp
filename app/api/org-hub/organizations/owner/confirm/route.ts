import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError } from "@/lib/http/envelope";

async function deprecated() {
  const ctx = getRequestContext();
  return respondError(
    ctx,
    {
      errorCode: "GONE",
      message: "OWNER_TRANSFER_MOVED_TO_GROUP_LEVEL",
      retryable: false,
      details: {
        endpoint: "/api/org-hub/groups/:groupId/owner/transfer/confirm",
      },
    },
    { status: 410 },
  );
}

export const POST = withApiEnvelope(deprecated);
export const GET = withApiEnvelope(deprecated);
