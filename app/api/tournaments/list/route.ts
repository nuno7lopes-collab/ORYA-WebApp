import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

async function _GET(req: NextRequest) {
  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 200);

  const events = await prisma.event.findMany({
    where: { status: "PUBLISHED", isDeleted: false, tournament: { isNot: null } },
    orderBy: { startsAt: "asc" },
    take: limit,
    select: {
      id: true,
      slug: true,
      title: true,
      startsAt: true,
      endsAt: true,
      tournament: { select: { id: true, format: true } },
    },
  });

  return jsonWrap({ ok: true, tournaments: events }, { status: 200 });
}
export const GET = withApiEnvelope(_GET);