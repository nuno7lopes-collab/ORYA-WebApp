import { NextRequest, NextResponse } from "next/server";
import { replayOutboxEvents } from "@/lib/ops/outboxReplay";
import { requireInternalSecret } from "@/lib/security/requireInternalSecret";

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

export async function POST(req: NextRequest) {
  if (!requireInternalSecret(req)) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const requestId = parseRequestId(req);
  const payload = (await req.json().catch(() => null)) as unknown;
  const eventIds = parseEventIds(payload);
  const result = await replayOutboxEvents({ eventIds, requestId });
  if (!result.ok) {
    return NextResponse.json(result, { status: result.error === "LIMIT_EXCEEDED" ? 400 : 400 });
  }
  return NextResponse.json(result, { status: 200 });
}
