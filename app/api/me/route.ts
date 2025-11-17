// app/api/me/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabaseServer";

export async function GET() {
  try {
    // 1) Criar cliente Supabase no servidor
    const supabase = await createSupabaseServer();

    // 2) Buscar utilizador autenticado
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData?.user) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 },
      );
    }

    // 3) Buscar perfil correspondente na tabela profiles
    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userData.user.id)
      .maybeSingle();

    if (profileError) {
      console.error("ME PROFILE ERROR:", profileError);
      return NextResponse.json(
        { success: false, error: "Erro ao carregar o perfil" },
        { status: 500 },
      );
    }

    // 4) Devolver user + profile
    return NextResponse.json({
      success: true,
      user: userData.user,
      profile: profileData,
    });
  } catch (err) {
    console.error("[GET /api/me] Erro inesperado:", err);
    return NextResponse.json(
      { success: false, error: "Erro interno ao carregar o utilizador" },
      { status: 500 },
    );
  }
}