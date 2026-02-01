import { NextRequest } from "next/server";
import { requireAdminUser } from "@/lib/admin/auth";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { logError } from "@/lib/observability/logger";
import { verifyMfaCode } from "@/lib/admin/mfa";
import { setMfaSessionCookie } from "@/lib/admin/mfaSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function fail(ctx: ReturnType<typeof getRequestContext>, status: number, errorCode: string, message = errorCode) {
  return respondError(ctx, { errorCode, message, retryable: status >= 500 }, { status });
}

export async function POST(req: NextRequest) {
  const ctx = getRequestContext(req);
  try {
    const admin = await requireAdminUser({ req, skipMfa: true });
    if (!admin.ok) return fail(ctx, admin.status, admin.error);

    const body = (await req.json().catch(() => null)) as { code?: string; recoveryCode?: string } | null;
    const result = await verifyMfaCode({
      userId: admin.userId,
      code: body?.code,
      recoveryCode: body?.recoveryCode,
    });
    if (!result.ok) {
      return fail(ctx, 401, result.error, "Código 2FA inválido.");
    }
    const response = respondOk(ctx, { ok: true, usedRecovery: result.usedRecovery });
    setMfaSessionCookie(response, admin.userId);
    return response;
  } catch (err: any) {
    if (err?.message?.includes("ADMIN_TOTP_ENCRYPTION_KEY")) {
      return fail(ctx, 412, "MFA_CONFIG_MISSING", "ADMIN_TOTP_ENCRYPTION_KEY em falta.");
    }
    logError("admin.mfa.verify_failed", err);
    return fail(ctx, 500, "INTERNAL_ERROR");
  }
}
