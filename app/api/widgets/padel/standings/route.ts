export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getAppBaseUrl } from "@/lib/appBaseUrl";

export async function GET(req: NextRequest) {
  const eventId = req.nextUrl.searchParams.get("eventId");
  if (!eventId) {
    return NextResponse.json({ ok: false, error: "EVENT_REQUIRED" }, { status: 400 });
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
    return NextResponse.json({ ok: false, error: data?.error || "STANDINGS_ERROR" }, { status: 400 });
  }

  return NextResponse.json({ ok: true, standings: data.standings ?? {} }, { status: 200 });
}
