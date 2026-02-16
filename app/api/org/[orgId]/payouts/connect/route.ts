import { jsonWrap } from "@/lib/api/wrapResponse";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

async function _POST() {
  return jsonWrap(
    {
      ok: false,
      error: "LEGACY_ROUTE_REMOVED",
      errorCode: "LEGACY_ROUTE_REMOVED",
    },
    { status: 410 },
  );
}

export const POST = withApiEnvelope(_POST);
