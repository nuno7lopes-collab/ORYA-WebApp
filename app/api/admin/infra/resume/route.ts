import { NextRequest } from "next/server";
import { requireAdminUser } from "@/lib/admin/auth";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { logError } from "@/lib/observability/logger";
import { auditInfraAction, normalizeTargetEnv, requireInfraAction, runScript } from "@/app/api/admin/infra/_helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function fail(ctx: ReturnType<typeof getRequestContext>, status: number, errorCode: string, message = errorCode) {
  return respondError(ctx, { errorCode, message, retryable: status >= 500 }, { status });
}

function trim(text: string, limit = 4000) {
  return text.length > limit ? text.slice(0, limit) + "..." : text;
}

export async function POST(req: NextRequest) {
  const ctx = getRequestContext(req);
  try {
    const admin = await requireAdminUser();
    if (!admin.ok) return fail(ctx, admin.status, admin.error);
    const body = (await req.json().catch(() => null)) as
      | {
          withAlb?: boolean;
          enableWorker?: boolean;
          webDesiredCount?: number;
          workerDesiredCount?: number;
          targetEnv?: string;
          confirmProd?: string;
          mfaCode?: string;
          recoveryCode?: string;
        }
      | null;

    const targetEnv = normalizeTargetEnv(body?.targetEnv);
    const guard = await requireInfraAction({
      req,
      ctx,
      admin,
      targetEnv,
      confirmProd: body?.confirmProd,
      mfaCode: body?.mfaCode,
      recoveryCode: body?.recoveryCode,
    });
    if (!guard.ok) {
      return fail(ctx, guard.status, guard.error, guard.message);
    }

    const withAlb = body?.withAlb ?? (process.env.ORYA_WITH_ALB === "true");
    const enableWorker = body?.enableWorker ?? (process.env.ORYA_ENABLE_WORKER === "true");
    const extraEnv: Record<string, string> = {
      WITH_ALB: withAlb ? "true" : "false",
      ENABLE_WORKER: enableWorker ? "true" : "false",
      APP_ENV: targetEnv,
    };
    if (typeof body?.webDesiredCount === "number") {
      extraEnv.WEB_DESIRED_COUNT = String(body.webDesiredCount);
    }
    if (typeof body?.workerDesiredCount === "number") {
      extraEnv.WORKER_DESIRED_COUNT = String(body.workerDesiredCount);
    }

    const result = await runScript(ctx, "deploy-cf.sh", ["--resume"], extraEnv);
    await auditInfraAction(ctx, admin, "ADMIN_INFRA_RESUME", {
      withAlb,
      enableWorker,
      targetEnv,
      ok: result.ok,
    });

    if (!result.ok) {
      return fail(ctx, 500, "INFRA_RESUME_FAILED", trim(result.stderr));
    }

    return respondOk(ctx, { action: "resume", stdout: trim(result.stdout), stderr: trim(result.stderr) });
  } catch (err) {
    logError("admin.infra.resume_failed", err);
    return fail(ctx, 500, "INTERNAL_ERROR");
  }
}
