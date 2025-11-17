// app/api/me/tickets/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";

type UserTicket = {
  id: string;
  quantity: number;
  pricePaid: number;
  currency: string;
  purchasedAt: string;

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
        { status: 401 },
      );
    }

    const userId = userData.user.id;

    // 2) Buscar compras desse utilizador na TicketPurchase
    const purchases = await prisma.ticketPurchase.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: {
        ticket: true,
        event: true,
      },
    });

    // 3) Mapear para o formato que a página /me consegue usar facilmente
    const tickets: UserTicket[] = purchases.map((p) => ({
      id: p.id,
      quantity: p.quantity,
      pricePaid: p.pricePaid,
      currency: p.currency,
      purchasedAt: p.createdAt.toISOString(),
      event: {
        id: p.event.id,
        slug: p.event.slug,
        title: p.event.title,
        startDate: p.event.startDate.toISOString(),
        endDate: p.event.endDate.toISOString(),
        locationName: p.event.locationName,
        coverImageUrl: p.event.coverImageUrl,
      },
      ticket: {
        id: p.ticket.id,
        name: p.ticket.name,
        description: p.ticket.description ?? null,
      },
    }));

    return NextResponse.json(
      {
        success: true,
        tickets,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("[GET /api/me/tickets]", err);
    return NextResponse.json(
      {
        success: false,
        error: "Erro ao carregar bilhetes do utilizador.",
        tickets: [],
      },
      { status: 500 },
    );
  }
}