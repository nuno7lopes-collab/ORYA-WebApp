import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabaseServer";

export async function POST(_req: NextRequest) {
  // resposta base
  const res = NextResponse.json({ success: true });

  // obter o client do Supabase (nova versão da helper)
  const supabase = await createSupabaseServer();

  // terminar sessão (limpa cookies de auth)
  const { error } = await supabase.auth.signOut();

  if (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 400 },
    );
  }

  return res;
}