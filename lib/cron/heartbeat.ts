import { prisma } from "@/lib/prisma";
import { logWarn } from "@/lib/observability/logger";

export type CronHeartbeatStatus = "SUCCESS" | "ERROR" | "DISABLED";

type CronHeartbeatInput = {
  status: CronHeartbeatStatus;
  startedAt?: Date;
  error?: unknown;
  metadata?: Record<string, unknown>;
};

function stringifyError(error: unknown) {
  if (!error) return null;
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

export async function recordCronHeartbeat(jobKey: string, input: CronHeartbeatInput) {
  const now = new Date();
  const durationMs = input.startedAt ? Math.max(0, now.getTime() - input.startedAt.getTime()) : null;
  const isSuccess = input.status === "SUCCESS";
  const isError = input.status === "ERROR";
  const errorMessage = isError ? stringifyError(input.error) : null;

  try {
    await prisma.cronHeartbeat.upsert({
      where: { jobKey },
      create: {
        jobKey,
        lastRunAt: now,
        lastSuccessAt: isSuccess ? now : null,
        lastErrorAt: isError ? now : null,
        lastError: isError ? errorMessage : null,
        runCount: 1,
        successCount: isSuccess ? 1 : 0,
        errorCount: isError ? 1 : 0,
        lastDurationMs: durationMs ?? undefined,
      },
      update: {
        lastRunAt: now,
        lastSuccessAt: isSuccess ? now : undefined,
        lastErrorAt: isError ? now : undefined,
        lastError: isError ? errorMessage : null,
        runCount: { increment: 1 },
        successCount: isSuccess ? { increment: 1 } : undefined,
        errorCount: isError ? { increment: 1 } : undefined,
        lastDurationMs: durationMs ?? undefined,
      },
    });
  } catch (err) {
    logWarn("cron.heartbeat_failed", { jobKey, error: stringifyError(err) ?? "unknown" }, { fallbackToRequestContext: false });
  }
}
