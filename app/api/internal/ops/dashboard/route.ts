import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { requireInternalSecret } from "@/lib/security/requireInternalSecret";
import { getOpsHealth } from "@/domain/ops/health";
import { getOpsSlo } from "@/domain/ops/slo";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

async function _GET(req: NextRequest) {
  if (!requireInternalSecret(req)) {
    return jsonWrap({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const [health, slo] = await Promise.all([getOpsHealth(), getOpsSlo()]);
  return jsonWrap({ ts: new Date().toISOString(), health, slo });
}
export const GET = withApiEnvelope(_GET);