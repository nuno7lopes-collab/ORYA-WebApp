import { NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

async function _GET() {
  return jsonWrap(
    { ok: false, error: "CHAT_INTERNO_EM_BETA" },
    { status: 501 },
  );
}
export const GET = withApiEnvelope(_GET);