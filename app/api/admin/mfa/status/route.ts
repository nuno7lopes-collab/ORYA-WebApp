import { NextRequest } from "next/server";
import { requireAdminUser } from "@/lib/admin/auth";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { logError } from "@/lib/observability/logger";
import { getMfaStatus } from "@/lib/admin/mfa";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function fail(ctx: ReturnType<typeof getRequestContext>, status: number, errorCode: string, message = errorCode) {
  return respondError(ctx, { errorCode, message, retryable: status >= 500 }, { status });
}

export async function GET(req: NextRequest) {
  const ctx = getRequestContext(req);
  try {
    const admin = await requireAdminUser({ req, skipMfa: true });
    if (!admin.ok) return fail(ctx, admin.status, admin.error);
    const status = await getMfaStatus(admin.userId);
    return respondOk(ctx, status);
  } catch (err) {
    logError("admin.mfa.status_failed", err);
    return fail(ctx, 500, "INTERNAL_ERROR");
  }
}
