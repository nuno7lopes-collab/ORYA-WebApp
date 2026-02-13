export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

async function _POST(req: NextRequest) {
  return jsonWrap({ ok: false, error: "ATTACHMENTS_DISABLED" }, { status: 410 });
}
export const POST = withApiEnvelope(_POST);
