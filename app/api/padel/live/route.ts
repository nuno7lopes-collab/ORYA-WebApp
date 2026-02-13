export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { jsonWrap } from "@/lib/api/wrapResponse";

async function _GET(req: NextRequest) {
  const eventId = req.nextUrl.searchParams.get("eventId");
  const categoryId = req.nextUrl.searchParams.get("categoryId");
  const endpoint = "/api/live/events/:slug/stream";
  return jsonWrap(
    {
      ok: false,
      error: "LIVE_ENDPOINT_MOVED",
      endpoint,
      hint: "Use /api/live/events/{slug}/stream",
      params: {
        ...(eventId ? { eventId } : {}),
        ...(categoryId ? { categoryId } : {}),
      },
    },
    { status: 410 },
  );
}

export const GET = withApiEnvelope(_GET);
