import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { requireInternalSecret } from "@/lib/security/requireInternalSecret";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { logError } from "@/lib/observability/logger";
import { recordCronHeartbeat } from "@/lib/cron/heartbeat";

async function _GET(req: NextRequest) {
  const startedAt = new Date();
  try {
    if (!requireInternalSecret(req)) {
      return jsonWrap({ ok: false, error: "Unauthorized cron call." }, { status: 401 });
    }

    const now = new Date();

    const expired = await prisma.padelPartnerRoleGrant.updateMany({
      where: {
        autoRevoke: true,
        isActive: true,
        revokedAt: null,
        expiresAt: { lt: now },
      },
      data: {
        isActive: false,
        revokedAt: now,
      },
    });

    await recordCronHeartbeat("padel-partnership-grants-revoke", { status: "SUCCESS", startedAt });
    return jsonWrap({
      ok: true,
      revokedCount: expired.count,
      timestamp: now.toISOString(),
    });
  } catch (err) {
    logError("cron.padel.partnership_grants_revoke_error", err);
    await recordCronHeartbeat("padel-partnership-grants-revoke", {
      status: "ERROR",
      startedAt,
      error: err,
    });
    return jsonWrap({ ok: false, error: "Internal cleanup error" }, { status: 500 });
  }
}

export const GET = withApiEnvelope(_GET);
