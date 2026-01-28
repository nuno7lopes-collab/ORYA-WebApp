import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { readNumericParam } from "@/lib/routeParams";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

async function _GET(req: NextRequest, { params }: { params: { id: string } }) {
  const eventId = readNumericParam(params?.id, req, "tournaments");
  if (eventId === null) {
    return jsonWrap({ ok: false, error: "INVALID_ID" }, { status: 400 });
  }

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      slug: true,
      title: true,
      startsAt: true,
      endsAt: true,
      status: true,
      isDeleted: true,
      tournament: { select: { id: true, format: true, config: true } },
    },
  });
  if (!event || event.isDeleted || event.status !== "PUBLISHED" || !event.tournament) {
    return jsonWrap({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  }

  return jsonWrap({ ok: true, tournament: event }, { status: 200 });
}
export const GET = withApiEnvelope(_GET);