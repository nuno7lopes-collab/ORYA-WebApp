// app/api/login/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabaseServer";

export async function POST(req: NextRequest) {
  try {
    // Ler sempre JSON vindo do frontend (/login)
    const body = (await req.json().catch(() => null)) as
      | { email?: string; password?: string }
      | null;

    const email = body?.email?.trim() || "";
    const password = body?.password || "";

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: "Email ou password em falta." },
        { status: 400 }
      );
    }

    // Supabase do lado do servidor (usa cookies() por baixo)
    const supabase = await createSupabaseServer();

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error("[/api/login] Erro Supabase:", error);
      return NextResponse.json(
        {
          success: false,
          error:
            error.message ||
            "Credenciais inválidas ou problema ao iniciar sessão.",
        },
        { status: 401 }
      );
    }

    // Se chegou aqui, o Supabase já tratou das cookies de sessão.
    // Não precisamos de fazer mais nada — apenas devolver OK.
    return NextResponse.json(
      {
        success: true,
        user: data.user,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[/api/login] Erro inesperado:", err);
    return NextResponse.json(
      { success: false, error: "Erro interno no login." },
      { status: 500 }
    );
  }
}