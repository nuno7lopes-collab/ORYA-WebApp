// app/api/eventos/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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
      organizer,
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
    // eslint-disable-next-line no-constant-condition
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
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        timezone: timezone || "Europe/Lisbon",
        isFree: !!isFree,
        ticketPrice: isFree ? null : ticketPrice ?? null,
        locationName,
        address: address || "",
        coverImage:
          coverImage ||
          "https://images.unsplash.com/photo-1541987392829-5937c1069305?q=80&w=1600",
        organizer: organizer || "ORYA Team",
      },
    });

    return NextResponse.json({ slug: event.slug }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Erro ao criar evento." },
      { status: 500 }
    );
  }
}