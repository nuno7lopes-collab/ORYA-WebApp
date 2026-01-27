import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireInternalSecret } from "@/lib/security/requireInternalSecret";

function parseLimit(value: string | null) {
  const raw = Number(value ?? "100");
  if (!Number.isFinite(raw)) return 100;
  return Math.min(Math.max(raw, 1), 200);
}

export async function GET(req: NextRequest) {
  try {
    if (!requireInternalSecret(req)) {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
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

    return NextResponse.json({ ok: true, items });
  } catch (err) {
    console.error("GET /api/internal/ops/feed error:", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
