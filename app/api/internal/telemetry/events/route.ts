import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { getRequestContext } from "@/lib/http/requestContext";
import { requireInternalSecret } from "@/lib/security/requireInternalSecret";
import { ingestTelemetryBatch, normalizeTelemetryBatchInput } from "@/domain/telemetry/ingest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function _POST(req: NextRequest) {
  const ctx = getRequestContext(req);
  if (!requireInternalSecret(req)) {
    return jsonWrap(
      {
        ok: false,
        error: "UNAUTHORIZED",
        errorCode: "UNAUTHORIZED",
        message: "Não autorizado.",
      },
      { status: 401, req },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonWrap(
      {
        ok: false,
        error: "INVALID_JSON",
        errorCode: "INVALID_JSON",
        message: "JSON inválido.",
      },
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

  const result = await ingestTelemetryBatch(events, {
    requestId: ctx.requestId,
    correlationId: ctx.correlationId,
    defaultSourceType: "INTERNAL",
    defaultActorType: "SYSTEM",
  });

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
