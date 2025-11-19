import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabaseServer";

type RouteContext = {
  params: {
    slug: string;
  };
};

/**
 * GET /api/eventos/[slug]/interest
 * Versão temporária: devolve sempre hasInterest=false e total=0.
 * Mantém o contrato da API enquanto não ligamos à base de dados real.
 */
export async function GET(
  _req: NextRequest,
  _ctx: RouteContext,
): Promise<NextResponse> {
  return NextResponse.json({
    hasInterest: false,
    total: 0,
  });
}

/**
 * POST /api/eventos/[slug]/interest
 * Versão temporária: exige utilizador autenticado,
 * mas não grava ainda nada na base de dados.
 * Devolve sempre hasInterest=true e total=1 apenas para a UI conseguir reagir.
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
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "É necessário estar autenticado para marcar interesse." },
      { status: 401 },
    );
  }

  // Aqui no futuro vamos:
  //  - Confirmar se o evento existe,
  //  - Fazer toggle numa tabela EventInterest (eventId + userId),
  //  - Calcular o total real de interesses.
  // Por agora, devolvemos um estado "liked" estável e um total fictício.

  return NextResponse.json({
    hasInterest: true,
    total: 1,
  });
}