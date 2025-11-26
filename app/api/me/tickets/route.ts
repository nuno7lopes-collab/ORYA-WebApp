// app/api/me/tickets/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";

// DTO usado pelo frontend
export type UserTicket = {
  id: string;
  quantity: number; // sempre 1 (um registo por bilhete)
  pricePaid: number; // em cêntimos
  currency: string; // ex: EUR
  purchasedAt: string;

  qrToken: string | null;
  resaleId?: string | null;
  resaleStatus?: string | null;
  resalePrice?: number | null;
  resaleCurrency?: string | null;

  event: {
    id: number;
    slug: string;
    title: string;
    startDate: string;
    endDate: string;
    locationName: string;
    coverImageUrl: string | null;
    resaleMode?: "ALWAYS" | "AFTER_SOLD_OUT" | "DISABLED";
    isSoldOut?: boolean;
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
        event: {
          include: {
            ticketTypes: true,
          },
        },
        ticketType: true,
        resales: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    // Pré-calcular sold out por evento para suportar o modo AFTER_SOLD_OUT
    const eventSoldOutMap = new Map<number, boolean>();

    const isEventSoldOut = (
      eventId: number,
      ticketTypes: { totalQuantity: number | null | undefined; soldQuantity: number }[],
    ) => {
      if (eventSoldOutMap.has(eventId)) return eventSoldOutMap.get(eventId)!;

      const list = ticketTypes ?? [];
      const hasUnlimited = list.some(
        (tt) => tt.totalQuantity === null || tt.totalQuantity === undefined,
      );

      const soldOut =
        !hasUnlimited &&
        list.length > 0 &&
        list.every((tt) => {
          if (tt.totalQuantity === null || tt.totalQuantity === undefined)
            return false;
          return tt.soldQuantity >= tt.totalQuantity;
        });

      eventSoldOutMap.set(eventId, soldOut);
      return soldOut;
    };

    // 3) Devolver 1 registo por bilhete (sem agrupar) para não perder QR únicos
    const tickets: UserTicket[] = userTickets
      .filter((t) => t.event && t.ticketType)
      .map((t) => {
        const event = t.event!;
        const ticketType = t.ticketType!;
        const resale = t.resales?.[0];
        const resaleMode =
          (event as { resaleMode?: "ALWAYS" | "AFTER_SOLD_OUT" | "DISABLED" | null }).resaleMode ??
          "ALWAYS";
        const ticketTypesForSoldOut =
          Array.isArray(event.ticketTypes) && event.ticketTypes.length > 0
            ? event.ticketTypes.map((tt) => ({
                totalQuantity: tt.totalQuantity,
                soldQuantity: tt.soldQuantity,
              }))
            : [];
        const soldOut = isEventSoldOut(event.id, ticketTypesForSoldOut);

        return {
          id: t.id,
          quantity: 1,
          pricePaid: t.pricePaid ?? 0,
          currency: t.currency ?? "EUR",
          purchasedAt: t.purchasedAt.toISOString(),
          qrToken: t.qrSecret ?? null,
          resaleId: resale?.id ?? null,
          resaleStatus: resale?.status ?? null,
          resalePrice: resale?.price ?? null,
          resaleCurrency: resale?.currency ?? null,
          event: {
            id: event.id,
            slug: event.slug,
            title: event.title,
            startDate: event.startsAt?.toISOString?.() ?? "",
            endDate: event.endsAt?.toISOString?.() ?? "",
            locationName: event.locationName ?? "",
            coverImageUrl: event.coverImageUrl ?? null,
            resaleMode,
            isSoldOut: soldOut,
          },
          ticket: {
            id: String(ticketType.id),
            name: ticketType.name ?? "Bilhete",
            description: ticketType.description ?? null,
          },
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
