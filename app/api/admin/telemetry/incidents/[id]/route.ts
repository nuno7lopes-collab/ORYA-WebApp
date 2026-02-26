import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { requireAdminUser } from "@/lib/admin/auth";
import {
  getTelemetryIncidentById,
  parseTelemetryIncidentStatusAction,
  updateTelemetryIncidentStatus,
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
    const incidentId = id?.trim();
    if (!incidentId) {
      return jsonWrap(
        { ok: false, error: "INVALID_INCIDENT_ID", errorCode: "INVALID_INCIDENT_ID" },
        { status: 400, req },
      );
    }

    const existing = await getTelemetryIncidentById(incidentId);
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

    const parsedAction = parseTelemetryIncidentStatusAction(body);
    if (!parsedAction.ok) {
      return jsonWrap(
        {
          ok: false,
          error: parsedAction.error,
          errorCode: parsedAction.error,
        },
        { status: 400, req },
      );
    }

    if (existing.status === "RESOLVED" && parsedAction.value === "ACKNOWLEDGED") {
      return jsonWrap(
        {
          ok: false,
          error: "INVALID_ACTION_FOR_RESOLVED_INCIDENT",
          errorCode: "INVALID_ACTION_FOR_RESOLVED_INCIDENT",
        },
        { status: 409, req },
      );
    }

    const updated = await updateTelemetryIncidentStatus({
      incidentId,
      status: parsedAction.value,
      actorUserId: admin.userId,
    });

    if (!updated) {
      return jsonWrap(
        {
          ok: false,
          error: "TELEMETRY_INCIDENTS_UNAVAILABLE",
          errorCode: "TELEMETRY_INCIDENTS_UNAVAILABLE",
        },
        { status: 503, req },
      );
    }

    return jsonWrap({ ok: true, item: updated }, { status: 200, req });
  } catch (err) {
    logError("admin.telemetry.incident_patch_failed", err);
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500, req });
  }
}

export const PATCH = withApiEnvelope(_PATCH);
