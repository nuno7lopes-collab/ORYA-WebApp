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

    const result = await runScript(ctx, "deploy-cf.sh", ["--pause"], {});
    await auditInfraAction(ctx, admin, "ADMIN_INFRA_SOFT_PAUSE", { ok: result.ok });

    if (!result.ok) {
      return fail(ctx, 500, "INFRA_SOFT_PAUSE_FAILED", trim(result.stderr));
    }

    return respondOk(ctx, { action: "soft_pause", stdout: trim(result.stdout), stderr: trim(result.stderr) });
  } catch (err) {
    logError("admin.infra.soft_pause_failed", err);
    return fail(ctx, 500, "INTERNAL_ERROR");
  }
}
