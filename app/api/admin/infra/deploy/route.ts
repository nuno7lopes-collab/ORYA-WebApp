import { NextRequest } from "next/server";
import { requireAdminUser } from "@/lib/admin/auth";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { logError } from "@/lib/observability/logger";
import {
  auditInfraAction,
  normalizeTargetEnv,
  requireInfraAction,
  resolveInfraIpAllowlist,
  runScript,
} from "@/app/api/admin/infra/_helpers";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function fail(ctx: ReturnType<typeof getRequestContext>, status: number, errorCode: string, message = errorCode) {
  return respondError(ctx, { errorCode, message, retryable: status >= 500 }, { status });
}

function trim(text: string, limit = 4000) {
  return text.length > limit ? text.slice(0, limit) + "..." : text;
}

function parseImage(linePrefix: string, output: string) {
  const line = output.split("\n").find((row) => row.startsWith(linePrefix));
  return line ? line.replace(linePrefix, "").trim() : "";
}

async function _POST(req: NextRequest) {
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
    const ipAllowlist = resolveInfraIpAllowlist("DEPLOY");
    const guard = await requireInfraAction({
      req,
      ctx,
      admin,
      targetEnv,
      confirmProd: body?.confirmProd,
      mfaCode: body?.mfaCode,
      recoveryCode: body?.recoveryCode,
      ipAllowlist,
    });
    if (!guard.ok) {
      return fail(ctx, guard.status, guard.error, guard.message);
    }

    const withAlb = body?.withAlb ?? (process.env.ORYA_WITH_ALB === "true");
    const enableWorker = body?.enableWorker ?? (process.env.ORYA_ENABLE_WORKER === "true");

    const build = await runScript(ctx, "build-and-push.sh", [], { APP_ENV: targetEnv });
    if (!build.ok) {
      await auditInfraAction(ctx, admin, "ADMIN_INFRA_DEPLOY", { ok: false, step: "build" });
      return fail(ctx, 500, "INFRA_BUILD_FAILED", trim(build.stderr));
    }

    const webImage = parseImage("WEB_IMAGE_SHA=", build.stdout);
    const workerImage = parseImage("WORKER_IMAGE_SHA=", build.stdout);

    const extraEnv: Record<string, string> = {
      WITH_ALB: withAlb ? "true" : "false",
      ENABLE_WORKER: enableWorker ? "true" : "false",
      APP_ENV: targetEnv,
    };
    if (webImage) extraEnv.WEB_IMAGE = webImage;
    if (workerImage) extraEnv.WORKER_IMAGE = workerImage;
    if (typeof body?.webDesiredCount === "number") {
      extraEnv.WEB_DESIRED_COUNT = String(body.webDesiredCount);
    }
    if (typeof body?.workerDesiredCount === "number") {
      extraEnv.WORKER_DESIRED_COUNT = String(body.workerDesiredCount);
    }

    const deploy = await runScript(ctx, "deploy-cf.sh", [], extraEnv);
    await auditInfraAction(ctx, admin, "ADMIN_INFRA_DEPLOY", {
      ok: deploy.ok,
      webImage,
      workerImage,
      withAlb,
      enableWorker,
      targetEnv,
    });

    if (!deploy.ok) {
      return fail(ctx, 500, "INFRA_DEPLOY_FAILED", trim(deploy.stderr));
    }

    return respondOk(ctx, {
      action: "deploy",
      webImage,
      workerImage,
      build: trim(build.stdout),
      deploy: trim(deploy.stdout),
    });
  } catch (err) {
    logError("admin.infra.deploy_failed", err);
    return fail(ctx, 500, "INTERNAL_ERROR");
  }
}
export const POST = withApiEnvelope(_POST);
