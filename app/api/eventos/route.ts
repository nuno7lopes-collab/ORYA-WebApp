// app/api/eventos/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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
  price: number;
  available?: boolean;
  name?: string;
  currency?: string;
};

export async function POST(req: NextRequest) {
  try {
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
      coverImage,     // opcional, caso algum front antigo ainda envie este nome
      coverImageUrl,  // nome “oficial” que estamos a usar no formulário
      organizerName,
      tickets,
    } = body;

    // Validação básica
    if (!title || !description || !startDate || !endDate || !locationName) {
      return NextResponse.json(
        { error: "Campos obrigatórios em falta." },
        { status: 400 },
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
        { status: 400 },
      );
    }

    const slugBase = slugify(title);
    let slug = slugBase;
    let counter = 1;

    // Garantir slug único
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const existing = await prisma.event.findUnique({ where: { slug } });
      if (!existing) break;
      slug = `${slugBase}-${counter++}`;
    }

    const ticketsArray: TicketPayload[] = Array.isArray(tickets)
      ? tickets.filter(
          (t: any) =>
            t &&
            typeof t.price === "number" &&
            !Number.isNaN(t.price),
        )
      : [];

    const free = Boolean(isFree);

    // basePrice final: se for grátis é 0; senão usa basePrice ou o preço do 1º bilhete
    const computedBasePrice = free
      ? 0
      : typeof basePrice === "number" && !Number.isNaN(basePrice)
      ? basePrice
      : ticketsArray[0]
      ? Math.round(ticketsArray[0].price)
      : 0;

    const computedCoverImageUrl =
      coverImageUrl ||
      coverImage ||
      "https://images.unsplash.com/photo-1541987392829-5937c1069305?q=80&w=1600";

    const event = await prisma.event.create({
      data: {
        slug,
        title,
        description,
        startDate: startDateISO,
        endDate: endDateISO,
        timezone: timezone || "Europe/Lisbon",
        isFree: free,
        basePrice: computedBasePrice,
        locationName,
        address: address || "",
        coverImageUrl: computedCoverImageUrl,
        organizerName: organizerName || "ORYA Team",
        tickets:
          !free && ticketsArray.length > 0
            ? {
                create: ticketsArray.map((t) => ({
                  name: t.name ?? "Entrada geral",
                  currency: t.currency ?? "EUR",
                  price: Math.round(t.price),
                  available:
                    typeof t.available === "boolean" ? t.available : true,
                })),
              }
            : undefined,
      },
      include: {
        tickets: true,
      },
    });

    return NextResponse.json({ slug: event.slug }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/eventos]", err);
    return NextResponse.json(
      { error: "Erro ao criar evento." },
      { status: 500 },
    );
  }
}