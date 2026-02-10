import { NextRequest } from "next/server";
import { requireAdminUser } from "@/lib/admin/auth";
import { auditAdminAction } from "@/lib/admin/audit";
import { rateLimit } from "@/lib/auth/rateLimit";
import { getClientIp } from "@/lib/auth/requestValidation";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { logError } from "@/lib/observability/logger";
import { notifyAdminSecurityEvent } from "@/lib/admin/alerts";
import { forceResetMfa, resetMfa } from "@/lib/admin/mfa";
import { clearMfaSessionCookie } from "@/lib/admin/mfaSession";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function fail(ctx: ReturnType<typeof getRequestContext>, status: number, errorCode: string, message = errorCode) {
  return respondError(ctx, { errorCode, message, retryable: status >= 500 }, { status });
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

function isIpAllowed(ip: string | null, allowlist: string[]) {
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

async function _POST(req: NextRequest) {
  const ctx = getRequestContext(req);
  try {
    const admin = await requireAdminUser({ req, skipMfa: true });
    if (!admin.ok) return fail(ctx, admin.status, admin.error);

    const allowlistRaw =
      process.env.ADMIN_MFA_RESET_IP_ALLOWLIST ?? process.env.ADMIN_ACTION_IP_ALLOWLIST ?? "";
    const allowlist = parseAllowlist(allowlistRaw);
    const ip = getClientIp(req);
    if (!isIpAllowed(ip, allowlist)) {
      return fail(ctx, 403, "IP_NOT_ALLOWED", "IP não permitido para reset de 2FA.");
    }

    const body = (await req.json().catch(() => null)) as { code?: string; breakGlassToken?: string } | null;

    const breakGlassToken = process.env.ADMIN_MFA_BREAK_GLASS_TOKEN;
    const headerToken = req.headers.get("x-orya-break-glass") || req.headers.get("x-orya-mfa-break-glass");
    const providedBreakGlass = (headerToken || body?.breakGlassToken || "").trim();
    const useBreakGlass = Boolean(breakGlassToken && providedBreakGlass && providedBreakGlass === breakGlassToken);

    if (providedBreakGlass && !breakGlassToken) {
      return fail(ctx, 412, "MFA_BREAK_GLASS_NOT_CONFIGURED", "Break-glass não configurado.");
    }

    if (!useBreakGlass) {
      const limiter = await rateLimit(req, {
        windowMs: 10 * 60 * 1000,
        max: 5,
        keyPrefix: "admin_mfa_reset",
        identifier: admin.userId,
      });
      if (!limiter.allowed) {
        return fail(
          ctx,
          429,
          "MFA_RESET_RATE_LIMITED",
          `Demasiadas tentativas. Tenta novamente em ${limiter.retryAfter}s.`,
        );
      }
      const data = await resetMfa({ userId: admin.userId, code: body?.code, userEmail: admin.userEmail });
      if (!data.ok) {
        return fail(ctx, 401, data.error, "Código 2FA inválido.");
      }
      await auditAdminAction({
        action: "MFA_RESET",
        actorUserId: admin.userId,
        correlationId: ctx.correlationId,
        payload: { usedBreakGlass: false },
      });
      const response = respondOk(ctx, data.payload);
      clearMfaSessionCookie(response);
      return response;
    }

    const limiter = await rateLimit(req, {
      windowMs: 60 * 60 * 1000,
      max: 2,
      keyPrefix: "admin_mfa_break_glass",
      identifier: admin.userId,
    });
    if (!limiter.allowed) {
      return fail(
        ctx,
        429,
        "MFA_BREAK_GLASS_RATE_LIMITED",
        `Demasiadas tentativas. Tenta novamente em ${limiter.retryAfter}s.`,
      );
    }
    const forced = await forceResetMfa({ userId: admin.userId, userEmail: admin.userEmail });
    await notifyAdminSecurityEvent({
      type: "ADMIN_MFA_BREAK_GLASS_USED",
      userId: admin.userId,
      userEmail: admin.userEmail,
      correlationId: ctx.correlationId,
      ip,
      userAgent: req.headers.get("user-agent"),
    });
    await auditAdminAction({
      action: "MFA_RESET_BREAK_GLASS",
      actorUserId: admin.userId,
      correlationId: ctx.correlationId,
      payload: { usedBreakGlass: true },
    });
    const response = respondOk(ctx, forced.payload);
    clearMfaSessionCookie(response);
    return response;
  } catch (err: any) {
    if (err?.message?.includes("ADMIN_TOTP_ENCRYPTION_KEY")) {
      return fail(ctx, 412, "MFA_CONFIG_MISSING", "ADMIN_TOTP_ENCRYPTION_KEY em falta.");
    }
    if (err?.message === "MFA_NOT_ENROLLED") {
      return fail(ctx, 404, "MFA_NOT_ENROLLED", "2FA ainda não está configurado.");
    }
    logError("admin.mfa.reset_failed", err);
    return fail(ctx, 500, "INTERNAL_ERROR");
  }
}
export const POST = withApiEnvelope(_POST);
