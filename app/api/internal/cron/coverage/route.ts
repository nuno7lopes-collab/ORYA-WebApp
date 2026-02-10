export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireInternalSecret } from "@/lib/security/requireInternalSecret";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { CRON_JOBS, getCronIntervalMs } from "@/lib/cron/jobs";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

async function _GET(req: NextRequest) {
  const ctx = getRequestContext(req);
  if (!requireInternalSecret(req)) {
    return respondError(
      ctx,
      { errorCode: "UNAUTHORIZED", message: "Unauthorized.", retryable: false },
      { status: 401 },
    );
  }

  const now = new Date();
  const entries = await prisma.cronHeartbeat.findMany({ orderBy: { jobKey: "asc" } });
  const entryMap = new Map(entries.map((entry) => [entry.jobKey, entry]));

  const jobs = CRON_JOBS.map((job) => {
    const heartbeat = entryMap.get(job.key) ?? null;
    const intervalMs = getCronIntervalMs(job);
    const lastRunAt = heartbeat?.lastRunAt ?? null;
    const lagMs = lastRunAt ? Math.max(0, now.getTime() - lastRunAt.getTime()) : null;
    const stale = lagMs === null ? true : lagMs > intervalMs * 2;

    return {
      key: job.key,
      endpoint: job.endpoint,
      method: job.method,
      intervalMs,
      lastRunAt: lastRunAt ? lastRunAt.toISOString() : null,
      lastSuccessAt: heartbeat?.lastSuccessAt ? heartbeat.lastSuccessAt.toISOString() : null,
      lastErrorAt: heartbeat?.lastErrorAt ? heartbeat.lastErrorAt.toISOString() : null,
      lastError: heartbeat?.lastError ?? null,
      runCount: heartbeat?.runCount ?? 0,
      successCount: heartbeat?.successCount ?? 0,
      errorCount: heartbeat?.errorCount ?? 0,
      lastDurationMs: heartbeat?.lastDurationMs ?? null,
      lagMs,
      stale,
    };
  });

  const knownKeys = new Set(CRON_JOBS.map((job) => job.key));
  const extra = entries
    .filter((entry) => !knownKeys.has(entry.jobKey))
    .map((entry) => ({
      key: entry.jobKey,
      lastRunAt: entry.lastRunAt.toISOString(),
      lastSuccessAt: entry.lastSuccessAt ? entry.lastSuccessAt.toISOString() : null,
      lastErrorAt: entry.lastErrorAt ? entry.lastErrorAt.toISOString() : null,
      lastError: entry.lastError ?? null,
      runCount: entry.runCount,
      successCount: entry.successCount,
      errorCount: entry.errorCount,
      lastDurationMs: entry.lastDurationMs ?? null,
    }));

  return respondOk(ctx, { ts: now.toISOString(), jobs, extra }, { status: 200 });
}
export const GET = withApiEnvelope(_GET);
