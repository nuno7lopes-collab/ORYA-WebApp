import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabaseServer";

export async function POST(req: NextRequest) {
  // Criamos a resposta onde as cookies vão ser escritas
  const res = NextResponse.json({ success: true });

  // Puxamos o supabase corretamente
  const { supabase } = createSupabaseServer(req, res);

  // Sign out (apaga cookies de sessão)
  const { error } = await supabase.auth.signOut();

  if (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 400 }
    );
  }

  return res; // devolve as cookies apagadas
}