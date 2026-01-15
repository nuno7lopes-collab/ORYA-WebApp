export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getAppBaseUrl } from "@/lib/appBaseUrl";

export async function GET(req: NextRequest) {
  const eventId = req.nextUrl.searchParams.get("eventId");
  const slug = req.nextUrl.searchParams.get("slug");
  if (!eventId && !slug) {
    return NextResponse.json({ ok: false, error: "EVENT_REQUIRED" }, { status: 400 });
  }

  const baseUrl = getAppBaseUrl();
  const url = new URL("/api/padel/public/calendar", baseUrl);
  if (eventId) url.searchParams.set("eventId", eventId);
  if (slug) url.searchParams.set("slug", slug);

  const forwardedFor = req.headers.get("x-forwarded-for");
  const realIp = req.headers.get("x-real-ip");
  const res = await fetch(url.toString(), {
    cache: "no-store",
    headers: {
      ...(forwardedFor ? { "x-forwarded-for": forwardedFor } : {}),
      ...(realIp ? { "x-real-ip": realIp } : {}),
    },
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.ok) {
    return NextResponse.json({ ok: false, error: data?.error || "CALENDAR_ERROR" }, { status: 400 });
  }

  return NextResponse.json({ ok: true, event: data.event, days: data.days ?? [] }, { status: 200 });
}
