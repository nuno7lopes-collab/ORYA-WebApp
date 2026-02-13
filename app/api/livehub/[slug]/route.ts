export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

async function _GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const resolved = await params;
  const slug = resolved?.slug;
  return jsonWrap(
    {
      ok: false,
      error: "LIVEHUB_ROUTE_DEPRECATED",
      endpoint: slug ? `/api/live/events/${slug}` : "/api/live/events/:slug",
    },
    { status: 410 },
  );
}

export const GET = withApiEnvelope(_GET);

