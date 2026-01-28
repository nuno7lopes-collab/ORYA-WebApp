import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { requireAdminUser } from "@/lib/admin/auth";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

// @deprecated Slice 5 cleanup: legacy stats (v7 uses ledger).
const LEGACY_STATS_DISABLED = true;

async function _GET(_req: NextRequest) {
  const admin = await requireAdminUser();
  if (!admin.ok) {
    return jsonWrap({ ok: false, error: admin.error }, { status: admin.status });
  }

  if (LEGACY_STATS_DISABLED) {
    return jsonWrap({ ok: false, error: "LEGACY_STATS_DISABLED" }, { status: 410 });
  }

  return jsonWrap({ ok: false, error: "LEGACY_STATS_DISABLED" }, { status: 410 });
}
export const GET = withApiEnvelope(_GET);