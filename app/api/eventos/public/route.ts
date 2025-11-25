// app/api/eventos/public/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest) {
  try {
    const events = await prisma.event.findMany({
      orderBy: { startsAt: "asc" },
    });

    const payload = events.map((event) => {
      const basePriceFrom = event.isFree ? 0 : null;

      return {
        id: event.id,
        slug: event.slug,
        title: event.title,
        description: event.description,
        startDate: event.startsAt,
        endDate: event.endsAt,
        locationName: event.locationName,
        coverImageUrl: event.coverImageUrl,
        isFree: event.isFree,
        basePriceFrom,
      };
    });

    return NextResponse.json({ events: payload }, { status: 200 });
  } catch (err) {
    console.error("[GET /api/eventos/public]", err);
    return NextResponse.json(
      { error: "Erro ao carregar eventos." },
      { status: 500 },
    );
  }
}