import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { backfillPadelRegistrationOutbox } from "@/domain/padelRegistrationBackfill";
import { requireInternalSecret } from "@/lib/security/requireInternalSecret";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

async function _POST(req: NextRequest) {
  if (!requireInternalSecret(req)) {
    return jsonWrap({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const payload = (await req.json().catch(() => null)) as { limit?: unknown; before?: unknown } | null;
  const limit = typeof payload?.limit === "number" ? payload.limit : undefined;
  const before = typeof payload?.before === "string" ? new Date(payload.before) : null;

  const result = await backfillPadelRegistrationOutbox({
    limit: limit ?? 200,
    before,
  });

  return jsonWrap({
    ok: true,
    scanned: result.scanned,
    emitted: result.emitted,
    nextBefore: result.nextBefore?.toISOString() ?? null,
  });
}
export const POST = withApiEnvelope(_POST);