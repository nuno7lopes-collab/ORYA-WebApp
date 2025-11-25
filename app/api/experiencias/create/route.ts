// app/api/experiencias/create/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { Prisma } from "@prisma/client"; // 👈 ADICIONADO

// Tipo esperado no body do pedido
type CreateExperienceBody = {
  title?: string;
  description?: string;
  startsAt?: string;
  endsAt?: string;
  locationName?: string;
  locationCity?: string;
  templateType?: string; // PARTY | SPORT | VOLUNTEERING | TALK | OTHER
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
    const supabase = await createSupabaseServer();

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json(
        { ok: false, error: "Não autenticado." },
        { status: 401 }
      );
    }

    let body: CreateExperienceBody | null = null;
    try {
      body = (await req.json()) as CreateExperienceBody;
    } catch {
      return NextResponse.json(
        { ok: false, error: "Body inválido." },
        { status: 400 }
      );
    }

    const title = body.title?.trim();
    const description = body.description?.trim() ?? "";
    const startsAtRaw = body.startsAt;
    const endsAtRaw = body.endsAt;
    const locationName = body.locationName?.trim() ?? "";
    const locationCity = body.locationCity?.trim() ?? "";

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

    let endsAtIso: string | undefined = undefined;
    if (endsAtRaw) {
      const d = new Date(endsAtRaw);
      if (Number.isNaN(d.getTime())) {
        return NextResponse.json(
          { ok: false, error: "Data/hora de fim inválida." },
          { status: 400 }
        );
      }
      endsAtIso = d.toISOString();
    }

    // Confirmar que o Profile existe (caso o user tenha contornado onboarding)
    const profile = await prisma.profile.findUnique({
      where: { id: user.id },
    });

    if (!profile) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Perfil não encontrado. Completa o onboarding antes de criares experiências.",
        },
        { status: 400 }
      );
    }

    const baseSlug = slugify(title) || "experiencia";
    const randomSuffix = Math.random().toString(36).slice(2, 8);
    const slug = `${baseSlug}-${randomSuffix}`;

    const templateType = (body.templateType?.toUpperCase() as
      | "PARTY"
      | "SPORT"
      | "VOLUNTEERING"
      | "TALK"
      | "OTHER"
      | undefined) ?? "OTHER";

    // 👇 Construímos primeiro o objeto bem tipado
    const eventData: Prisma.EventUncheckedCreateInput = {
      slug,
      title,
      description,
      type: "EXPERIENCE",
      templateType,
      ownerUserId: user.id,
      organizerId: null,
      startsAt,
      endsAt: endsAtIso ?? startsAt.toISOString(),
      locationName,
      locationCity,
      isFree: true,
      status: "PUBLISHED",
    };

    const event = await prisma.event.create({
      data: eventData,
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
    console.error("POST /api/experiencias/create error:", err);
    return NextResponse.json(
      { ok: false, error: "Erro interno ao criar experiência." },
      { status: 500 }
    );
  }
}