// app/api/me/tickets/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";

// DTO usado pelo frontend
export type UserTicket = {
  id: string;
  quantity: number;
  pricePaid: number;
  currency: string;
  purchasedAt: string;

  qrToken: string | null;

  event: {
    id: number;
    slug: string;
    title: string;
    startDate: string;
    endDate: string;
    locationName: string;
    coverImageUrl: string | null;
  };

  ticket: {
    id: string;
    name: string;
    description: string | null;
  };
};

type GroupedTicket = {
  id: string;
  quantity: number;
  pricePaid: number;
  currency: string;
  purchasedAt: string;
  qrTokens: string[];
  event: {
    id: number;
    slug: string;
    title: string;
    startDate: string;
    endDate: string;
    locationName: string;
    coverImageUrl: string | null;
  };
  ticket: {
    id: string;
    name: string;
    description: string | null;
  };
};

export async function GET() {
  try {
    // 1) Obter utilizador autenticado via Supabase (cookies de server)
    const supabase = await createSupabaseServer();
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData?.user) {
      return NextResponse.json(
        { success: false, error: "Not authenticated", tickets: [] },
        { status: 401 }
      );
    }

    const userId = userData.user.id;

    // 2) Buscar bilhetes desse utilizador na tabela Ticket
    const userTickets = await prisma.ticket.findMany({
      where: { userId },
      orderBy: { purchasedAt: "desc" },
      include: {
        event: true,
        ticketType: true,
      },
    });

    // 3) Agrupar por evento + tipo de bilhete (para ter quantity > 1)
    const groupedMap = new Map<string, GroupedTicket>();

    for (const t of userTickets) {
      const event = t.event;
      const ticketType = t.ticketType;

      if (!event || !ticketType) continue;

      const key = `${event.id}_${ticketType.id}`;

      const baseEvent = {
        id: event.id,
        slug: event.slug,
        title: event.title,
        startDate: event.startsAt?.toISOString?.() ?? "",
        endDate: event.endsAt?.toISOString?.() ?? "",
        locationName: event.locationName ?? "",
        coverImageUrl: event.coverImageUrl ?? null,
      };

      const baseTicket = {
        id: String(ticketType.id),
        name: ticketType.name ?? "Bilhete",
        description: ticketType.description ?? null,
      };

      if (!groupedMap.has(key)) {
        groupedMap.set(key, {
          id: t.id,
          quantity: 1,
          pricePaid: t.pricePaid ?? 0,
          currency: t.currency ?? "EUR",
          purchasedAt: t.purchasedAt.toISOString(),
          qrTokens: [t.id], // neste momento usamos o id como token base
          event: baseEvent,
          ticket: baseTicket,
        });
      } else {
        const g = groupedMap.get(key)!;
        g.quantity += 1;
        g.pricePaid += t.pricePaid ?? 0;
        g.qrTokens.push(t.id);

        // manter purchasedAt mais antigo
        const old = new Date(g.purchasedAt).getTime();
        const now = t.purchasedAt.getTime();
        if (now < old) g.purchasedAt = t.purchasedAt.toISOString();
      }
    }

    const tickets: UserTicket[] = Array.from(groupedMap.values()).map((g) => {
      const primaryQrToken = g.qrTokens[0] ?? null;

      return {
        id: g.id,
        quantity: g.quantity,
        pricePaid: g.pricePaid,
        currency: g.currency,
        purchasedAt: g.purchasedAt,
        qrToken: primaryQrToken,
        event: g.event,
        ticket: g.ticket,
      };
    });

    return NextResponse.json(
      {
        success: true,
        tickets,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[GET /api/me/tickets] Erro inesperado:", err);
    return NextResponse.json(
      {
        success: false,
        error: "Erro ao carregar bilhetes do utilizador.",
        tickets: [],
      },
      { status: 500 }
    );
  }
}