import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabaseServer";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const email = form.get("email") as string;
  const password = form.get("password") as string;

  const res = NextResponse.next();
  const { supabase } = createSupabaseServer(req, res);

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // 🔒 NOVO: bloquear se o email ainda não estiver confirmado
  const user = data.user;
  if (!user || !user.email_confirmed_at) {
    // garantir que não fica sessão pendurada
    await supabase.auth.signOut();
    return NextResponse.json(
      { error: "Precisas de confirmar o teu email antes de entrar." },
      { status: 403 }
    );
  }

  return NextResponse.json({ success: true });
}