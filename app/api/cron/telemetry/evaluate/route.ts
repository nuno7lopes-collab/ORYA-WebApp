import { NextRequest } from "next/server";
import { parseOrganizationId } from "@/lib/organizationIdUtils";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { requireInternalSecret } from "@/lib/security/requireInternalSecret";
import { recordCronHeartbeat } from "@/lib/cron/heartbeat";
import { evaluateTelemetryAlertRules } from "@/domain/telemetry/alerts";
import { logError } from "@/lib/observability/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const JOB_KEY = "telemetry-alerts-evaluate";

function parseMaxRules(value: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed <= 0) return undefined;
  return Math.min(Math.floor(parsed), 1_000);
}

async function _POST(req: NextRequest) {
  const startedAt = new Date();
  if (!requireInternalSecret(req)) {
    return jsonWrap({ ok: false, error: "UNAUTHORIZED" }, { status: 401, req });
  }

  const organizationId = parseOrganizationId(req.nextUrl.searchParams.get("orgId"));
  const maxRules = parseMaxRules(req.nextUrl.searchParams.get("maxRules"));

  try {
    const result = await evaluateTelemetryAlertRules({ organizationId, maxRules });

    await recordCronHeartbeat(JOB_KEY, {
      status: "SUCCESS",
      startedAt,
      metadata: {
        organizationId,
        maxRules: maxRules ?? null,
        ...result,
      },
    });

    return jsonWrap({ ok: true, result }, { status: 200, req });
  } catch (err) {
    await recordCronHeartbeat(JOB_KEY, {
      status: "ERROR",
      startedAt,
      error: err,
    });
    logError("cron.telemetry.evaluate_error", err, {
      organizationId,
      maxRules,
    });
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500, req });
  }
}

export const POST = withApiEnvelope(_POST);
