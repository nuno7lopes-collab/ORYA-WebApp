import { NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

async function _POST() {
  return jsonWrap(
    { ok: false, error: "Revenda temporariamente desativada.", code: "RESALE_DISABLED" },
    { status: 403 },
  );
}
export const POST = withApiEnvelope(_POST);