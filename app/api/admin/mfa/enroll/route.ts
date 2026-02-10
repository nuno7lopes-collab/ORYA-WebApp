import { NextRequest } from "next/server";
import { requireAdminUser } from "@/lib/admin/auth";
import { auditAdminAction } from "@/lib/admin/audit";
import { rateLimit } from "@/lib/auth/rateLimit";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { logError } from "@/lib/observability/logger";
import { enrollMfa } from "@/lib/admin/mfa";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function fail(ctx: ReturnType<typeof getRequestContext>, status: number, errorCode: string, message = errorCode) {
  return respondError(ctx, { errorCode, message, retryable: status >= 500 }, { status });
}

async function _POST(req: NextRequest) {
  const ctx = getRequestContext(req);
  try {
    const admin = await requireAdminUser({ req, skipMfa: true });
    if (!admin.ok) return fail(ctx, admin.status, admin.error);

    const limiter = await rateLimit(req, {
      windowMs: 15 * 60 * 1000,
      max: 3,
      keyPrefix: "admin_mfa_enroll",
      identifier: admin.userId,
    });
    if (!limiter.allowed) {
      return fail(
        ctx,
        429,
        "MFA_ENROLL_RATE_LIMITED",
        `Demasiadas tentativas. Tenta novamente em ${limiter.retryAfter}s.`,
      );
    }

    const data = await enrollMfa(admin.userId, admin.userEmail);
    await auditAdminAction({
      action: "MFA_ENROLL",
      actorUserId: admin.userId,
      correlationId: ctx.correlationId,
    });
    return respondOk(ctx, data);
  } catch (err: any) {
    if (err?.message === "MFA_ALREADY_ENABLED") {
      return fail(ctx, 409, "MFA_ALREADY_ENABLED", "2FA já está ativo.");
    }
    if (err?.message === "MFA_ALREADY_PENDING") {
      return fail(ctx, 409, "MFA_ALREADY_PENDING", "2FA já foi iniciado. Usa o código para ativar.");
    }
    if (err?.message?.includes("ADMIN_TOTP_ENCRYPTION_KEY")) {
      return fail(ctx, 412, "MFA_CONFIG_MISSING", "ADMIN_TOTP_ENCRYPTION_KEY em falta.");
    }
    logError("admin.mfa.enroll_failed", err);
    return fail(ctx, 500, "INTERNAL_ERROR");
  }
}
export const POST = withApiEnvelope(_POST);
