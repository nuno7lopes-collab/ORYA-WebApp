import { NextRequest, NextResponse } from "next/server";
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

    const threadIds: string[] = [];

    await prisma.$executeRaw`
      UPDATE app_v3.chat_threads
      SET status = (
        CASE
          WHEN now() < open_at THEN 'ANNOUNCEMENTS'
          WHEN now() < read_only_at THEN 'OPEN'
          WHEN now() < close_at THEN 'READ_ONLY'
          ELSE 'CLOSED'
        END
      )::app_v3."ChatThreadStatus",
      updated_at = now()
      WHERE status IS DISTINCT FROM (
        CASE
          WHEN now() < open_at THEN 'ANNOUNCEMENTS'
          WHEN now() < read_only_at THEN 'OPEN'
          WHEN now() < close_at THEN 'READ_ONLY'
          ELSE 'CLOSED'
        END
      )::app_v3."ChatThreadStatus"
    `;

    const expiredIds: string[] = [];

    await recordCronHeartbeat("chat-maintenance", { status: "SUCCESS", startedAt });
    return jsonWrap({
      ok: true,
      notifiedThreads: threadIds.length,
      expiredThreads: expiredIds.length,
    });
  } catch (err) {
    logError("cron.chat.maintenance_error", err);
    await recordCronHeartbeat("chat-maintenance", { status: "ERROR", startedAt, error: err });
    return jsonWrap({ ok: false, error: "Internal chat maintenance error" }, { status: 500 });
  }
}
export const GET = withApiEnvelope(_GET);
