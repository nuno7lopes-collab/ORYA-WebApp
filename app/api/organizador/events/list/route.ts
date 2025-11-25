// app/api/organizador/events/list/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated } from "@/lib/security";

export async function GET() {
  try {
    const supabase = await createSupabaseServer();

    // 1) Garante que o utilizador está autenticado
    const user = await ensureAuthenticated(supabase);

    // 2) Buscar o profile correspondente a este user
    const profile = await prisma.profile.findUnique({
      where: { id: user.id },
    });

    if (!profile) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Perfil não encontrado. Completa o onboarding antes de gerires eventos como organizador.",
        },
        { status: 403 }
      );
    }

    // 3) Encontrar o organizer ligado a este perfil
    const organizer = await prisma.organizer.findFirst({
      where: { userId: profile.id },
    });

    if (!organizer) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Ainda não és organizador. Usa o botão 'Quero ser organizador' para começar.",
        },
        { status: 403 }
      );
    }

    const events = await prisma.event.findMany({
      where: { organizerId: organizer.id },
      orderBy: {
        startsAt: "asc",
      },
    });

    const items = events.map((event) => ({
      id: event.id,
      slug: event.slug,
      title: event.title,
      description: event.description,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      locationName: event.locationName,
      locationCity: event.locationCity,
      status: event.status,
      isFree: event.isFree,
    }));

    return NextResponse.json(
      {
        ok: true,
        items,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("GET /api/organizador/events/list error:", err);
    return NextResponse.json(
      {
        ok: false,
        error: "Erro interno ao carregar eventos do organizador.",
      },
      { status: 500 }
    );
  }
}