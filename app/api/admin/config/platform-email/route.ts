import { NextRequest } from "next/server";
import { requireAdminUser } from "@/lib/admin/auth";
import { getPlatformOfficialEmail, setPlatformOfficialEmail } from "@/lib/platformSettings";
import { isValidOfficialEmail, normalizeOfficialEmail } from "@/lib/organizationOfficialEmail";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";

function fail(
  ctx: ReturnType<typeof getRequestContext>,
  status: number,
  errorCode: string,
  message = errorCode,
  retryable = status >= 500,
) {
  return respondError(ctx, { errorCode, message, retryable }, { status });
}

export async function GET(req: NextRequest) {
  const ctx = getRequestContext(req);
  try {
    const admin = await requireAdminUser();
    if (!admin.ok) {
      return fail(ctx, admin.status, admin.error);
    }

    const email = await getPlatformOfficialEmail();
    return respondOk(ctx, { email }, { status: 200 });
  } catch (err) {
    console.error("[/api/admin/config/platform-email] GET error", err);
    return fail(ctx, 500, "INTERNAL_ERROR");
  }
}

export async function POST(req: NextRequest) {
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
    return respondOk(ctx, { email }, { status: 200 });
  } catch (err) {
    if (err instanceof Error && err.message === "INVALID_EMAIL") {
      return fail(ctx, 400, "INVALID_EMAIL");
    }
    console.error("[/api/admin/config/platform-email] POST error", err);
    return fail(ctx, 500, "INTERNAL_ERROR");
  }
}
