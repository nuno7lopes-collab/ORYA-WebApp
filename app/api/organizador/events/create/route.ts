

// app/api/organizador/events/create/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, assertOrganizer } from "@/lib/security";

// Tipos esperados no body do pedido
type TicketTypeInput = {
  name?: string;
  price?: number;
  totalQuantity?: number | null;
};

type CreateOrganizerEventBody = {
  title?: string;
  description?: string;
  startsAt?: string;
  endsAt?: string;
  locationName?: string;
  locationCity?: string;
  templateType?: string; // PARTY | SPORT | VOLUNTEERING | TALK | OTHER
  ticketTypes?: TicketTypeInput[];
};

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function POST(req: NextRequest) {
  try {
    let body: CreateOrganizerEventBody | null = null;

    try {
      body = (await req.json()) as CreateOrganizerEventBody;
    } catch {
      return NextResponse.json(
        { ok: false, error: "Body inválido." },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    // Confirmar que o profile existe (caso o user tenha contornado o onboarding)
    const profile = await prisma.profile.findUnique({
      where: { id: user.id },
    });

    if (!profile) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Perfil não encontrado. Completa o onboarding antes de criares eventos de organizador.",
        },
        { status: 400 }
      );
    }

    // Buscar organizer associado a este profile
    const organizer = await prisma.organizer.findFirst({
      where: {
        userId: profile.id,
        status: "ACTIVE",
      },
    });

    // Garante que o user tem role de organizer e que este organizer pertence-lhe
    assertOrganizer(user, profile, organizer ?? undefined);

    const title = body.title?.trim();
    const description = body.description?.trim() ?? "";
    const startsAtRaw = body.startsAt;
    const endsAtRaw = body.endsAt;
    const locationName = body.locationName?.trim() ?? "";
    const locationCity = body.locationCity?.trim() ?? "";
    const templateTypeRaw = body.templateType?.toUpperCase() as
      | "PARTY"
      | "SPORT"
      | "VOLUNTEERING"
      | "TALK"
      | "OTHER"
      | undefined;

    if (!title) {
      return NextResponse.json(
        { ok: false, error: "Título é obrigatório." },
        { status: 400 }
      );
    }

    if (!startsAtRaw) {
      return NextResponse.json(
        { ok: false, error: "Data/hora de início é obrigatória." },
        { status: 400 }
      );
    }

    const startsAt = new Date(startsAtRaw);
    if (Number.isNaN(startsAt.getTime())) {
      return NextResponse.json(
        { ok: false, error: "Data/hora de início inválida." },
        { status: 400 }
      );
    }

    // Para simplificar e evitar conflitos de tipos, endsAt será sempre enviado.
    // Se o utilizador não mandar, usamos a mesma data/hora de início.
    let endsAt: Date = startsAt;
    if (endsAtRaw) {
      const d = new Date(endsAtRaw);
      if (Number.isNaN(d.getTime())) {
        return NextResponse.json(
          { ok: false, error: "Data/hora de fim inválida." },
          { status: 400 }
        );
      }
      endsAt = d;
    }

    const templateType = templateTypeRaw ?? "OTHER";

    const ticketTypesInput = body.ticketTypes ?? [];

    // Validar tipos de bilhete
    const ticketTypesData = ticketTypesInput
      .map((t) => {
        const name = t.name?.trim();
        if (!name) return null;

        const price =
          typeof t.price === "number" && !Number.isNaN(t.price) && t.price >= 0
            ? t.price
            : 0;

        const totalQuantity =
          typeof t.totalQuantity === "number" && t.totalQuantity > 0
            ? t.totalQuantity
            : null;

        return {
          name,
          price,
          totalQuantity,
        };
      })
      .filter((t): t is { name: string; price: number; totalQuantity: number | null } =>
        Boolean(t)
      );

    if (ticketTypesData.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Pelo menos um tipo de bilhete é obrigatório." },
        { status: 400 }
      );
    }

    const baseSlug = slugify(title) || "evento";
    const randomSuffix = Math.random().toString(36).slice(2, 8);
    const slug = `${baseSlug}-${randomSuffix}`;

    // Criar o evento primeiro
    const event = await prisma.event.create({
      data: {
        slug,
        title,
        description,
        type: "ORGANIZER_EVENT",
        templateType,
        ownerUserId: profile.id,
        organizerId: organizer!.id,
        startsAt,
        endsAt,
        locationName,
        locationCity,
        isFree: ticketTypesData.every((t) => t.price === 0),
        status: "PUBLISHED",
      },
    });

    // Criar os tipos de bilhete associados a este evento
    await prisma.ticketType.createMany({
      data: ticketTypesData.map((t) => ({
        eventId: event.id,
        name: t.name,
        price: t.price,
        // Assumimos que currency tem default "EUR" e restantes campos têm defaults.
        totalQuantity: t.totalQuantity ?? null,
      })),
    });

    return NextResponse.json(
      {
        ok: true,
        event: {
          id: event.id,
          slug: event.slug,
          title: event.title,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("POST /api/organizador/events/create error:", err);
    return NextResponse.json(
      { ok: false, error: "Erro interno ao criar evento." },
      { status: 500 }
    );
  }
}