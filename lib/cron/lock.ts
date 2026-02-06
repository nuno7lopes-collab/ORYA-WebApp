import crypto from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAppEnv } from "@/lib/appEnv";
import { logWarn } from "@/lib/observability/logger";

const DEFAULT_LOCK_TTL_MS = Number(process.env.CRON_LOCK_TTL_MS || "90000");

type CronJobLock = {
  jobKey: string;
  env: string;
  ownerId: string;
  lockedUntil: Date;
};

type CronJobLockState = {
  enabled: boolean;
  acquired: boolean;
  lock?: CronJobLock;
};

function isMissingRelationError(err: unknown) {
  if (!err || typeof err !== "object") return false;
  const code = (err as { code?: string }).code;
  if (code === "42P01") return true;
  const message = "message" in err ? String((err as { message?: string }).message) : "";
  return message.includes("cron_job_locks") && message.includes("does not exist");
}

export async function tryAcquireCronLock(jobKey: string, ttlMs = DEFAULT_LOCK_TTL_MS): Promise<CronJobLockState> {
  const env = getAppEnv();
  const now = new Date();
  const effectiveTtlMs = Math.max(1000, ttlMs);
  const lockedUntil = new Date(now.getTime() + effectiveTtlMs);
  const ownerId = crypto.randomUUID();

  try {
    const rows = await prisma.$queryRaw<{ lockedBy: string; lockedUntil: Date }[]>(Prisma.sql`
      INSERT INTO app_v3.cron_job_locks (
        job_key,
        env,
        locked_at,
        locked_until,
        locked_by,
        created_at,
        updated_at
      )
      VALUES (${jobKey}, ${env}, ${now}, ${lockedUntil}, ${ownerId}, ${now}, ${now})
      ON CONFLICT (job_key, env) DO UPDATE
      SET locked_at = EXCLUDED.locked_at,
          locked_until = EXCLUDED.locked_until,
          locked_by = EXCLUDED.locked_by,
          updated_at = EXCLUDED.updated_at
      WHERE app_v3.cron_job_locks.locked_until IS NULL
         OR app_v3.cron_job_locks.locked_until <= ${now}
      RETURNING locked_by as "lockedBy", locked_until as "lockedUntil";
    `);

    const row = rows[0];
    if (!row || row.lockedBy !== ownerId) {
      return { enabled: true, acquired: false };
    }

    return {
      enabled: true,
      acquired: true,
      lock: { jobKey, env, ownerId, lockedUntil: row.lockedUntil },
    };
  } catch (err) {
    if (isMissingRelationError(err)) {
      logWarn("cron.lock.missing_table", { jobKey, env }, { fallbackToRequestContext: false });
      return { enabled: false, acquired: true };
    }
    logWarn(
      "cron.lock.acquire_failed",
      {
        jobKey,
        env,
        error: err instanceof Error ? err.message : String(err),
      },
      { fallbackToRequestContext: false },
    );
    return { enabled: false, acquired: true };
  }
}

export async function releaseCronLock(lock: CronJobLock) {
  const now = new Date();
  try {
    await prisma.$executeRaw(Prisma.sql`
      UPDATE app_v3.cron_job_locks
      SET locked_until = ${now},
          updated_at = ${now}
      WHERE job_key = ${lock.jobKey}
        AND env = ${lock.env}
        AND locked_by = ${lock.ownerId};
    `);
  } catch (err) {
    if (isMissingRelationError(err)) return;
    logWarn(
      "cron.lock.release_failed",
      {
        jobKey: lock.jobKey,
        env: lock.env,
        error: err instanceof Error ? err.message : String(err),
      },
      { fallbackToRequestContext: false },
    );
  }
}
