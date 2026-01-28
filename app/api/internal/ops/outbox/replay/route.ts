import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { replayOutboxEvents } from "@/lib/ops/outboxReplay";
import { requireInternalSecret } from "@/lib/security/requireInternalSecret";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

function parseRequestId(req: NextRequest) {
  return req.headers.get("Idempotency-Key") || req.headers.get("X-Request-Id");
}

function parseEventIds(payload: unknown) {
  if (!payload || typeof payload !== "object") return [];
  const data = payload as { eventId?: unknown; eventIds?: unknown };
  if (Array.isArray(data.eventIds)) {
    return data.eventIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0);
  }
  if (typeof data.eventId === "string" && data.eventId.trim()) {
    return [data.eventId.trim()];
  }
  return [];
}

async function _POST(req: NextRequest) {
  if (!requireInternalSecret(req)) {
    return jsonWrap({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const requestId = parseRequestId(req);
  const payload = (await req.json().catch(() => null)) as unknown;
  const eventIds = parseEventIds(payload);
  const result = await replayOutboxEvents({ eventIds, requestId });
  if (!result.ok) {
    return jsonWrap(result, { status: result.error === "LIMIT_EXCEEDED" ? 400 : 400 });
  }
  return jsonWrap(result, { status: 200 });
}
export const POST = withApiEnvelope(_POST);