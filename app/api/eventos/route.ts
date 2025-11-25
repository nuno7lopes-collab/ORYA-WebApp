// app/api/eventos/route.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function slugify(title: string) {
  return title
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

type TicketPayload = {
  name: string;
  price: number;
  available: boolean;
  totalQuantity: number | null;
  startsAt: Date | null;
  endsAt: Date | null;
  isVisible: boolean;
};

export async function POST(req: NextRequest) {
  try {
    // 1) Supabase server – tentar identificar o utilizador que está a criar o evento
    let organizerId: string | null = null;
    try {
      const supabase = await createSupabaseServer();
      const { data: userData, error: userError } = await supabase.auth.getUser();

      if (!userError && userData?.user) {
        organizerId = userData.user.id;
      }
    } catch (authErr) {
      // Não quebrar a criação de evento se houver algum problema com Supabase
      console.warn("[POST /api/eventos] Erro ao obter utilizador Supabase:", authErr);
    }

    // Se não houver utilizador autenticado, não podemos criar o evento
    if (!organizerId) {
      return NextResponse.json(
        { error: "Precisas de iniciar sessão para criar eventos." },
        { status: 401 }
      );
    }

    // 2) Ler body
    const body = await req.json();

    const {
      title,
      description,
      startDate,
      endDate,
      timezone,
      isFree,
      locationName,
      address,
      basePrice,
      coverImageUrl,
      organizerName,
      tickets,
    } = body;

    // 3) Validação básica
    if (!title || !description || !startDate || !endDate || !locationName) {
      return NextResponse.json(
        { error: "Campos obrigatórios em falta." },
        { status: 400 }
      );
    }

    const startDateISO = new Date(startDate);
    const endDateISO = new Date(endDate);

    if (
      Number.isNaN(startDateISO.getTime()) ||
      Number.isNaN(endDateISO.getTime())
    ) {
      return NextResponse.json(
        { error: "Datas inválidas." },
        { status: 400 }
      );
    }
    if (endDateISO <= startDateISO) {
      return NextResponse.json(
        { error: "A data de fim tem de ser posterior à data de início." },
        { status: 400 }
      );
    }

    // 4) Gerar slug único
    const slugBase = slugify(title);
    let slug = slugBase;
    let counter = 1;

    // Garantir slug único
     
    while (true) {
      const existing = await prisma.event.findUnique({ where: { slug } });
      if (!existing) break;
      slug = `${slugBase}-${counter++}`;
    }

    // 5) Normalizar waves vindas do frontend
    const ticketsArray: TicketPayload[] = Array.isArray(tickets)
      ? tickets
          .filter(
            (t: any) =>
              t &&
              typeof t.price !== "undefined" &&
              !Number.isNaN(Number(t.price))
          )
          .map((t: any): TicketPayload => {
            const priceNumber = Math.max(0, Math.round(Number(t.price)));

            const totalQuantity =
              typeof t.totalQuantity === "number" &&
              !Number.isNaN(t.totalQuantity)
                ? t.totalQuantity
                : null;

            const startsAt =
              t.startsAt && typeof t.startsAt === "string"
                ? new Date(t.startsAt)
                : null;

            const endsAt =
              t.endsAt && typeof t.endsAt === "string"
                ? new Date(t.endsAt)
                : null;

            return {
              name:
                typeof t.name === "string" && t.name.trim().length > 0
                  ? t.name.trim()
                  : "Bilhete",
              price: priceNumber,
              available:
                typeof t.available === "boolean" ? t.available : true,
              totalQuantity,
              startsAt,
              endsAt,
              isVisible:
                typeof t.isVisible === "boolean" ? t.isVisible : true,
            };
          })
      : [];

    const free = Boolean(isFree);

    // 6) basePrice final: se for grátis é 0; senão usa basePrice ou o preço do 1º bilhete
    const computedBasePrice = free
      ? 0
      : typeof basePrice === "number" && !Number.isNaN(basePrice)
      ? basePrice
      : ticketsArray[0]
      ? ticketsArray[0].price
      : 0;

    // 7) Criar evento na DB
    const event = await prisma.event.create({
      data: {
        ownerUserId: organizerId,
        slug,
        title,
        description,
        startsAt: startDateISO,
        endsAt: endDateISO,
        timezone: timezone || "Europe/Lisbon",
        isFree: free,
        locationName,
        address: address || "",
        coverImageUrl:
          coverImageUrl ||
          "https://images.unsplash.com/photo-1541987392829-5937c1069305?q=80&w=1600",

        // Nota: por agora não associamos organizerId (modelo Organizer)
        ticketTypes:
          !free && ticketsArray.length > 0
            ? {
                create: ticketsArray.map((t, index) => ({
                  name: t.name,
                  currency: "EUR",
                  price: t.price,
                  totalQuantity: t.totalQuantity,
                  soldQuantity: 0,
                  startsAt: t.startsAt,
                  endsAt: t.endsAt,
                  isVisible: t.isVisible,
                  sortOrder: index,
                })),
              }
            : undefined,
      },
    });

    return NextResponse.json({ slug: event.slug }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/eventos]", err);
    return NextResponse.json(
      { error: "Erro ao criar evento." },
      { status: 500 }
    );
  }
}