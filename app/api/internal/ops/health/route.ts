import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { requireInternalSecret } from "@/lib/security/requireInternalSecret";
import { getOpsHealth } from "@/domain/ops/health";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

async function _GET(req: NextRequest) {
  if (!requireInternalSecret(req)) {
    // ALB health checks do not send internal auth headers.
    return jsonWrap({ ok: true, ts: new Date().toISOString(), probe: true });
  }

  const health = await getOpsHealth();
  return jsonWrap(health);
}
export const GET = withApiEnvelope(_GET);
