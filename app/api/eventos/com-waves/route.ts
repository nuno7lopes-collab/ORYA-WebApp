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

export async function GET(_req: NextRequest) {
  try {
    const events = await prisma.event.findMany({
      orderBy: {
        startsAt: "asc",
      },
      include: {
        ticketTypes: {
          orderBy: {
            sortOrder: "asc",
          },
        },
        organizer: {
          select: {
            publicName: true,
          },
        },
      },
    });

    const payload = events.map((event) => {
      const waves = event.ticketTypes.map((t) => {
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

        const available = status === "on_sale";

        return {
          id: String(t.id),
          name: t.name,
          description: t.description,
          price: t.price,
          currency: t.currency,
          available,
          isVisible: true,
          startsAt: t.startsAt,
          endsAt: t.endsAt,
          totalQuantity: t.totalQuantity,
          soldQuantity: t.soldQuantity,
          remaining,
          status,
        };
      });

      const basePrice =
        waves.length > 0
          ? waves.reduce<number | null>((min, w) => {
              if (w.price == null) return min;
              if (min == null) return w.price;
              return w.price < min ? w.price : min;
            }, null)
          : null;

      return {
        id: event.id,
        slug: event.slug,
        title: event.title,
        description: event.description,
        startDate: event.startsAt,
        endDate: event.endsAt,
        locationName: event.locationName,
        address: event.address,
        isFree: event.isFree,
        basePrice,
        timezone: event.timezone,
        coverImageUrl: event.coverImageUrl,
        organizerName: event.organizer?.publicName ?? null,
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
