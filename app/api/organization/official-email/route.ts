import "server-only";
import { NextRequest } from "next/server";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { validateOfficialEmail } from "@/lib/organizationOfficialEmail";
import { logError } from "@/lib/observability/logger";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

function fail(
  ctx: ReturnType<typeof getRequestContext>,
  status: number,
  errorCode: string,
  message = errorCode,
  retryable = status >= 500,
) {
  return respondError(ctx, { errorCode, message, retryable }, { status });
}

async function _POST(req: NextRequest) {
  const ctx = getRequestContext(req);
  try {
    const body = (await req.json().catch(() => null)) as { email?: string | null } | null;
    const result = await validateOfficialEmail({ email: body?.email ?? null });
    if (!result.valid) {
      return fail(ctx, 400, "INVALID_EMAIL");
    }
    return respondOk(ctx, result, { status: 200 });
  } catch (err) {
    logError("organization.official_email_validate_failed", err);
    return fail(ctx, 500, "INTERNAL_ERROR");
  }
}
export const POST = withApiEnvelope(_POST);
