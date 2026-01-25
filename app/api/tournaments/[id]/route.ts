import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readNumericParam } from "@/lib/routeParams";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const eventId = readNumericParam(params?.id, req, "tournaments");
  if (eventId === null) {
    return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400 });
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
    return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, tournament: event }, { status: 200 });
}
