import { NextRequest } from "next/server";
import { requireAdminUser } from "@/lib/admin/auth";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { readAdminHost, readMfaSessionCookie, shouldRequireAdminMfa, verifyMfaSession } from "@/lib/admin/mfaSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function fail(ctx: ReturnType<typeof getRequestContext>, status: number, errorCode: string, message = errorCode) {
  return respondError(ctx, { errorCode, message, retryable: status >= 500 }, { status });
}

export async function GET(req: NextRequest) {
  const ctx = getRequestContext(req);
  const admin = await requireAdminUser({ req, skipMfa: true });
  if (!admin.ok) return fail(ctx, admin.status, admin.error);

  const host = await readAdminHost(req);
  const required = shouldRequireAdminMfa(host);
  if (!required) {
    return respondOk(ctx, { required: false, verified: true });
  }

  const token = await readMfaSessionCookie(req);
  const result = verifyMfaSession(token, admin.userId);
  if (!result.ok) {
    return respondOk(ctx, { required: true, verified: false, reason: result.reason });
  }

  return respondOk(ctx, { required: true, verified: true });
}
