import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { getOutboxOpsSummary } from "@/lib/ops/outboxSummary";
import { requireInternalSecret } from "@/lib/security/requireInternalSecret";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

async function _GET(req: NextRequest) {
  if (!requireInternalSecret(req)) {
    return jsonWrap({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const summary = await getOutboxOpsSummary();
  return jsonWrap({ ok: true, ...summary }, { status: 200 });
}
export const GET = withApiEnvelope(_GET);