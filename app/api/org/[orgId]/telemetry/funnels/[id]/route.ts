import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { requireOrgTelemetryAccess } from "@/app/api/org/[orgId]/telemetry/_access";
import {
  getTelemetryFunnelDefinitionById,
  parseTelemetryFunnelPatchInput,
  updateTelemetryFunnelDefinition,
} from "@/domain/telemetry/funnels";
import { logError } from "@/lib/observability/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function _PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const access = await requireOrgTelemetryAccess(req, { required: "EDIT" });
    if (!access.ok) return access.response;

    const { id } = await ctx.params;
    const funnelId = id?.trim();
    if (!funnelId) {
      return jsonWrap(
        { ok: false, error: "INVALID_FUNNEL_ID", errorCode: "INVALID_FUNNEL_ID" },
        { status: 400, req },
      );
    }

    const existing = await getTelemetryFunnelDefinitionById(funnelId);
    if (!existing || existing.organizationId !== access.organizationId) {
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

    const parsed = parseTelemetryFunnelPatchInput(body);
    if (!parsed.ok) {
      return jsonWrap(
        { ok: false, error: parsed.error, errorCode: parsed.error },
        { status: 400, req },
      );
    }

    const updated = await updateTelemetryFunnelDefinition(funnelId, parsed.value);
    if (!updated) {
      return jsonWrap(
        {
          ok: false,
          error: "TELEMETRY_FUNNELS_UNAVAILABLE",
          errorCode: "TELEMETRY_FUNNELS_UNAVAILABLE",
        },
        { status: 503, req },
      );
    }

    return jsonWrap({ ok: true, item: updated }, { status: 200, req });
  } catch (err) {
    logError("org.telemetry.funnel_patch_failed", err);
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500, req });
  }
}

export const PATCH = withApiEnvelope(_PATCH);
