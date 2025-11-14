// app/api/me/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabaseServer";

export async function GET(req: NextRequest) {
  const res = NextResponse.next();
  const { supabase } = createSupabaseServer(req, res);

  // 1) Buscar utilizador autenticado
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData?.user) {
    return NextResponse.json(
      { success: false, error: "Not authenticated" },
      { status: 401 }
    );
  }

  // 2) Buscar perfil correspondente na tabela profiles
  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (profileError) {
    console.error("ME PROFILE ERROR:", profileError);
    return NextResponse.json(
      { success: false, error: "Erro ao carregar o perfil" },
      { status: 500 }
    );
  }

  // 3) Devolver user + profile, como a página /me espera
  return NextResponse.json({
    success: true,
    user: userData.user,
    profile: profileData,
  });
}