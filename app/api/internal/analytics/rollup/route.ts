import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { runAnalyticsRollupJob } from "@/domain/analytics/rollup";
import { requireInternalSecret } from "@/lib/security/requireInternalSecret";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

async function _POST(req: NextRequest) {
  if (!requireInternalSecret(req)) {
    return jsonWrap({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const payload = (await req.json().catch(() => null)) as
    | { organizationId?: number; fromDate?: string; toDate?: string; maxDays?: number }
    | null;

  const result = await runAnalyticsRollupJob({
    organizationId: typeof payload?.organizationId === "number" ? payload.organizationId : undefined,
    fromDate: typeof payload?.fromDate === "string" ? payload.fromDate : undefined,
    toDate: typeof payload?.toDate === "string" ? payload.toDate : undefined,
    maxDays: typeof payload?.maxDays === "number" ? payload.maxDays : undefined,
  });

  return jsonWrap({ ok: true, ...result }, { status: 200 });
}
export const POST = withApiEnvelope(_POST);