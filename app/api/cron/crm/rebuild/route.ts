export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { rebuildCrmContacts } from "@/lib/crm/rebuild";
import { requireInternalSecret } from "@/lib/security/requireInternalSecret";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { logError, logInfo } from "@/lib/observability/logger";
import { recordCronHeartbeat } from "@/lib/cron/heartbeat";

function parseOrganizationId(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

async function _POST(req: NextRequest) {
  const startedAt = new Date();
  try {
    if (!requireInternalSecret(req)) {
      return jsonWrap({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const orgParam = parseOrganizationId(req.nextUrl.searchParams.get("organizationId"));
    const result = await rebuildCrmContacts({ organizationId: orgParam ?? null });
    logInfo("cron.crm.rebuild", { organizationId: orgParam ?? null, ...result });
    await recordCronHeartbeat("crm-rebuild", { status: "SUCCESS", startedAt });
    return jsonWrap({ ok: true, ...result }, { status: 200 });
  } catch (err) {
    logError("cron.crm.rebuild_error", err);
    await recordCronHeartbeat("crm-rebuild", { status: "ERROR", startedAt, error: err });
    return jsonWrap({ ok: false, error: "Internal error" }, { status: 500 });
  }
}
export const POST = withApiEnvelope(_POST);
