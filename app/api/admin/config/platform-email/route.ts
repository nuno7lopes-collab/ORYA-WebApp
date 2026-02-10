import { NextRequest } from "next/server";
import { requireAdminUser } from "@/lib/admin/auth";
import { auditAdminAction } from "@/lib/admin/audit";
import { getPlatformOfficialEmail, setPlatformOfficialEmail } from "@/lib/platformSettings";
import { isValidOfficialEmail, normalizeOfficialEmail } from "@/lib/organizationOfficialEmailUtils";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
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

async function _GET(req: NextRequest) {
  const ctx = getRequestContext(req);
  try {
    const admin = await requireAdminUser();
    if (!admin.ok) {
      return fail(ctx, admin.status, admin.error);
    }

    const email = await getPlatformOfficialEmail();
    return respondOk(ctx, { email }, { status: 200 });
  } catch (err) {
    logError("admin.config.platform_email_get_failed", err);
    return fail(ctx, 500, "INTERNAL_ERROR");
  }
}

async function _POST(req: NextRequest) {
  const ctx = getRequestContext(req);
  try {
    const admin = await requireAdminUser();
    if (!admin.ok) {
      return fail(ctx, admin.status, admin.error);
    }

    const body = (await req.json().catch(() => null)) as { email?: string } | null;
    const normalized = normalizeOfficialEmail(typeof body?.email === "string" ? body.email : null);
    if (!normalized || !isValidOfficialEmail(normalized)) {
      return fail(ctx, 400, "INVALID_EMAIL");
    }

    const email = await setPlatformOfficialEmail(normalized);
    await auditAdminAction({
      action: "PLATFORM_EMAIL_UPDATE",
      actorUserId: admin.userId,
      correlationId: ctx.correlationId,
      payload: { email },
    });
    return respondOk(ctx, { email }, { status: 200 });
  } catch (err) {
    if (err instanceof Error && err.message === "INVALID_EMAIL") {
      return fail(ctx, 400, "INVALID_EMAIL");
    }
    logError("admin.config.platform_email_post_failed", err);
    return fail(ctx, 500, "INTERNAL_ERROR");
  }
}
export const GET = withApiEnvelope(_GET);
export const POST = withApiEnvelope(_POST);
