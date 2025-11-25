

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabaseServer";

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json(
        { error: "Email em falta." },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServer();

    // Ask Supabase to resend the OTP for email verification
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
    });

    if (error) {
      console.error("[resend-otp] erro:", error);
      return NextResponse.json(
        { error: "Não foi possível reenviar o código. Tenta mais tarde." },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Erro em /api/auth/resend-otp:", err);
    return NextResponse.json(
      { error: "Erro interno." },
      { status: 500 }
    );
  }
}