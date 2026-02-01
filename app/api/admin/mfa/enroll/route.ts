import { NextRequest } from "next/server";
import { requireAdminUser } from "@/lib/admin/auth";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { logError } from "@/lib/observability/logger";
import { enrollMfa } from "@/lib/admin/mfa";

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

    const data = await enrollMfa(admin.userId, admin.userEmail);
    return respondOk(ctx, data);
  } catch (err: any) {
    if (err?.message === "MFA_ALREADY_ENABLED") {
      return fail(ctx, 409, "MFA_ALREADY_ENABLED", "2FA já está ativo.");
    }
    if (err?.message?.includes("ADMIN_TOTP_ENCRYPTION_KEY")) {
      return fail(ctx, 412, "MFA_CONFIG_MISSING", "ADMIN_TOTP_ENCRYPTION_KEY em falta.");
    }
    logError("admin.mfa.enroll_failed", err);
    return fail(ctx, 500, "INTERNAL_ERROR");
  }
}
