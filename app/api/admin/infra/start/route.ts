import { NextRequest } from "next/server";
import { requireAdminUser } from "@/lib/admin/auth";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { logError } from "@/lib/observability/logger";
import { auditInfraAction, runScript } from "@/app/api/admin/infra/_helpers";

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
      | { withAlb?: boolean; enableWorker?: boolean; webDesiredCount?: number; workerDesiredCount?: number }
      | null;

    const withAlb = body?.withAlb ?? (process.env.ORYA_WITH_ALB === "true");
    const enableWorker = body?.enableWorker ?? (process.env.ORYA_ENABLE_WORKER === "true");
    const extraEnv: Record<string, string> = {
      WITH_ALB: withAlb ? "true" : "false",
      ENABLE_WORKER: enableWorker ? "true" : "false",
    };
    if (typeof body?.webDesiredCount === "number") {
      extraEnv.WEB_DESIRED_COUNT = String(body.webDesiredCount);
    }
    if (typeof body?.workerDesiredCount === "number") {
      extraEnv.WORKER_DESIRED_COUNT = String(body.workerDesiredCount);
    }

    const result = await runScript(ctx, "deploy-cf.sh", ["--resume"], extraEnv);
    await auditInfraAction(ctx, admin, "ADMIN_INFRA_START", {
      withAlb,
      enableWorker,
      ok: result.ok,
    });

    if (!result.ok) {
      return fail(ctx, 500, "INFRA_START_FAILED", trim(result.stderr));
    }

    return respondOk(ctx, { action: "start", stdout: trim(result.stdout), stderr: trim(result.stderr) });
  } catch (err) {
    logError("admin.infra.start_failed", err);
    return fail(ctx, 500, "INTERNAL_ERROR");
  }
}
