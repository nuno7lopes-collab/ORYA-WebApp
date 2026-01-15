import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { cookies } from "next/headers";
import { isSameOriginOrApp } from "@/lib/auth/requestValidation";

export async function POST(req: NextRequest) {
  try {
    if (!isSameOriginOrApp(req)) {
      return NextResponse.json({ success: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const supabase = await createSupabaseServer();
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("[auth/logout] supabase signOut error:", error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const res = NextResponse.json({ success: true });

    // Garantir limpeza de todos os cookies sb-*
    try {
      const store = await cookies();
      store
        .getAll()
        .filter((c) => c.name.startsWith("sb-"))
        .forEach((c) => {
          res.cookies.set({
            name: c.name,
            value: "",
            maxAge: 0,
          });
        });
    } catch {
      /* noop */
    }

    return res;
  } catch (err) {
    console.error("[auth/logout] unexpected error:", err);
    return NextResponse.json({ success: false, error: "Erro ao terminar sessão." }, { status: 500 });
  }
}
