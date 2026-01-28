import { NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { getPlatformAndStripeFees } from "@/lib/platformSettings";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

async function _GET() {
  try {
    const { orya, stripe } = await getPlatformAndStripeFees();
    return jsonWrap({ ok: true, orya, stripe }, { status: 200 });
  } catch (err) {
    console.error("[platform/fees] unexpected error", err);
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
export const GET = withApiEnvelope(_GET);