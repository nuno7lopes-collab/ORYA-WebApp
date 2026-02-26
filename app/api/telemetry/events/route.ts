import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { getRequestContext } from "@/lib/http/requestContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ingestTelemetryBatch, normalizeTelemetryBatchInput } from "@/domain/telemetry/ingest";
import { type TelemetrySourceType } from "@/domain/telemetry/constants";
import { logWarn } from "@/lib/observability/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function resolveDefaultSourceType(req: NextRequest): TelemetrySourceType {
  const clientPlatform = req.headers.get("x-client-platform")?.toLowerCase();
  if (clientPlatform === "mobile") return "MOBILE";
  return "WEB";
}

async function resolveAuthenticatedUserId(): Promise<string | null> {
  try {
    const supabase = await createSupabaseServer({ allowUnverifiedEmail: true });
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user?.id ?? null;
  } catch {
    return null;
  }
}

async function _POST(req: NextRequest) {
  const ctx = getRequestContext(req);
  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return jsonWrap(
      { ok: false, error: "INVALID_JSON", errorCode: "INVALID_JSON", message: "JSON inválido." },
      { status: 400, req },
    );
  }

  const events = normalizeTelemetryBatchInput(body);
  if (events.length === 0) {
    return jsonWrap(
      {
        ok: false,
        error: "INVALID_PAYLOAD",
        errorCode: "INVALID_PAYLOAD",
        message: "Payload inválido. Envia um evento ou lista de eventos.",
      },
      { status: 400, req },
    );
  }

  const defaultOrganizationId = resolveOrganizationIdFromRequest(req, {
    allowFallback: true,
  });
  const defaultSourceType = resolveDefaultSourceType(req);
  const actorUserId = await resolveAuthenticatedUserId();

  const result = await ingestTelemetryBatch(events, {
    requestId: ctx.requestId,
    correlationId: ctx.correlationId,
    defaultOrganizationId,
    defaultSourceType,
    defaultActorType: actorUserId
      ? "USER"
      : "ANONYMOUS",
    defaultActorUserId: actorUserId,
  });

  if (result.rejected > 0) {
    logWarn("telemetry.public.batch_rejected", {
      requestId: ctx.requestId,
      correlationId: ctx.correlationId,
      rejected: result.rejected,
      accepted: result.accepted,
    });
  }

  return jsonWrap(
    {
      ok: true,
      accepted: result.accepted,
      duplicates: result.duplicates,
      rejected: result.rejected,
      total: events.length,
    },
    { status: 200, req },
  );
}

export const POST = withApiEnvelope(_POST);
