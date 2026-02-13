export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { getAppBaseUrl } from "@/lib/appBaseUrl";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

async function _GET(req: NextRequest) {
  const eventId = req.nextUrl.searchParams.get("eventId");
  if (!eventId) {
    return jsonWrap({ ok: false, error: "EVENT_REQUIRED" }, { status: 400 });
  }

  const baseUrl = getAppBaseUrl();
  const forwardedFor = req.headers.get("x-forwarded-for");
  const realIp = req.headers.get("x-real-ip");
  const res = await fetch(`${baseUrl}/api/padel/standings?eventId=${encodeURIComponent(eventId)}`, {
    cache: "no-store",
    headers: {
      ...(forwardedFor ? { "x-forwarded-for": forwardedFor } : {}),
      ...(realIp ? { "x-real-ip": realIp } : {}),
    },
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.ok) {
    return jsonWrap({ ok: false, error: data?.error || "STANDINGS_ERROR" }, { status: 400 });
  }

  const groups =
    data && typeof data === "object" && data.groups && typeof data.groups === "object"
      ? (data.groups as Record<string, unknown>)
      : {};
  return jsonWrap({ ok: true, groups }, { status: 200 });
}
export const GET = withApiEnvelope(_GET);
