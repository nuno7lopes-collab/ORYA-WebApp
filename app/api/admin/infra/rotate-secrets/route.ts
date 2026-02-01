import { NextRequest } from "next/server";
import { requireAdminUser } from "@/lib/admin/auth";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { logError } from "@/lib/observability/logger";
import { auditInfraAction, normalizeTargetEnv, requireProdConfirmation, runScript } from "@/app/api/admin/infra/_helpers";

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
    if (process.env.INFRA_READ_ONLY !== "false") {
      return fail(ctx, 403, "INFRA_READ_ONLY", "Infra read-only.");
    }

    const body = (await req.json().catch(() => null)) as
      | {
          env?: "prod" | "dev" | "all";
          group?: string | "all";
          copyProdToDev?: boolean;
          targetEnv?: string;
          confirmProd?: string;
        }
      | null;

    const targetEnv = normalizeTargetEnv(body?.targetEnv);
    const confirmError = requireProdConfirmation(targetEnv, body?.confirmProd);
    if (confirmError) {
      return fail(ctx, 403, confirmError, "Confirmação PROD necessária.");
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
