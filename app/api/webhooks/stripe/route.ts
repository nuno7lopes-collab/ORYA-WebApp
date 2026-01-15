export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import type { NextRequest } from "next/server";
import { POST as stripeWebhookPost } from "@/app/api/stripe/webhook/route";

export async function POST(req: NextRequest) {
  return stripeWebhookPost(req);
}
