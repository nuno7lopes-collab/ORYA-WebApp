import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { requireInternalSecret } from "@/lib/security/requireInternalSecret";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { logError } from "@/lib/observability/logger";
import { recordCronHeartbeat } from "@/lib/cron/heartbeat";

const CLEANUP_GRACE_HOURS = 24;

async function _GET(req: NextRequest) {
  const startedAt = new Date();
  try {
    if (!requireInternalSecret(req)) {
      return jsonWrap({ ok: false, error: "Unauthorized cron call." }, { status: 401 });
    }

    const threshold = new Date(Date.now() - CLEANUP_GRACE_HOURS * 60 * 60 * 1000);
    const result = await prisma.entitlementQrToken.deleteMany({
      where: { expiresAt: { lte: threshold } },
    });

    await recordCronHeartbeat("entitlements-qr-cleanup", { status: "SUCCESS", startedAt });
    return jsonWrap({ ok: true, deletedCount: result.count });
  } catch (err) {
    logError("cron.entitlements.qr_cleanup_error", err);
    await recordCronHeartbeat("entitlements-qr-cleanup", { status: "ERROR", startedAt, error: err });
    return jsonWrap({ ok: false, error: "Internal qr cleanup error" }, { status: 500 });
  }
}
export const GET = withApiEnvelope(_GET);
