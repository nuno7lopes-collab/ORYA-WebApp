import { NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

async function _GET() {
  return jsonWrap({ error: "PUBLIC_API_GONE" }, { status: 410 });
}
export const GET = withApiEnvelope(_GET);