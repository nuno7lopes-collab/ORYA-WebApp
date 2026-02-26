import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { requireAdminUser } from "@/lib/admin/auth";
import {
  getTelemetryAlertRuleById,
  parseTelemetryAlertRulePatchInput,
  updateTelemetryAlertRule,
} from "@/domain/telemetry/alerts";
import { logError } from "@/lib/observability/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function _PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requireAdminUser({ req });
    if (!admin.ok) {
      return jsonWrap({ ok: false, error: admin.error }, { status: admin.status, req });
    }

    const { id } = await ctx.params;
    const ruleId = id?.trim();
    if (!ruleId) {
      return jsonWrap(
        { ok: false, error: "INVALID_RULE_ID", errorCode: "INVALID_RULE_ID" },
        { status: 400, req },
      );
    }

    const existing = await getTelemetryAlertRuleById(ruleId);
    if (!existing) {
      return jsonWrap({ ok: false, error: "NOT_FOUND" }, { status: 404, req });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return jsonWrap(
        { ok: false, error: "INVALID_JSON", errorCode: "INVALID_JSON" },
        { status: 400, req },
      );
    }

    const parsed = parseTelemetryAlertRulePatchInput(body);
    if (!parsed.ok) {
      return jsonWrap(
        { ok: false, error: parsed.error, errorCode: parsed.error },
        { status: 400, req },
      );
    }

    const updated = await updateTelemetryAlertRule(ruleId, parsed.value);
    if (!updated) {
      return jsonWrap(
        {
          ok: false,
          error: "TELEMETRY_RULES_UNAVAILABLE",
          errorCode: "TELEMETRY_RULES_UNAVAILABLE",
        },
        { status: 503, req },
      );
    }

    return jsonWrap({ ok: true, item: updated }, { status: 200, req });
  } catch (err) {
    logError("admin.telemetry.rule_patch_failed", err);
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500, req });
  }
}

export const PATCH = withApiEnvelope(_PATCH);
