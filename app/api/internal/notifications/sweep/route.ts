import { NextResponse } from "next/server";
import { requireInternalSecret } from "@/lib/security/requireInternalSecret";
import { consumeNotificationEventLogBatch } from "@/domain/notifications/consumer";

export async function GET(req: Request) {
  try {
    requireInternalSecret(req.headers);
    const url = new URL(req.url);
    const limitRaw = Number(url.searchParams.get("limit") ?? 200);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 500) : 200;
    const result = await consumeNotificationEventLogBatch(limit);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 401 });
  }
}
