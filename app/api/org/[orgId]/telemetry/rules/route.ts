import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { requireOrgTelemetryAccess } from "@/app/api/org/[orgId]/telemetry/_access";
import {
  createTelemetryAlertRule,
  listTelemetryAlertRules,
  parseTelemetryAlertRuleCreateInput,
} from "@/domain/telemetry/alerts";
import { logError } from "@/lib/observability/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseBoolean(value: string | null, fallback: boolean) {
  if (!value) return fallback;
  const normalized = value.trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return fallback;
}

async function _GET(req: NextRequest) {
  try {
    const access = await requireOrgTelemetryAccess(req);
    if (!access.ok) return access.response;

    const searchParams = req.nextUrl.searchParams;
    const includeGlobal = parseBoolean(searchParams.get("includeGlobal"), true);
    const activeOnly = parseBoolean(searchParams.get("activeOnly"), false);

    const items = await listTelemetryAlertRules({
      organizationId: access.organizationId,
      includeGlobal,
      activeOnly,
      take: 200,
    });

    return jsonWrap({ ok: true, items }, { status: 200, req });
  } catch (err) {
    logError("org.telemetry.rules_list_failed", err);
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500, req });
  }
}

async function _POST(req: NextRequest) {
  try {
    const access = await requireOrgTelemetryAccess(req, { required: "EDIT" });
    if (!access.ok) return access.response;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return jsonWrap(
        { ok: false, error: "INVALID_JSON", errorCode: "INVALID_JSON" },
        { status: 400, req },
      );
    }

    const parsed = parseTelemetryAlertRuleCreateInput(body, {
      forcedOrganizationId: access.organizationId,
    });

    if (!parsed.ok) {
      return jsonWrap(
        { ok: false, error: parsed.error, errorCode: parsed.error },
        { status: 400, req },
      );
    }

    const created = await createTelemetryAlertRule(parsed.value, access.userId);
    if (!created) {
      return jsonWrap(
        {
          ok: false,
          error: "TELEMETRY_RULES_UNAVAILABLE",
          errorCode: "TELEMETRY_RULES_UNAVAILABLE",
        },
        { status: 503, req },
      );
    }

    return jsonWrap({ ok: true, item: created }, { status: 201, req });
  } catch (err) {
    logError("org.telemetry.rule_create_failed", err);
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500, req });
  }
}

export const GET = withApiEnvelope(_GET);
export const POST = withApiEnvelope(_POST);
