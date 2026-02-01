import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { appendEventLog } from "@/domain/eventLog/append";
import { logError, logInfo, logWarn } from "@/lib/observability/logger";
import type { RequestContext } from "@/lib/http/requestContext";
import { verifyMfaCode } from "@/lib/admin/mfa";
import type { Prisma } from "@prisma/client";

const execFileAsync = promisify(execFile);
const SCRIPT_TIMEOUT_MS = 15 * 60 * 1000;
const MAX_BUFFER = 4 * 1024 * 1024;

export type AdminUser = { userId: string; userEmail: string | null };
export type TargetEnv = "prod" | "test";

export function normalizeTargetEnv(value?: unknown): TargetEnv {
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "test") return "test";
  }
  return "prod";
}

export function requireProdConfirmation(targetEnv: TargetEnv, confirm?: unknown) {
  if (targetEnv !== "prod") return null;
  return confirm === "PROD" ? null : "PROD_CONFIRMATION_REQUIRED";
}

function parseAllowlist(value?: string | null) {
  if (!value) return [];
  return value
    .split(/[\s,]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function ipv4ToLong(ip: string) {
  const parts = ip.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n) || n < 0 || n > 255)) {
    return null;
  }
  return ((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
}

function cidrContains(cidr: string, ip: string) {
  const [base, bitsRaw] = cidr.split("/");
  const bits = Number(bitsRaw);
  const ipLong = ipv4ToLong(ip);
  const baseLong = ipv4ToLong(base);
  if (ipLong === null || baseLong === null || !Number.isFinite(bits)) return false;
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (ipLong & mask) === (baseLong & mask);
}

function isIpAllowed(ip: string | null) {
  const allowlist = parseAllowlist(process.env.ADMIN_ACTION_IP_ALLOWLIST);
  if (allowlist.length === 0) return true;
  if (!ip) return false;
  if (allowlist.includes("*")) return true;
  for (const entry of allowlist) {
    if (entry.includes("/")) {
      if (cidrContains(entry, ip)) return true;
    } else if (entry === ip) {
      return true;
    }
  }
  return false;
}

export function getClientIp(req: NextRequest): string | null {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = req.headers.get("x-real-ip");
  return real?.trim() || null;
}

export async function requireInfraAction(params: {
  req: NextRequest;
  ctx: RequestContext;
  admin: AdminUser;
  targetEnv: TargetEnv;
  confirmProd?: unknown;
  mfaCode?: string | null;
  recoveryCode?: string | null;
}) {
  if (process.env.INFRA_READ_ONLY !== "false") {
    return { ok: false as const, status: 403, error: "INFRA_READ_ONLY", message: "Infra read-only." };
  }

  const confirmError = requireProdConfirmation(params.targetEnv, params.confirmProd);
  if (confirmError) {
    return { ok: false as const, status: 403, error: confirmError, message: "Confirmação PROD necessária." };
  }

  const breakGlass = process.env.ADMIN_BREAK_GLASS_TOKEN;
  const headerBreakGlass = params.req.headers.get("x-orya-break-glass");
  const bypassAllowlist = breakGlass && headerBreakGlass === breakGlass;

  const clientIp = getClientIp(params.req);
  if (!bypassAllowlist && !isIpAllowed(clientIp)) {
    return { ok: false as const, status: 403, error: "IP_NOT_ALLOWED", message: "IP não permitido." };
  }

  const mfaResult = await verifyMfaCode({
    userId: params.admin.userId,
    code: params.mfaCode,
    recoveryCode: params.recoveryCode,
  });
  if (!mfaResult.ok) {
    return { ok: false as const, status: 401, error: mfaResult.error, message: "2FA inválido." };
  }

  return { ok: true as const };
}

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

// AWS SDK v3 is used for infra read endpoints; keep CLI only for local scripts (actions).
