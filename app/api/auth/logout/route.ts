import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabaseServer";

export async function POST() {
  try {
    const supabase = await createSupabaseServer();
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("[auth/logout] supabase signOut error:", error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[auth/logout] unexpected error:", err);
    return NextResponse.json({ success: false, error: "Erro ao terminar sessão." }, { status: 500 });
  }
}
