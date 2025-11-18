// app/api/eventos/com-waves/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function getWaveStatus(ticket: {
  startsAt: Date | null;
  endsAt: Date | null;
  totalQuantity: number | null;
  soldQuantity: number;
}) {
  const now = new Date();

  // Se tiver limite de stock
  if (
    ticket.totalQuantity !== null &&
    ticket.totalQuantity !== undefined &&
    ticket.soldQuantity >= ticket.totalQuantity
  ) {
    return "sold_out" as const;
  }

  if (ticket.startsAt && now < ticket.startsAt) {
    return "upcoming" as const;
  }

  if (ticket.endsAt && now > ticket.endsAt) {
    return "closed" as const;
  }

  return "on_sale" as const;
}

type WaveTicket = {
  id: string;
  name: string | null;
  description: string | null;
  price: number | null;
  currency: string | null;
  available: boolean;
  isVisible: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
  totalQuantity: number | null;
  soldQuantity: number;
};

type EventWithTickets = {
  id: number;
  slug: string | null;
  title: string;
  description: string | null;
  startDate: Date;
  endDate: Date | null;
  locationName: string | null;
  address: string | null;
  isFree: boolean;
  basePrice: number | null;
  timezone: string | null;
  coverImageUrl: string | null;
  organizerName: string | null;
  tickets: WaveTicket[];
};

export async function GET(_req: NextRequest) {
  try {
    const events = (await prisma.event.findMany({
      orderBy: {
        startDate: "asc",
      },
      include: {
        tickets: {
          orderBy: {
            sortOrder: "asc",
          },
        },
      },
    })) as EventWithTickets[];

    const payload = events.map((event) => {
      const waves = event.tickets.map((t) => {
        const remaining =
          t.totalQuantity === null || t.totalQuantity === undefined
            ? null // null = ilimitado
            : t.totalQuantity - t.soldQuantity;

        const status = getWaveStatus({
          startsAt: t.startsAt,
          endsAt: t.endsAt,
          totalQuantity: t.totalQuantity,
          soldQuantity: t.soldQuantity,
        });

        return {
          id: t.id,
          name: t.name,
          description: t.description,
          price: t.price,
          currency: t.currency,
          available: t.available,
          isVisible: t.isVisible,
          startsAt: t.startsAt,
          endsAt: t.endsAt,
          totalQuantity: t.totalQuantity,
          soldQuantity: t.soldQuantity,
          remaining,
          status,
        };
      });

      return {
        id: event.id,
        slug: event.slug,
        title: event.title,
        description: event.description,
        startDate: event.startDate,
        endDate: event.endDate,
        locationName: event.locationName,
        address: event.address,
        isFree: event.isFree,
        basePrice: event.basePrice,
        timezone: event.timezone,
        coverImageUrl: event.coverImageUrl,
        organizerName: event.organizerName,
        waves,
      };
    });

    return NextResponse.json({ events: payload }, { status: 200 });
  } catch (err) {
    console.error("[GET /api/eventos/com-waves]", err);
    return NextResponse.json(
      { error: "Erro ao carregar eventos." },
      { status: 500 },
    );
  }
}