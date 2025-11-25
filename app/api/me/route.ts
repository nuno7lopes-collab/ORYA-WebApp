// app/api/me/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabaseServer";

// Tipagem simples devolvida ao frontend
interface SupabaseUser {
  id: string;
  email?: string | null;
}

interface AuthErrorLike {
  status?: number;
  name?: string;
}

export async function GET() {
  try {
    const supabase = await createSupabaseServer();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    // 🔹 Caso típico: sem sessão → devolver 401 sem lançar 500
    if (userError) {
      const err = userError as AuthErrorLike;
const isAuthMissing =
  err?.status === 400 ||
  err?.name === "AuthSessionMissingError";

      if (isAuthMissing) {
        return NextResponse.json(
          { success: false, error: "Precisas de iniciar sessão." },
          { status: 401 },
        );
      }

      // Outros erros
      console.warn("[GET /api/me] Erro inesperado em getUser:", userError);
      return NextResponse.json(
        { success: false, error: "Erro ao obter sessão." },
        { status: 500 },
      );
    }

    // 🔹 Caso sem user (sem sessão válida)
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Precisas de iniciar sessão." },
        { status: 401 },
      );
    }

    // 🔹 User válido — devolvemos apenas os campos necessários
    const safeUser: SupabaseUser = {
      id: user.id,
      email: user.email ?? undefined,
    };

    // Fetch profile from app_v3.profiles
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (profileError) {
      console.warn("[GET /api/me] Erro ao carregar profile:", profileError);
    }

    return NextResponse.json({
      success: true,
      user: safeUser,
      profile: profile ?? null,
    });
  } catch (err) {
    console.error("[GET /api/me] Erro inesperado:", err);
    return NextResponse.json(
      { success: false, error: "Erro ao carregar o perfil." },
      { status: 500 },
    );
  }
}