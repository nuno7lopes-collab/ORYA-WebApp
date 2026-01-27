import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireInternalSecret } from "@/lib/security/requireInternalSecret";
import { getRequestContext } from "@/lib/http/requestContext";

export async function GET(req: NextRequest) {
  const ctx = getRequestContext(req);
  try {
    if (!process.env.ORYA_CRON_SECRET) {
      return NextResponse.json(
        {
          ok: false,
          requestId: ctx.requestId,
          correlationId: ctx.correlationId,
          error: { errorCode: "MISSING_SECRET", message: "MISSING_SECRET", retryable: false },
        },
        { status: 500 },
      );
    }
    if (!requireInternalSecret(req)) {
      return NextResponse.json(
        {
          ok: false,
          requestId: ctx.requestId,
          correlationId: ctx.correlationId,
          error: { errorCode: "UNAUTHORIZED", message: "UNAUTHORIZED", retryable: false },
        },
        { status: 401 },
      );
    }

    const url = new URL(req.url);
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 200), 500);
    const orgId = Number(url.searchParams.get("organizationId"));
    const groupId = Number(url.searchParams.get("groupId"));
    const action = url.searchParams.get("action");
    const actorUserId = url.searchParams.get("actorUserId");

    const where: any = {};
    if (Number.isFinite(orgId)) where.organizationId = orgId;
    if (Number.isFinite(groupId)) where.groupId = groupId;
    if (action) where.action = action;
    if (actorUserId) where.actorUserId = actorUserId;

    const items = await prisma.organizationAuditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return NextResponse.json(
      {
        ok: true,
        requestId: ctx.requestId,
        correlationId: ctx.correlationId,
        data: { items },
        items,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("GET /api/internal/audit error:", err);
    return NextResponse.json(
      {
        ok: false,
        requestId: ctx.requestId,
        correlationId: ctx.correlationId,
        error: { errorCode: "INTERNAL_ERROR", message: "INTERNAL_ERROR", retryable: false },
      },
      { status: 500 },
    );
  }
}
