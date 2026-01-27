import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireInternalSecret } from "@/lib/security/requireInternalSecret";
import { getRequestContext } from "@/lib/http/requestContext";

function parseLimit(value: string | null) {
  const raw = Number(value ?? "100");
  if (!Number.isFinite(raw)) return 100;
  return Math.min(Math.max(raw, 1), 200);
}

export async function GET(req: NextRequest) {
  const ctx = getRequestContext(req);
  try {
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

    const params = req.nextUrl.searchParams;
    const limit = parseLimit(params.get("limit"));
    const cursor = params.get("cursor");

    const items = await prisma.activityFeedItem.findMany({
      ...(cursor
        ? {
            cursor: { id: cursor },
            skip: 1,
          }
        : {}),
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit,
      select: {
        id: true,
        eventId: true,
        eventType: true,
        createdAt: true,
        organizationId: true,
        actorUserId: true,
        sourceType: true,
        sourceId: true,
        correlationId: true,
      },
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
    console.error("GET /api/internal/ops/feed error:", err);
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
