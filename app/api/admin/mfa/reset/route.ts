import { NextRequest } from "next/server";
import { requireAdminUser } from "@/lib/admin/auth";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { logError } from "@/lib/observability/logger";
import { resetMfa } from "@/lib/admin/mfa";
import { clearMfaSessionCookie } from "@/lib/admin/mfaSession";

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

    const body = (await req.json().catch(() => null)) as { code?: string } | null;
    const data = await resetMfa({ userId: admin.userId, code: body?.code });
    if (!data.ok) {
      return fail(ctx, 401, data.error, "Código 2FA inválido.");
    }
    const response = respondOk(ctx, data.payload);
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
