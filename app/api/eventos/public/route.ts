// app/api/eventos/public/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type EventWithTickets = {
  id: number;
  slug: string;
  title: string;
  description: string | null;
  startDate: Date;
  endDate: Date | null;
  locationName: string | null;
  coverImageUrl: string | null;
  isFree: boolean;
  basePrice: number | null;
  tickets: { price: number }[];
};

export async function GET(_req: NextRequest) {
  try {
    const events = await prisma.event.findMany({
      orderBy: { startDate: "asc" },
      include: {
        tickets: true,
      },
    });

    const payload = events.map((event: EventWithTickets) => {
      const minTicketPrice =
        event.tickets.length > 0
          ? Math.min(...event.tickets.map((t) => t.price))
          : null;

      const basePriceFrom = event.isFree
        ? 0
        : event.basePrice ?? minTicketPrice;

      return {
        id: event.id,
        slug: event.slug,
        title: event.title,
        description: event.description,
        startDate: event.startDate,
        endDate: event.endDate,
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