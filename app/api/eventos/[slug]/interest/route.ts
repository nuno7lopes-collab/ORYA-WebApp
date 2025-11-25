import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";

type RouteContext = {
  params: {
    slug: string;
  };
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/eventos/[slug]/interest
 * Devolve:
 *  - hasInterest: se o utilizador atual marcou interesse neste evento
 *  - total: número total de utilizadores com interesse neste evento
 */
export async function GET(
  _req: NextRequest,
  { params }: RouteContext,
): Promise<NextResponse> {
  const { slug } = params;

  if (!slug) {
    return NextResponse.json(
      { error: "Slug do evento em falta." },
      { status: 400 },
    );
  }

  const event = await prisma.event.findUnique({
    where: { slug },
    select: { id: true },
  });

  if (!event) {
    return NextResponse.json(
      { error: "Evento não encontrado." },
      { status: 404 },
    );
  }

  // Tentar obter utilizador autenticado (não é obrigatório para GET)
  let userId: string | null = null;
  try {
    const supabase = await createSupabaseServer();
    const { data, error } = await supabase.auth.getUser();

    if (!error && data?.user) {
      userId = data.user.id;
    }
  } catch {
    // Se falhar, tratamos como utilizador não autenticado
    userId = null;
  }

  const [total, interest] = await Promise.all([
    prisma.eventInterest.count({ where: { eventId: event.id } }),
    userId
      ? prisma.eventInterest.findUnique({
          where: {
            eventId_userId: {
              eventId: event.id,
              userId,
            },
          },
        })
      : Promise.resolve(null),
  ]);

  return NextResponse.json({
    hasInterest: Boolean(interest),
    total,
  });
}

/**
 * POST /api/eventos/[slug]/interest
 * Faz toggle do interesse do utilizador autenticado neste evento.
 */
export async function POST(
  _req: NextRequest,
  { params }: RouteContext,
): Promise<NextResponse> {
  const { slug } = params;

  if (!slug) {
    return NextResponse.json(
      { error: "Slug do evento em falta." },
      { status: 400 },
    );
  }

  const supabase = await createSupabaseServer();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json(
      { error: "É necessário estar autenticado para marcar interesse." },
      { status: 401 },
    );
  }

  const event = await prisma.event.findUnique({
    where: { slug },
    select: { id: true },
  });

  if (!event) {
    return NextResponse.json(
      { error: "Evento não encontrado." },
      { status: 404 },
    );
  }

  const existing = await prisma.eventInterest.findUnique({
    where: {
      eventId_userId: {
        eventId: event.id,
        userId: user.id,
      },
    },
  });

  if (existing) {
    // Já tinha interesse → remover (toggle off)
    await prisma.eventInterest.delete({
      where: { id: existing.id },
    });
  } else {
    // Não tinha → criar interesse
    await prisma.eventInterest.create({
      data: {
        eventId: event.id,
        userId: user.id,
      },
    });
  }

  const total = await prisma.eventInterest.count({
    where: { eventId: event.id },
  });

  return NextResponse.json({
    hasInterest: !existing,
    total,
  });
}