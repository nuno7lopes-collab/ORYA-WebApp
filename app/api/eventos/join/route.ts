// app/api/eventos/join/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";

function slugify(title: string) {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function POST(req: NextRequest) {
  try {
    // 1) Garantir que o utilizador está autenticado
    const supabase = createSupabaseServer();
    const {
      data: { user },
      error: supabaseError,
    } = await (await supabase).auth.getUser();

    if (supabaseError) {
      console.error("Erro Supabase em /api/eventos/join:", supabaseError);
      return NextResponse.json(
        { error: "Erro de autenticação." },
        { status: 500 }
      );
    }

    if (!user) {
      return NextResponse.json(
        { error: "Não autenticado." },
        { status: 401 }
      );
    }

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
      ticketPrice,
      coverImage,
    } = body;

    if (!title || !description || !startDate || !endDate || !locationName) {
      return NextResponse.json(
        { error: "Campos obrigatórios em falta." },
        { status: 400 }
      );
    }

    const slugBase = slugify(title);
    let slug = slugBase;
    let counter = 1;

    // garantir slug único
     
    while (true) {
      const existing = await prisma.event.findUnique({ where: { slug } });
      if (!existing) break;
      slug = `${slugBase}-${counter++}`;
    }

    const event = await prisma.event.create({
      data: {
        slug,
        title,
        description,
        startsAt: new Date(startDate),
        endsAt: new Date(endDate),
        timezone: timezone || "Europe/Lisbon",
        isFree: !!isFree,
        locationName,
        address: address || "",
        coverImageUrl:
          coverImage ||
          "https://images.unsplash.com/photo-1541987392829-5937c1069305?q=80&w=1600",
        ownerUserId: user.id,
      },
    });

    return NextResponse.json({ slug: event.slug }, { status: 201 });
  } catch (err) {
    console.error("Erro em /api/eventos/join:", err);
    return NextResponse.json(
      { error: "Erro ao criar evento." },
      { status: 500 }
    );
  }
}
