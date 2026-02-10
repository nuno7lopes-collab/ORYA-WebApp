import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

async function _GET(_req: NextRequest) {
  return jsonWrap({ ok: false, error: "CREDITS_DISABLED" }, { status: 410 });
}

export const GET = withApiEnvelope(_GET);
