export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { getAppBaseUrl } from "@/lib/appBaseUrl";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { prisma } from "@/lib/prisma";

async function _GET(req: NextRequest) {
  const eventId = req.nextUrl.searchParams.get("eventId");
  const slug = req.nextUrl.searchParams.get("slug");
  if (!eventId) {
    return jsonWrap({ ok: false, error: "EVENT_REQUIRED" }, { status: 400 });
  }
  const numericEventId = Number(eventId);
  if (!Number.isFinite(numericEventId)) {
    return jsonWrap({ ok: false, error: "INVALID_EVENT_ID" }, { status: 400 });
  }

  const event = await prisma.event.findUnique({
    where: { id: numericEventId, isDeleted: false },
    select: { id: true, slug: true },
  });
  if (!event) {
    return jsonWrap({ ok: false, error: "EVENT_NOT_FOUND" }, { status: 404 });
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

  const payload = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  const entityType = typeof payload.entityType === "string" ? payload.entityType : "PAIRING";
  const rows = Array.isArray(payload.rows) ? payload.rows : [];
  const groups = payload.groups && typeof payload.groups === "object" ? (payload.groups as Record<string, unknown>) : {};
  return jsonWrap({ ok: true, event: { id: event.id, slug: event.slug ?? slug ?? null }, entityType, rows, groups }, { status: 200 });
}
export const GET = withApiEnvelope(_GET);
