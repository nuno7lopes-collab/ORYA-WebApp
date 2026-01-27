import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/admin/auth";
import { getRequestContext } from "@/lib/http/requestContext";
import { getPlatformOfficialEmail, setPlatformOfficialEmail } from "@/lib/organizationOfficialEmail";

export async function GET(req: NextRequest) {
  const ctx = getRequestContext(req);
  try {
    const admin = await requireAdminUser();
    if (!admin.ok) {
      return NextResponse.json(
        { ok: false, error: admin.error, requestId: ctx.requestId, correlationId: ctx.correlationId },
        { status: admin.status },
      );
    }

    const result = await getPlatformOfficialEmail();
    return NextResponse.json({
      ok: true,
      email: result.email,
      source: result.source,
      requestId: ctx.requestId,
      correlationId: ctx.correlationId,
    });
  } catch (err) {
    console.error("[/api/admin/config/platform-email] GET error", err);
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR", requestId: ctx.requestId, correlationId: ctx.correlationId },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  const ctx = getRequestContext(req);
  try {
    const admin = await requireAdminUser();
    if (!admin.ok) {
      return NextResponse.json(
        { ok: false, error: admin.error, requestId: ctx.requestId, correlationId: ctx.correlationId },
        { status: admin.status },
      );
    }

    const body = (await req.json().catch(() => null)) as { email?: string } | null;
    const rawEmail = body?.email ?? "";
    if (!rawEmail) {
      return NextResponse.json(
        { ok: false, error: "INVALID_EMAIL", requestId: ctx.requestId, correlationId: ctx.correlationId },
        { status: 400 },
      );
    }

    const email = await setPlatformOfficialEmail(rawEmail);
    return NextResponse.json({
      ok: true,
      email,
      requestId: ctx.requestId,
      correlationId: ctx.correlationId,
    });
  } catch (err) {
    if (err instanceof Error && err.message === "INVALID_EMAIL") {
      return NextResponse.json(
        { ok: false, error: "INVALID_EMAIL", requestId: ctx.requestId, correlationId: ctx.correlationId },
        { status: 400 },
      );
    }
    console.error("[/api/admin/config/platform-email] POST error", err);
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR", requestId: ctx.requestId, correlationId: ctx.correlationId },
      { status: 500 },
    );
  }
}
