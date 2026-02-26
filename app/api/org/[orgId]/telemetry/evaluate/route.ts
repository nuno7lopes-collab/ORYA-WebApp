import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { requireOrgTelemetryAccess } from "@/app/api/org/[orgId]/telemetry/_access";
import { evaluateTelemetryAlertRules } from "@/domain/telemetry/alerts";
import { logError } from "@/lib/observability/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function _POST(req: NextRequest) {
  try {
    const access = await requireOrgTelemetryAccess(req, { required: "EDIT" });
    if (!access.ok) return access.response;

    const result = await evaluateTelemetryAlertRules({
      organizationId: access.organizationId,
    });

    return jsonWrap({ ok: true, result }, { status: 200, req });
  } catch (err) {
    logError("org.telemetry.evaluate_failed", err);
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500, req });
  }
}

export const POST = withApiEnvelope(_POST);
