import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

async function _GET(_req: NextRequest) {
  return jsonWrap(
    { ok: false, error: "CHECKOUT_DEPRECATED", message: "Fluxo antigo de pagamento foi desativado." },
    { status: 410 },
  );
}
export const GET = withApiEnvelope(_GET);