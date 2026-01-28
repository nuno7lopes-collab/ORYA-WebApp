import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { requireAdminUser } from "@/lib/admin/auth";
import { getRequestContext } from "@/lib/http/requestContext";
import { getPlatformOfficialEmail, setPlatformOfficialEmail } from "@/lib/organizationOfficialEmail";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

async function _GET(req: NextRequest) {
  const ctx = getRequestContext(req);
  try {
    const admin = await requireAdminUser();
    if (!admin.ok) {
      return jsonWrap(
        { ok: false, error: admin.error, requestId: ctx.requestId, correlationId: ctx.correlationId },
        { status: admin.status },
      );
    }

    const result = await getPlatformOfficialEmail();
    return jsonWrap({
      ok: true,
      email: result.email,
      source: result.source,
      requestId: ctx.requestId,
      correlationId: ctx.correlationId,
    });
  } catch (err) {
    console.error("[/api/admin/config/platform-email] GET error", err);
    return jsonWrap(
      { ok: false, error: "INTERNAL_ERROR", requestId: ctx.requestId, correlationId: ctx.correlationId },
      { status: 500 },
    );
  }
}

async function _POST(req: NextRequest) {
  const ctx = getRequestContext(req);
  try {
    const admin = await requireAdminUser();
    if (!admin.ok) {
      return jsonWrap(
        { ok: false, error: admin.error, requestId: ctx.requestId, correlationId: ctx.correlationId },
        { status: admin.status },
      );
    }

    const body = (await req.json().catch(() => null)) as { email?: string } | null;
    const rawEmail = body?.email ?? "";
    if (!rawEmail) {
      return jsonWrap(
        { ok: false, error: "INVALID_EMAIL", requestId: ctx.requestId, correlationId: ctx.correlationId },
        { status: 400 },
      );
    }

    const email = await setPlatformOfficialEmail(rawEmail);
    return jsonWrap({
      ok: true,
      email,
      requestId: ctx.requestId,
      correlationId: ctx.correlationId,
    });
  } catch (err) {
    if (err instanceof Error && err.message === "INVALID_EMAIL") {
      return jsonWrap(
        { ok: false, error: "INVALID_EMAIL", requestId: ctx.requestId, correlationId: ctx.correlationId },
        { status: 400 },
      );
    }
    console.error("[/api/admin/config/platform-email] POST error", err);
    return jsonWrap(
      { ok: false, error: "INTERNAL_ERROR", requestId: ctx.requestId, correlationId: ctx.correlationId },
      { status: 500 },
    );
  }
}
export const GET = withApiEnvelope(_GET);
export const POST = withApiEnvelope(_POST);