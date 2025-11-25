

// app/api/experiencias/join/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";

// Tipo de body esperado para o join
interface JoinExperienceBody {
  eventId?: number | string;
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

    let body: JoinExperienceBody | null = null;
    try {
      body = (await req.json()) as JoinExperienceBody;
    } catch {
      return NextResponse.json(
        { ok: false, error: "Body inválido." },
        { status: 400 }
      );
    }

    const rawEventId = body?.eventId;

    if (rawEventId === undefined || rawEventId === null || rawEventId === "") {
      return NextResponse.json(
        { ok: false, error: "eventId é obrigatório." },
        { status: 400 }
      );
    }

    const eventIdNumber = typeof rawEventId === "string" ? Number(rawEventId) : rawEventId;

    if (!Number.isFinite(eventIdNumber)) {
      return NextResponse.json(
        { ok: false, error: "eventId inválido." },
        { status: 400 }
      );
    }

    // Confirmar que o evento existe e é uma EXPERIENCE
    const event = await prisma.event.findUnique({
      where: { id: eventIdNumber },
      select: {
        id: true,
        type: true,
        status: true,
      },
    });

    if (!event) {
      return NextResponse.json(
        { ok: false, error: "Experiência não encontrada." },
        { status: 404 }
      );
    }

    if (event.type !== "EXPERIENCE") {
      return NextResponse.json(
        { ok: false, error: "Só é possível juntar-te a experiências." },
        { status: 400 }
      );
    }

    if (event.status === "CANCELLED" || event.status === "FINISHED") {
      return NextResponse.json(
        { ok: false, error: "Esta experiência já não aceita participantes." },
        { status: 400 }
      );
    }

    // Tentar criar o registo de participante, evitando duplicados
    try {
      await prisma.experienceParticipant.create({
        data: {
          userId: user.id,
          eventId: event.id,
        },
      });
    } catch (err) {
      // Se já existir (unique constraint), tratamos como sucesso idempotente
      // Podes refinar isto mais tarde verificando o código de erro específico do Prisma
    }

    const participantsCount = await prisma.experienceParticipant.count({
      where: { eventId: event.id },
    });

    return NextResponse.json(
      {
        ok: true,
        joined: true,
        participantsCount,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("POST /api/experiencias/join error:", err);
    return NextResponse.json(
      { ok: false, error: "Erro interno ao juntar à experiência." },
      { status: 500 }
    );
  }
}
