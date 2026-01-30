import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { prisma } from "@/lib/prisma";
import { appendEventLog } from "@/domain/eventLog/append";
import { logError, logInfo, logWarn } from "@/lib/observability/logger";
import type { RequestContext } from "@/lib/http/requestContext";
import type { Prisma } from "@prisma/client";

const execFileAsync = promisify(execFile);
const SCRIPT_TIMEOUT_MS = 15 * 60 * 1000;
const MAX_BUFFER = 4 * 1024 * 1024;

export type AdminUser = { userId: string; userEmail: string | null };

export async function resolveAuditOrgId() {
  const platform = await prisma.organization.findFirst({
    where: { orgType: "PLATFORM" },
    select: { id: true },
  });
  if (platform) return platform.id;

  const fallback = await prisma.organization.findFirst({ select: { id: true } });
  return fallback?.id ?? null;
}

export async function auditInfraAction(
  ctx: RequestContext,
  admin: AdminUser,
  action: string,
  payload: Record<string, unknown>,
) {
  const orgId = await resolveAuditOrgId();
  if (!orgId) {
    logWarn("admin.infra.audit_skipped", { requestId: ctx.requestId, correlationId: ctx.correlationId });
    return null;
  }
  return appendEventLog({
    organizationId: orgId,
    eventType: action,
    actorUserId: admin.userId,
    payload: payload as Prisma.InputJsonValue,
    correlationId: ctx.correlationId,
  });
}

function buildEnv(ctx: RequestContext, extra?: Record<string, string>) {
  const env: NodeJS.ProcessEnv = { ...process.env, ...(extra ?? {}) };
  const region = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? "eu-west-1";
  env.AWS_REGION = region;
  env.AWS_DEFAULT_REGION = region;
  if (process.env.AWS_PROFILE) {
    env.AWS_PROFILE = process.env.AWS_PROFILE;
  }
  env.ORYA_REQUEST_ID = ctx.requestId;
  env.ORYA_CORRELATION_ID = ctx.correlationId;
  return env;
}

export async function runScript(
  ctx: RequestContext,
  scriptName: string,
  args: string[] = [],
  extraEnv?: Record<string, string>,
) {
  const scriptPath = path.join(process.cwd(), "scripts", scriptName);
  const env = buildEnv(ctx, extraEnv);
  logInfo("admin.infra.run_script", { requestId: ctx.requestId, correlationId: ctx.correlationId, script: scriptName, args });

  try {
    const { stdout, stderr } = await execFileAsync(scriptPath, args, {
      env,
      timeout: SCRIPT_TIMEOUT_MS,
      maxBuffer: MAX_BUFFER,
    });
    return { ok: true, stdout: stdout?.trim() ?? "", stderr: stderr?.trim() ?? "" };
  } catch (err) {
    logError("admin.infra.run_script_failed", err, { requestId: ctx.requestId, correlationId: ctx.correlationId, script: scriptName });
    return { ok: false, stdout: "", stderr: err instanceof Error ? err.message : String(err) };
  }
}

export async function runAwsCli(ctx: RequestContext, args: string[]) {
  const env = buildEnv(ctx);
  const fullArgs = [...args, "--output", "json"];
  logInfo("admin.infra.aws_cli", { requestId: ctx.requestId, correlationId: ctx.correlationId, args: fullArgs });
  try {
    const { stdout } = await execFileAsync("aws", fullArgs, {
      env,
      timeout: SCRIPT_TIMEOUT_MS,
      maxBuffer: MAX_BUFFER,
    });
    return { ok: true, data: JSON.parse(stdout) };
  } catch (err) {
    logError("admin.infra.aws_cli_failed", err, { requestId: ctx.requestId, correlationId: ctx.correlationId, args: fullArgs });
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
