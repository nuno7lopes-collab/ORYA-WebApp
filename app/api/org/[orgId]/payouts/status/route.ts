import { jsonWrap } from "@/lib/api/wrapResponse";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

async function _GET() {
  return jsonWrap(
    {
      ok: false,
      error: "LEGACY_ROUTE_REMOVED",
      errorCode: "LEGACY_ROUTE_REMOVED",
    },
    { status: 410 },
  );
}

export const GET = withApiEnvelope(_GET);
