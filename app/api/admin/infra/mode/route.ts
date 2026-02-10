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

type Mode = "public-min" | "public-on";

function fail(ctx: ReturnType<typeof getRequestContext>, status: number, errorCode: string, message = errorCode) {
  return respondError(ctx, { errorCode, message, retryable: status >= 500 }, { status });
}

function trim(text: string, limit = 4000) {
  return text.length > limit ? text.slice(0, limit) + "..." : text;
}

function parseMode(value?: unknown): Mode | null {
  if (value === "public-min" || value === "public-on") return value;
  return null;
}

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    return { ok: false as const, name };
  }
  return { ok: true as const, value };
}

function resolveDomains() {
  const root = process.env.ROOT_DOMAIN || "";
  const app = process.env.APP_DOMAIN || root;
  const admin = process.env.ADMIN_DOMAIN || (root ? `admin.${root}` : "");
  return { root, app, admin };
}

async function _POST(req: NextRequest) {
  const ctx = getRequestContext(req);
  try {
    const admin = await requireAdminUser();
    if (!admin.ok) return fail(ctx, admin.status, admin.error);
    const body = (await req.json().catch(() => null)) as
      | {
          mode?: string;
          targetEnv?: string;
          confirmProd?: string;
          mfaCode?: string;
          recoveryCode?: string;
        }
      | null;

    const mode = parseMode(body?.mode);
    if (!mode) return fail(ctx, 400, "MODE_INVALID", "Modo inválido.");

    const targetEnv = normalizeTargetEnv(body?.targetEnv);
    const ipAllowlist = resolveInfraIpAllowlist("MODE");
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

    const enableWorker = mode === "public-on";
    const hostedZone = requireEnv("HOSTED_ZONE_ID");
    if (!hostedZone.ok) return fail(ctx, 400, "HOSTED_ZONE_ID_MISSING", "HOSTED_ZONE_ID em falta.");
    const domains = resolveDomains();
    if (!domains.root) return fail(ctx, 400, "ROOT_DOMAIN_MISSING", "ROOT_DOMAIN em falta.");
    if (!domains.app) return fail(ctx, 400, "APP_DOMAIN_MISSING", "APP_DOMAIN em falta.");
    if (!domains.admin) return fail(ctx, 400, "ADMIN_DOMAIN_MISSING", "ADMIN_DOMAIN em falta.");

    const extraEnv: Record<string, string> = {
      WITH_ALB: "true",
      ENABLE_WORKER: enableWorker ? "true" : "false",
      WEB_DESIRED_COUNT: "1",
      WORKER_DESIRED_COUNT: enableWorker ? "1" : "0",
      FORCE_PUBLIC_SUBNETS: "true",
      CREATE_DNS_RECORDS: "true",
      HOSTED_ZONE_ID: hostedZone.value,
      ROOT_DOMAIN: domains.root,
      APP_DOMAIN: domains.app,
      ADMIN_DOMAIN: domains.admin,
      APP_ENV: targetEnv,
    };

    const result = await runScript(ctx, "deploy-cf.sh", ["--resume", "--force-public"], extraEnv);
    await auditInfraAction(ctx, admin, "ADMIN_INFRA_MODE", {
      mode,
      targetEnv,
      enableWorker,
      ok: result.ok,
    });

    if (!result.ok) {
      return fail(ctx, 500, "INFRA_MODE_FAILED", trim(result.stderr));
    }

    return respondOk(ctx, {
      action: "mode",
      mode,
      stdout: trim(result.stdout),
      stderr: trim(result.stderr),
    });
  } catch (err) {
    logError("admin.infra.mode_failed", err);
    return fail(ctx, 500, "INTERNAL_ERROR");
  }
}
export const POST = withApiEnvelope(_POST);
