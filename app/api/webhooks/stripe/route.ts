export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import type { NextRequest } from "next/server";
import { POST as stripeWebhookPost } from "@/app/api/stripe/webhook/route";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

async function _POST(req: NextRequest) {
  return stripeWebhookPost(req);
}
export const POST = withApiEnvelope(_POST);
