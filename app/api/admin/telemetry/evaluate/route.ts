import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { requireAdminUser } from "@/lib/admin/auth";
import { evaluateTelemetryAlertRules } from "@/domain/telemetry/alerts";
import { logError } from "@/lib/observability/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseOrganizationId(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

async function _POST(req: NextRequest) {
  try {
    const admin = await requireAdminUser({ req });
    if (!admin.ok) {
      return jsonWrap({ ok: false, error: admin.error }, { status: admin.status, req });
    }

    const organizationId = parseOrganizationId(req.nextUrl.searchParams.get("orgId"));
    const result = await evaluateTelemetryAlertRules({ organizationId });

    return jsonWrap({ ok: true, result }, { status: 200, req });
  } catch (err) {
    logError("admin.telemetry.evaluate_failed", err);
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500, req });
  }
}

export const POST = withApiEnvelope(_POST);
