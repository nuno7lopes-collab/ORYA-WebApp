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

async function _POST(req: NextRequest) {
  const ctx = getRequestContext(req);
  try {
    const admin = await requireAdminUser();
    if (!admin.ok) return fail(ctx, admin.status, admin.error);
    const body = (await req.json().catch(() => null)) as
      | {
          env?: "prod" | "dev" | "all";
          group?: string | "all";
          copyProdToDev?: boolean;
          targetEnv?: string;
          confirmProd?: string;
          mfaCode?: string;
          recoveryCode?: string;
        }
      | null;

    const targetEnv = normalizeTargetEnv(body?.targetEnv);
    const ipAllowlist = resolveInfraIpAllowlist("ROTATE_SECRETS");
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

    const envs = body?.env === "all" || !body?.env ? "prod,dev" : body.env;
    const groups = body?.group === "all" || !body?.group ? "" : body.group;

    const extraEnv: Record<string, string> = {
      ONLY_ENVS: envs,
      ONLY_GROUPS: groups,
      ALLOW_PLACEHOLDERS_DEV: "true",
      COPY_PROD_TO_DEV: body?.copyProdToDev ? "true" : "false",
      APP_ENV: targetEnv,
    };

    const result = await runScript(ctx, "create-secrets-json.sh", ["/tmp/orya-prod-secrets.json"], extraEnv);
    await auditInfraAction(ctx, admin, "ADMIN_INFRA_ROTATE_SECRETS", {
      ok: result.ok,
      envs,
      groups,
      targetEnv,
    });

    if (!result.ok) {
      return fail(ctx, 500, "INFRA_ROTATE_SECRETS_FAILED", trim(result.stderr));
    }

    return respondOk(ctx, { action: "rotate_secrets", stdout: trim(result.stdout), stderr: trim(result.stderr) });
  } catch (err) {
    logError("admin.infra.rotate_secrets_failed", err);
    return fail(ctx, 500, "INTERNAL_ERROR");
  }
}
export const POST = withApiEnvelope(_POST);
